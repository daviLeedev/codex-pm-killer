#!/usr/bin/env node
/** Fail-closed verification of a private QA fixture against independent real Vue browser captures. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {parse,hashFile,treeHash,writeJSON} from './core.mjs';

const a=process.argv.slice(2),opt=k=>{const i=a.indexOf('--'+k);return i<0?null:a[i+1]};
const names=['clean','faulty','gold','qa-gold','fixture-lock','clean-quality','faulty-quality','clean-runtime','faulty-runtime','out'];
const paths=Object.fromEntries(names.map(n=>[n,opt(n)]));
if(Object.values(paths).some(x=>!x))throw Error('Usage: qa-fixture-proof.mjs --clean CLEAN_DIR --faulty FAULTY_DIR --gold GOLD.json --qa-gold PRIVATE_QA.json --fixture-lock LOCK.json --clean-quality CLEAN_REPORT.json --faulty-quality FAULT_REPORT.json --clean-runtime CLEAN_RUNTIME.json --faulty-runtime FAULT_RUNTIME.json --out PRIVATE_PROOF.json');
const [gold,qa,lock,cleanScore,faultScore,cleanRuntime,faultRuntime]=await Promise.all(
 [paths.gold,paths['qa-gold'],paths['fixture-lock'],paths['clean-quality'],paths['faulty-quality'],paths['clean-runtime'],paths['faulty-runtime']].map(parse));
const failures=[];
const fail=(code)=>{if(!failures.includes(code))failures.push(code)};
const goldSha=await hashFile(paths.gold);
if(goldSha!==lock.goldSha256||goldSha!==qa.sourceGoldSha256||await hashFile(paths['qa-gold'])!==lock.qaGoldSha256)fail('GOLD_OR_QA_FIXTURE_LOCK_MISMATCH');
if(await treeHash(paths.clean)!==lock.originalReferenceSourceSha256||await treeHash(paths.faulty)!==lock.faultySourceSha256)fail('SOURCE_TREE_CHANGED_SINCE_SEED');
if(lock.mutationCount!==20||lock.controlCount!==20||new Set(qa.mutatedIds).size!==20||new Set(qa.controlIds).size!==20)fail('QA_20_PLUS_20_CONTRACT_FAILED');

const expected=(gold.layers??[]).flatMap(l=>l.checks??[]).map(c=>c.id);
if(gold.status!=='FROZEN_VERIFIED'||expected.length!==150||new Set(expected).size!==150)fail('FROZEN_GOLD_150_MISSING');
if([...qa.mutatedIds,...qa.controlIds].some(id=>!expected.includes(id)))fail('QA_ID_NOT_IN_GOLD');
function indexReport(report,runtime,actualFile,label){
 if(report.expectedSha256!==goldSha||report.status==='SYNTHETIC_ONLY'||report.status==='BLOCKED'||
   report.scopeErrors?.length||report.missingRequiredRegions?.length||report.checks?.length!==150)fail(label+'_EVALUATOR_INVALID');
 if(runtime.captureEnvironment!=='REAL_APP_RUNTIME'||JSON.stringify(runtime.viewport)!==JSON.stringify(gold.viewport)||
   runtime.errors?.length||runtime.blockedExternalRequests?.length||runtime.captureWarnings?.length||
   runtime.coverageComplete!==true)fail(label+'_NOT_VERIFIED_REAL_VUE_CAPTURE');
 return hashFile(actualFile).then(h=>{
  if(report.actualSha256!==h)fail(label+'_RUNTIME_SHA256_MISMATCH');
  const entries=report.checks??[];
  if(new Set(entries.map(c=>c.id)).size!==150||entries.some(c=>!['MATCH','MISMATCH','NOT_EVALUABLE'].includes(c.status)))fail(label+'_CHECK_SET_INVALID');
  return new Map(entries.map(c=>[c.id,c.status]));
 });
}
const [before,after]=await Promise.all([
 indexReport(cleanScore,cleanRuntime,paths['clean-runtime'],'CLEAN'),
 indexReport(faultScore,faultRuntime,paths['faulty-runtime'],'FAULTY')
]);
const missed=[],controlsBroken=[],collateral=[];
for(const id of qa.mutatedIds)if(before.get(id)!=='MATCH'||after.get(id)!=='MISMATCH')missed.push({id,before:before.get(id)??'MISSING',after:after.get(id)??'MISSING'});
for(const id of qa.controlIds)if(before.get(id)!=='MATCH'||after.get(id)!=='MATCH')controlsBroken.push({id,before:before.get(id)??'MISSING',after:after.get(id)??'MISSING'});
const mutated=new Set(qa.mutatedIds);
for(const id of expected)if(!mutated.has(id)&&before.get(id)!==after.get(id))collateral.push({id,before:before.get(id),after:after.get(id)});
if(missed.length)fail('INJECTED_FAULT_NOT_REPRODUCED');
if(controlsBroken.length)fail('HEALTHY_CONTROLS_NOT_HEALTHY');
if(collateral.length)fail('UNPLANNED_COLLATERAL_ASSERTION_CHANGES');
const result={schemaVersion:1,status:failures.length?'QA_FIXTURE_BLOCKED':'QA_FIXTURE_VERIFIED_FOR_FROZEN_40',
 frozenGoldSha256:goldSha,qaGoldSha256:lock.qaGoldSha256,referenceProjectSha256:lock.originalReferenceSourceSha256,
 faultyProjectSha256:lock.faultySourceSha256,confirmedFaults:20-missed.length,confirmedHealthyControls:20-controlsBroken.length,
 unexpectedChangedAssertions:collateral.length,failures,missed,controlsBroken,collateral,
 note:'This proves selected frozen assertion transitions in recorded real Chromium DOM. It does not authenticate Figma original values or prove the entire reference UI is visually exact.'};
await writeJSON(paths.out,result);
console.log(JSON.stringify({status:result.status,confirmedFaults:result.confirmedFaults,healthyControls:result.confirmedHealthyControls,failures}));
if(failures.length)process.exitCode=2;
