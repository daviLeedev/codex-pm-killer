#!/usr/bin/env node
/** Paired repeated-run descriptive summary, never compare changed Gold/evaluator/skill versions. */
import path from 'node:path';
import {parse,writeJSON} from './core.mjs';
const argv=process.argv.slice(2),out=argv.includes('--out')?argv[argv.indexOf('--out')+1]:null;
const files=argv.filter((x,i)=>i>0&&argv[i-1]==='--report');
if(!out||!files.length)throw Error('Usage: aggregate.mjs --report graded-run1.json [--report graded-run2.json ...] --out aggregate.json');
const reports=await Promise.all(files.map(parse));
const base=reports[0],errors=[],sig=r=>JSON.stringify([r.protocolVersion,r.skillCommit,r.evaluatorCommit,r.goldSha256,r.qaGoldSha256,r.sourceHashes]);
if(new Set(reports.map(r=>r.runId)).size!==reports.length)errors.push('DUPLICATE_RUN_ID');
if(reports.some(r=>sig(r)!==sig(base)))errors.push('CHANGED_GOLD_EVALUATOR_SKILL_OR_INITIAL_PROJECT');
if(reports.some(r=>r.validity!=='EXPLORATORY_SINGLE_RUN'))errors.push('INCOMPLETE_GROUP_OR_TRACK');
const props={
 I:['quality.match','quality.mismatch','quality.notEvaluable','quality.evaluableCoverage','quality.totalVerifiedRatio','estimatedUsd','durationMs','tokens.inputTokens','tokens.outputTokens','tokens.cachedInputTokens'],
 II:['qa.tp','qa.fp','qa.fn','qa.precision','qa.recall','qa.confirmedFixes','qa.regressions','estimatedUsd','durationMs','tokens.inputTokens','tokens.outputTokens']
};
const get=(obj,loc)=>loc.split('.').reduce((v,k)=>v?.[k],obj);
function stats(values){
 const vals=values.filter(Number.isFinite),n=vals.length,mean=n?vals.reduce((a,b)=>a+b,0)/n:null;
 return {n,mean,min:n?Math.min(...vals):null,max:n?Math.max(...vals):null,sampleSd:n>1?Math.sqrt(vals.reduce((v,x)=>v+(x-mean)**2,0)/(n-1)):null};
}
const data={I:{},II:{}},paired={I:{},II:{}};
for(const t of ['I','II']){
 for(const g of ['A','B','C'])data[t][g]=Object.fromEntries(props[t].map(k=>[k,stats(reports.map(r=>get(r.tracks?.[t]?.[g],k)))]));
 for(const label of ['B-A','C-B']){
  const [left,right]=label.split('-');
  paired[t][label]=Object.fromEntries(props[t].map(k=>[k,stats(reports.map(r=>{
   const a=get(r.tracks?.[t]?.[left],k),b=get(r.tracks?.[t]?.[right],k);return Number.isFinite(a)&&Number.isFinite(b)?a-b:null;
  }))]));
 }
}
const result={schemaVersion:1,status:errors.length?'INCONCLUSIVE':reports.length<3?'EXPLORATORY_N_LESS_THAN_3':'REPEATED_DESCRIPTIVE',
 runs:reports.length,runIds:reports.map(r=>r.runId),goldSha256:base.goldSha256,protocolVersion:base.protocolVersion,evaluatorCommit:base.evaluatorCommit,
 skillCommit:base.skillCommit,errors,groups:data,pairedDelta:paired,warning:'Descriptive paired means/s.d. from submitted runs only; no statistical superiority or confidence guarantee from n=3.'};
await writeJSON(out,result);console.log(JSON.stringify({status:result.status,runs:result.runs,errors}));if(errors.length)process.exitCode=2;
