#!/usr/bin/env node
/** Seal experiment inputs; create isolated clean A/B/C workspaces for E2E and QA. No API calls. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {parse,validatePlan,treeHash,copyClean,hashFile,writeJSON,sha256} from './core.mjs';
const args=process.argv.slice(2),arg=k=>{const i=args.indexOf('--'+k);return i<0?null:args[i+1]};
const planFile=arg('plan'),out=arg('out');
if(!planFile||!out)throw Error('Usage: prepare.mjs --plan PRIVATE_PLAN.json --out NEW_PRIVATE_RUN_DIR');
const p=await parse(planFile);validatePlan(p);
const dir=path.resolve(out);
try{await fs.access(dir);throw Error('OUTPUT_ALREADY_EXISTS: require clean new run ID')}catch(e){if(e.code!=='ENOENT')throw e}
const inputs=Object.fromEntries(Object.entries(p.inputs).map(([key,val])=>[key,path.resolve(path.dirname(path.resolve(planFile)),val)]));
for(const src of [inputs.implementationProject,inputs.qaFaultyProject]){
 const real=await fs.realpath(src);
 if(dir===real||dir.startsWith(real+path.sep)||real.startsWith(dir+path.sep))throw Error('WORKSPACE_OVERLAPS_SOURCE');
}
for(const secret of ['goldTruth','qaGold']) {
 const gold=await fs.realpath(inputs[secret]);
 for(const project of [inputs.implementationProject,inputs.qaFaultyProject]){
  const root=await fs.realpath(project);
  if(gold===root||gold.startsWith(root+path.sep))throw Error('GOLD_INSIDE_AGENT_VISIBLE_PROJECT');
 }
}
const sourceHashes={I:await treeHash(inputs.implementationProject),II:await treeHash(inputs.qaFaultyProject)};
const [goldSha256,qaGoldSha256,assetManifestSha256]=await Promise.all([hashFile(inputs.goldTruth),hashFile(inputs.qaGold),hashFile(inputs.assetManifest)]);
const [goldLock,assetLock,readiness]=await Promise.all([parse(inputs.goldLock),parse(inputs.assetLock),parse(inputs.readinessReport)]);
if(goldLock.status!=='FROZEN_RECORDED_EVIDENCE'||goldLock.truthSha256!==goldSha256||goldLock.assertions!==150||goldLock.unknown?.length||goldLock.problems?.length)
 throw Error('GOLD_LOCK_NOT_DIRECT_EVIDENCE_VERIFIED');
if(assetLock.status!=='READY'||assetLock.manifestSha256!==assetManifestSha256||assetLock.issues?.length)
 throw Error('SHARED_ASSET_LOCK_NOT_VERIFIED');
if(!['READY','READY_WITH_SUBSTITUTES'].includes(readiness.status)||readiness.truthSha256!==goldSha256||
 readiness.packSha256!==assetLock.manifestSha256||readiness.approvedCapUsd!==p.approvedCapUsd)
 throw Error('V632_READINESS_GATE_NOT_PASSED_FOR_THIS_RUN');
const gold=await parse(inputs.goldTruth);
const checks=(gold.layers??[]).flatMap(l=>l.checks??[]);
if(gold.status!=='FROZEN_VERIFIED'||checks.length!==150||new Set(checks.map(x=>x.id)).size!==150)
 throw Error('E2E_GOLD_MUST_BE_VERIFIED_150_UNIQUE_ASSERTIONS');
const groups={
 geometry:new Set(['width','height','x','y','left','top','right','bottom']),
 spacing:new Set(['gap','padding','padding_top','padding_right','padding_bottom','padding_left']),
 typography:new Set(['font','font_size','size','weight','font_weight','line_height','letter_spacing','line_count']),
 color:new Set(['fill','color','background_color','placeholder_color']),
 text:new Set(['text','placeholder_text']),asset:new Set(['icon_present','image_loaded','asset_kind','asset_pack_id','object_fit']),
 structure:new Set(['child_count','element_present','horizontal_overflow'])
};
const quotas={geometry:30,spacing:20,typography:15,color:8,text:5,asset:5,structure:5};
const counts=Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,checks.filter(c=>v.has(c.property)).length]));
for(const [k,min] of Object.entries(quotas))if(counts[k]<min)throw Error('GOLD_UNBALANCED_'+k.toUpperCase()+': '+counts[k]+' < '+min);
if(checks.filter(c=>c.property==='gap').length<5)throw Error('GOLD_GAP_COVERAGE_BELOW_FIVE');
const qa=await parse(inputs.qaGold);
if(!Array.isArray(qa.mutatedIds)||qa.mutatedIds.length<20||!Array.isArray(qa.controlIds)||qa.controlIds.length<20)throw Error('QA_GOLD_NEEDS_20_MUTATIONS_AND_20_CONTROLS');
const discovered=new Set([...qa.mutatedIds,...qa.controlIds]);
if(discovered.size!==qa.mutatedIds.length+qa.controlIds.length)throw Error('QA_GOLD_DUPLICATE_OR_OVERLAPPING_IDS');
const validCheckIds=new Set(checks.map(x=>x.id));
if([...discovered].some(id=>!validCheckIds.has(id)))throw Error('QA_GOLD_IDS_NOT_IN_FROZEN_150');
const workspaces={I:{},II:{}},instructions={I:{},II:{}};
for(const track of ['I','II'])for(const group of ['A','B','C']){
 const dest=path.join(dir,'work','track-'+track,group);
 await fs.mkdir(path.dirname(dest),{recursive:true});
 await copyClean(inputs[track==='I'?'implementationProject':'qaFaultyProject'],dest);
 if(await treeHash(dest)!==sourceHashes[track])throw Error('WORKSPACE_COPY_HASH_MISMATCH: '+track+'/'+group);
 const common=track==='I'?'Implement the single mobile Home screen from the Figma viewer, run the app, inspect the result and correct errors.':'Audit and repair the supplied faulty mobile Home implementation against the Figma viewer, then verify changes.';
 const baseline=common+'\n'+p.task.trim()+'\nFigma: '+p.figmaUrl+'\nUse the same supplied browser/tools and assets. Preserve complete results and evidence. Do not read evaluation gold or other groups.';
 const special=group==='A'?'':group==='B'?'\nUse the codex-pm-killer SKILL.md and its single-agent verification workflow.':'\nUse the codex-pm-killer skill with REAL concurrently operating host subagents. Record agent spawn/session IDs and overlapping execution, or report C_PARALLEL_BLOCKED.';
 const prompt=baseline+special+'\n';
 const promptPath=path.join(dir,'prompts',track+'-'+group+'.txt');
 await fs.mkdir(path.dirname(promptPath),{recursive:true});
 await fs.writeFile(promptPath,prompt,{flag:'wx',mode:0o600});
 workspaces[track][group]={path:dest,sourceSha256:sourceHashes[track]};
 instructions[track][group]={path:promptPath,sha256:sha256(Buffer.from(prompt))};
}
const lock={schemaVersion:1,runId:p.runId,scope:p.scope,protocolVersion:p.protocolVersion,figmaUrl:p.figmaUrl,
 models:p.models,reasoning:p.reasoning,viewport:p.viewport,browserVersion:p.browserVersion,
 skillCommit:p.skillCommit,evaluatorCommit:p.evaluatorCommit,approvedCapUsd:p.approvedCapUsd,
 sourceHashes,goldSha256,qaGoldSha256,assetManifestSha256,goldLockSha256:await hashFile(inputs.goldLock),assetLockSha256:await hashFile(inputs.assetLock),readinessSha256:await hashFile(inputs.readinessReport),goldPropertyGroups:counts,workspaces,instructions,
 separateGoldRequired:true,productionQaIndependentEvaluatorRequired:true,parallelCRequired:true,
 status:'PREPARED_NOT_EXECUTED',
 caveat:'Worktrees and prompt separation are prepared, but host-level filesystem/browser permissions and agent prompt ingestion must be independently audited.'};
await writeJSON(path.join(dir,'private-plan-lock.json'),lock);
console.log(JSON.stringify({status:'PREPARED_NOT_EXECUTED',runId:p.runId,sourceHashes,groups:6,lock:path.join(dir,'private-plan-lock.json')}));
