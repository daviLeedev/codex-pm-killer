#!/usr/bin/env node
/** Fail-closed independent same-scope patch verification from REAL_APP_RUNTIME evidence. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {cliArg,load,fileHash,atomicWrite,required,isSha,sha256} from './core.mjs';
const args=['before-diff','after-diff','before-runtime','after-runtime','scope','patch','out'];
const opts=Object.fromEntries(args.map(k=>[k,cliArg(k)]));
if(Object.values(opts).some(v=>!v))throw Error('Usage: verify-patch.mjs --before-diff BEFORE.json --after-diff AFTER.json --before-runtime BEFORE.json --after-runtime AFTER.json --scope SCOPE.json --patch RECEIPT.json --out VERDICT.json');
const [before,after,first,last,scope,patch]=await Promise.all([
 load(opts['before-diff']),load(opts['after-diff']),load(opts['before-runtime']),load(opts['after-runtime']),load(opts.scope),load(opts.patch)
]);
required(patch.schemaVersion===1&&patch.patchId&&patch.issueIds?.length,'VALID_PATCH_RECEIPT_REQUIRED');
const errors=[],add=code=>{if(!errors.includes(code))errors.push(code)};
if(before.status!=='ISSUES_RECORDED'||after.status!=='ISSUES_RECORDED'||before.designSha256!==after.designSha256)
 add('FROZEN_DESIGN_OR_DIFFERENCE_REPORT_INVALID');
const firstSha=await fileHash(opts['before-runtime']),lastSha=await fileHash(opts['after-runtime']);
if(before.runtimeSha256!==firstSha||after.runtimeSha256!==lastSha)add('STALE_OR_MISMATCHED_RUNTIME_MEASUREMENTS');
const scopeEqual=first.captureEnvironment==='REAL_APP_RUNTIME'&&last.captureEnvironment==='REAL_APP_RUNTIME'&&
 JSON.stringify(first.viewport)===JSON.stringify(last.viewport)&&first.route===last.route&&
 first.status==='DOM_DISCOVERED'&&last.status==='DOM_DISCOVERED'&&
 !first.truncated&&!last.truncated&&(!first.errors?.length)&&(!last.errors?.length)&&(!first.warnings?.length)&&(!last.warnings?.length)&&
 first.coverageComplete===true&&last.coverageComplete===true;
if(!scopeEqual)add('REAL_APP_SAME_SCOPE_REQUIRED');
if(JSON.stringify(scope.viewport)!==JSON.stringify(first.viewport)||scope.fullPage!==true||
 !Array.isArray(scope.requiredRegionIds)||scope.requiredRegionIds.length<1)add('IMPACT_SCOPE_OR_FULL_PAGE_MISSING');
async function screenshot(file,runtime){
 const rel=runtime.screenshotPath;
 if(typeof rel!=='string'||!rel||rel.includes('..')||path.isAbsolute(rel)||!isSha(runtime.screenshotSha256))return null;
 const full=path.resolve(path.dirname(file),rel);
 if(!full.startsWith(path.dirname(path.resolve(file))+path.sep))return null;
 try{const bytes=await fs.readFile(full);return sha256(bytes)===runtime.screenshotSha256?runtime.screenshotSha256:null}catch{return null}
}
const imageBefore=await screenshot(opts['before-runtime'],first),imageAfter=await screenshot(opts['after-runtime'],last);
if(!imageBefore||!imageAfter)add('SCREENSHOT_BYTES_NOT_VERIFIED');
if(imageBefore===imageAfter)add('NO_VISIBLE_CHANGE_AFTER_SOURCE_EDIT');
const beforeIssues=new Map((before.issues??[]).map(x=>[x.issueId,x]));
const afterIssues=new Map((after.issues??[]).map(x=>[x.issueId,x]));
const beforeBlocking=new Set((before.issues??[]).filter(x=>['P0','P1'].includes(x.severity)).map(x=>x.issueId));
const newlyBlocking=(after.issues??[]).filter(x=>['P0','P1'].includes(x.severity)&&!beforeBlocking.has(x.issueId));
const worsened=(after.issues??[]).filter(x=>{
 const old=beforeIssues.get(x.issueId),a=x.comparison?.delta,b=old?.comparison?.delta;
 return old&&['P0','P1'].includes(x.severity)&&Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a)>Math.abs(b)+1;
});
if(newlyBlocking.length)add('NEW_MAJOR_REGRESSIONS');
if(worsened.length)add('EXISTING_ISSUES_WORSENED');
if((after.coverage?.evaluable??0)<(before.coverage?.evaluable??0)-.01)add('MEASUREMENT_COVERAGE_REGRESSED');
if((after.unknown?.length??0)>(before.unknown?.length??0))add('NEW_UNVERIFIED_PROPERTIES');
const resolvedIssueIds=patch.issueIds.filter(id=>beforeIssues.has(id)&&!afterIssues.has(id));
if(resolvedIssueIds.length!==patch.issueIds.length)add('PATCH_TARGET_NOT_FULLY_RESOLVED');
const requiredIDs=[...new Set(scope.requiredRegionIds??[])];
const observedIds=x=>new Set((x.elements??[]).filter(e=>e.visible===true&&(e.figmaHint||e.id)).map(e=>e.figmaHint||e.id));
const preIDs=observedIds(first),postIDs=observedIds(last);
for(const id of requiredIDs){
 const isTarget=(patch.issueIds??[]).some(key=>beforeIssues.get(key)?.regionId===id);
 if(!postIDs.has(id)||(!isTarget&&!preIDs.has(id)))add('AFFECTED_OR_NEIGHBOR_REGION_UNVERIFIED: '+id);
}
const newP0=newlyBlocking.filter(x=>x.severity==='P0').length;
const accepted=!errors.length;
const result={schemaVersion:1,status:accepted?'ACCEPT':'REJECT',patchId:patch.patchId,
 verifiedBy:'scripts/fidelity/verify-patch.mjs',beforeRuntimeSha256:firstSha,afterRuntimeSha256:lastSha,
 beforeScreenshotSha256:imageBefore,afterScreenshotSha256:imageAfter,currentCaptureEnvironment:'REAL_APP_RUNTIME',
 scopeEqual,visualChangeObserved:imageBefore!==imageAfter,targetImproved:resolvedIssueIds.length===patch.issueIds.length,
 resolvedIssueIds,recheckedRegionIds:requiredIDs,regressionCount:newlyBlocking.length+worsened.length,
 newP0,regressionIssueIds:[...new Set([...newlyBlocking,...worsened].map(x=>x.issueId))],
 errors,rollbackCompleted:false,restoredSourceSha256:null,
 warning:'Chromium + frozen design evidence verifies the scoped edits; Figma authenticity and other browsers are independent concerns.'};
await atomicWrite(opts.out,result);
console.log(JSON.stringify({status:result.status,resolved:resolvedIssueIds.length,regressions:result.regressionCount,errors}));
if(!accepted)process.exitCode=2;
