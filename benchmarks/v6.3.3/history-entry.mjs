#!/usr/bin/env node
/** Produce sanitized/public DRAFT history entry. No git push, no raw evidence, manual privacy review required. */
import path from 'node:path';
import {parse,hashFile,writeJSON} from './core.mjs';
const a=process.argv.slice(2),arg=k=>{const i=a.indexOf('--'+k);return i<0?null:a[i+1]};
const file=arg('graded'),out=arg('out');
if(!file||!out)throw Error('Usage: history-entry.mjs --graded PRIVATE_GRADED.json --out PUBLIC_DRAFT.json');
const g=await parse(file);
if(!/^[a-z0-9-]{8,80}$/.test(g.runId??''))throw Error('UNSAFE_PUBLIC_RUN_ID');
const results={},qaMetrics={};
for(const name of ['A','B','C']){
 const e=g.tracks?.I?.[name]??{},q=g.tracks?.II?.[name]??{};
 results[name]={match:e.quality?.match??0,mismatch:e.quality?.mismatch??0,
  notEvaluable:e.quality?.status==='SCORED'?e.quality.notEvaluable:150,
  estimatedUsd:(e.estimatedUsd??0)+(q.estimatedUsd??0)};
 qaMetrics[name]={status:q.state??'NOT_RUN',tp:q.qa?.tp??null,fp:q.qa?.fp??null,fn:q.qa?.fn??null,
  recall:q.qa?.recall??null,precision:q.qa?.precision??null,confirmedFixes:q.qa?.confirmedFixes??null,
  regressions:q.qa?.regressions??null};
}
const sanitized={
 schemaVersion:1,runId:g.runId,date:new Date().toISOString().slice(0,10),skillVersion:'6.3.3',
 testedCommit:g.skillCommit,scope:'Algolia mobile Home single frame — End-to-End and controlled QA',
 assertions:150,resultStatus:g.validity==='EXPLORATORY_SINGLE_RUN'?'EXPLORATORY':'PARTIAL',
 modelSetup:'Model details available in private controlled run manifest',results,qaMetrics,
 protocolVersion:g.protocolVersion,evaluatorCommit:g.evaluatorCommit,goldSha256:g.goldSha256,
 gradedReportSha256:await hashFile(file),evidenceStorage:'PRIVATE_NOT_PUBLISHED',
 reviewStatus:'AUTO_GENERATED_DRAFT_REQUIRES_PRIVACY_AND_EVIDENCE_REVIEW',
 limitations:['No automatic human verification of browser or host logs','API cost is a usage-based estimate, not an invoice','One A/B/C per run; statistical ranking requires repeated fresh paired experiments','Original substitute images cannot prove source-image pixel fidelity']};
await writeJSON(out,sanitized);console.log(JSON.stringify({status:'REVIEW_REQUIRED',runId:sanitized.runId,output:out}));
