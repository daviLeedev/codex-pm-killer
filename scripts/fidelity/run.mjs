#!/usr/bin/env node
/** Closed-loop fidelity state machine. It never claims tests were run based only on a prompt. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {cliArg,load,atomicWrite,withLock,fileHash,required,isSha,compareScope} from './core.mjs';
const verb=process.argv[2],workspace=cliArg('workspace');
if(!workspace||!verb)throw Error('Usage: run.mjs init|observe|capture|map|detect|diagnose|patch|verify|next|review|done|status --workspace PRIVATE_RUN [--config FILE] [--artifact FILE]');
const root=path.resolve(workspace),stateFile=path.join(root,'state.json');
const transition={observe:'INIT',capture:'FIGMA_OBSERVED',map:'DOM_CAPTURED',detect:'MAPPED',
 diagnose:'DIFFS_RECORDED',patch:'ROOT_CAUSE_PROPOSED',verify:'PATCHED',next:['VERIFIED','REVERTED'],
 review:'DIFFS_RECORDED',done:'INDEPENDENT_FINAL_REVIEW'};
const states=['INIT','FIGMA_OBSERVED','DOM_CAPTURED','MAPPED','DIFFS_RECORDED','ROOT_CAUSE_PROPOSED','PATCHED','VERIFIED','REVERTED','INDEPENDENT_FINAL_REVIEW','DONE','PARTIAL','BLOCKED'];
async function readArtifact(file){
 required(file&&path.resolve(file).startsWith(root+path.sep),'ARTIFACT_MUST_BE_PRIVATE_RUN_FILE');
 const bytes=await fs.readFile(file);
 const data=JSON.parse(bytes.toString('utf8'));
 required(data.schemaVersion===1,'ARTIFACT_SCHEMA_VERSION');
 return {data,sha256:await fileHash(file),file:path.relative(root,path.resolve(file))};
}
async function operate(){
 if(verb==='init'){
  try{await fs.access(stateFile);throw Error('RUN_EXISTS_NO_OVERWRITE')}catch(e){if(e.code!=='ENOENT')throw e}
  const config=await load(cliArg('config'));
  required(config.schemaVersion===1&&/^[a-z0-9_-]{8,80}$/i.test(config.runId??''),'RUN_CONFIG_INVALID');
  required(config.frameId&&config.viewport?.width>0&&config.viewport?.height>0,'FRAME_AND_VIEWPORT_REQUIRED');
  required(Number.isInteger(config.maxIterations)&&config.maxIterations>=1&&config.maxIterations<=30,'MAX_ITERATIONS_INVALID');
  required(typeof config.maxUsd==='number'&&config.maxUsd>0,'BUDGET_REQUIRED');
  const state={schemaVersion:1,runId:config.runId,frameId:config.frameId,viewport:config.viewport,maxIterations:config.maxIterations,maxUsd:config.maxUsd,
   state:'INIT',iteration:0,artifacts:{},issues:[],history:[],failedPatchHashes:[],usedPatchIds:[],
   originalInspector:null,startedAt:new Date().toISOString()};
  await atomicWrite(stateFile,state);
  console.log(JSON.stringify({state:state.state,runId:state.runId}));return;
 }
 const s=await load(stateFile);
 required(states.includes(s.state),'RUN_STATE_CORRUPTED');
 if(verb==='status'){console.log(JSON.stringify({runId:s.runId,state:s.state,iteration:s.iteration,issues:s.issues,artifacts:s.artifacts,history:s.history.length}));return}
 required(verb in transition,'UNKNOWN_RUN_COMMAND');
 const from=transition[verb];required(Array.isArray(from)?from.includes(s.state):from===s.state,'INVALID_STATE_TRANSITION: '+s.state+' -> '+verb);
 const artifact=await readArtifact(cliArg('artifact'));const {data,sha256,file}=artifact;
 let nextState;
 if(verb==='observe'){
  required(data.status==='VERIFIED_EVIDENCE_FILES'&&data.frame?.id===s.frameId&&
   data.frame.width===s.viewport.width&&data.frame.height===s.viewport.height&&
   data.requiredRegionIds?.length>0&&!data.errors?.length&&!data.unknown?.length,'FIGMA_DIRECT_EVIDENCE_GATE');
  s.originalInspector=data.inspectorActor;nextState='FIGMA_OBSERVED';
 }else if(verb==='capture'||verb==='next'){
  required(data.captureEnvironment==='REAL_APP_RUNTIME'&&
   data.viewport?.width===s.viewport.width&&data.viewport?.height===s.viewport.height&&
   ((Array.isArray(data.regions)&&data.regions.length)||(Array.isArray(data.elements)&&data.elements.length))&&
   !data.errors?.length&&!data.captureWarnings?.length&&!data.blockedExternalRequests?.length&&
   data.coverageComplete===true,'ACTUAL_RUNTIME_CAPTURE_REQUIRED');
  if(verb==='next')required(s.iteration<s.maxIterations,'ITERATION_BUDGET_EXHAUSTED');
  nextState='DOM_CAPTURED';
  if(verb==='next')s.iteration++;
 }else if(verb==='map'){
  required(['MAPPING_RECORDED','PARTIAL_MAPPINGS'].includes(data.status)&&Array.isArray(data.mappings)&&data.mappings.length,
   'MAPPING_ARTIFACT_MISSING');nextState='MAPPED';
 }else if(verb==='detect'){
  required(data.status==='ISSUES_RECORDED'&&Array.isArray(data.issues)&&typeof data.coverage?.evaluable==='number',
   'DETECTION_ARTIFACT_MISSING');
  required(data.designSha256===s.artifacts.observe?.sha256&&data.runtimeSha256===s.artifacts.capture?.sha256||
   data.designSha256===s.artifacts.observe?.sha256&&data.runtimeSha256===s.artifacts.next?.sha256,
   'DETECTION_INPUT_SHA_NOT_CURRENT');
  s.issues=data.issues;nextState='DIFFS_RECORDED';
 }else if(verb==='diagnose'){
  required(s.issues.some(i=>['P0','P1'].includes(i.severity)&&i.status!=='VERIFIED')&&
   Array.isArray(data.plans)&&data.plans.length,'NO_FIX_PLAN_FOR_ACTIVE_ISSUES');
  required(data.plans.every(x=>s.issues.some(i=>i.issueId===x.issueId)),'PLAN_REFERENCES_UNKNOWN_ISSUE');
  nextState='ROOT_CAUSE_PROPOSED';
 }else if(verb==='patch'){
  required(data.patchId&&isSha(data.beforeSourceSha256)&&isSha(data.afterSourceSha256)&&
   data.beforeSourceSha256!==data.afterSourceSha256&&Array.isArray(data.issueIds)&&data.issueIds.length&&
   data.issueIds.every(id=>s.issues.some(i=>i.issueId===id)),'PATCH_RECEIPT_INVALID');
  required(!s.usedPatchIds.includes(data.patchId)&&!s.failedPatchHashes.includes(data.afterSourceSha256),'REPEATED_FAILED_PATCH_FORBIDDEN');
  required(s.iteration<s.maxIterations,'ITERATION_BUDGET_EXHAUSTED');
  s.pendingPatch={...data,receiptSha256:sha256};s.usedPatchIds.push(data.patchId);nextState='PATCHED';
 }else if(verb==='verify'){
  required(['ACCEPT','REJECT'].includes(data.status)&&data.patchId===s.pendingPatch?.patchId&&
   isSha(data.beforeRuntimeSha256)&&isSha(data.afterRuntimeSha256)&&
   data.beforeRuntimeSha256!==data.afterRuntimeSha256&&data.verifiedBy==='scripts/fidelity/verify-patch.mjs'&&Array.isArray(data.recheckedRegionIds)&&
   data.recheckedRegionIds.length>0,'ACTUAL_POST_PATCH_REVERIFICATION_REQUIRED');
  required(data.scopeEqual===true&&data.currentCaptureEnvironment==='REAL_APP_RUNTIME','POST_PATCH_CAPTURE_MUST_MATCH_SCOPE');
  if(data.status==='ACCEPT'){
   required(data.targetImproved===true&&data.regressionCount===0&&data.newP0===0,'FALSE_ACCEPT_VERDICT');
   for(const issue of s.issues)if(data.resolvedIssueIds?.includes(issue.issueId))issue.status='VERIFIED';
   nextState='VERIFIED';
  }else{
   required(data.rollbackCompleted===true&&isSha(data.restoredSourceSha256)&&data.restoredSourceSha256===s.pendingPatch.beforeSourceSha256,
    'REJECTED_PATCH_MUST_BE_ROLLED_BACK');
   s.failedPatchHashes.push(s.pendingPatch.afterSourceSha256);nextState='REVERTED';
  }
  s.lastVerdict=data;s.pendingPatch=null;
 }else if(verb==='review'){
  const blocking=s.issues.filter(i=>['P0','P1'].includes(i.severity)&&!['VERIFIED','CLOSED'].includes(i.status));
  required(!blocking.length&&data.status==='INDEPENDENT_REVIEW_RECORDED'&&data.actor&&data.actor!==s.originalInspector&&
   isSha(data.figmaEvidenceSha256)&&isSha(data.runtimeEvidenceSha256)&&
   data.realFigmaViewerRevisited===true&&data.realAppRecaptured===true&&
   data.criticalMissing===0&&data.regressions===0&&data.evaluableCoverage>=.95&&
   data.finalDifferenceSha256===s.artifacts.detect?.sha256,'INDEPENDENT_FINAL_GATE_NOT_SATISFIED');
  const source=await readArtifact(path.join(root,data.figmaEvidenceFile));
  required(source.sha256===data.figmaEvidenceSha256&&source.data.method==='AUTHENTICATED_VIEW_ONLY_BROWSER'&&
   source.data.frame?.id===s.frameId&&source.data.inspectorActor===data.actor,'NEW_ACTOR_FIGMA_BROWSER_EVIDENCE_MISSING');
  const newer=await readArtifact(path.join(root,data.runtimeEvidenceFile));
  required(newer.sha256===data.runtimeEvidenceSha256&&newer.data.captureEnvironment==='REAL_APP_RUNTIME'&&
   newer.data.viewport?.width===s.viewport.width&&newer.data.viewport?.height===s.viewport.height&&
   newer.data.coverageComplete===true&&!(newer.data.errors?.length)&&!(newer.data.warnings?.length),
   'LATEST_REAL_BROWSER_EVIDENCE_INVALID');
  const screenshotPath=path.resolve(path.dirname(path.join(root,data.runtimeEvidenceFile)),newer.data.screenshotPath??'');
  required(screenshotPath.startsWith(root+path.sep)&&isSha(newer.data.screenshotSha256)&&
   await fileHash(screenshotPath)===newer.data.screenshotSha256,'LATEST_SCREENSHOT_HASH_INVALID');
  const map=await readArtifact(path.join(root,data.mappingEvidenceFile));
  required(map.data.mappings?.length>0&&map.data.runtimeSha256===newer.sha256&&
   map.data.mappings.every(m=>m.required===false||m.status==='MATCHED_CANDIDATE'),
   'FINAL_REQUIRED_REGION_MAPPING_INCOMPLETE');
  nextState='INDEPENDENT_FINAL_REVIEW';
 }else if(verb==='done'){
  required(data.status==='FINAL_GATE_PASS'&&data.independentReviewSha256===s.artifacts.review.sha256&&
   data.buildOrTypecheckPass===true&&data.noOpenP0===true&&data.noOpenP1===true&&
   isSha(data.buildEvidenceSha256),'DONE_REQUIRES_VERIFIED_REVIEW_AND_BUILD');
  const build=path.join(root,data.buildEvidenceFile??'');
  required(build.startsWith(root+path.sep)&&await fileHash(build)===data.buildEvidenceSha256,
   'BUILD_PROOF_BYTES_REQUIRED');
  nextState='DONE';
 }
 s.history.push({action:verb,from:s.state,to:nextState,artifact:file,sha256,at:new Date().toISOString()});
 s.state=nextState;
 s.artifacts[verb]={path:file,sha256};
 await atomicWrite(stateFile,s);
 console.log(JSON.stringify({state:s.state,iteration:s.iteration,action:verb,artifactSha256:sha256}));
}
await withLock(root,operate);
