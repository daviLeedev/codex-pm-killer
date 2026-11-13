#!/usr/bin/env node
/** Independent post-run scorer: no Figma, no LLM API, no writes to agent workspaces. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse,hashFile,writeJSON,sha256} from './core.mjs';
const GROUPS=['A','B','C'],TRACKS=['I','II'],statuses=['MATCH','MISMATCH','NOT_EVALUABLE'];
export function scoreQA(gold,detected,before,after){
 const muts=new Set(gold.mutatedIds??[]),controls=new Set(gold.controlIds??[]);
 if(muts.size<20||controls.size<20||[...muts].some(id=>controls.has(id)))throw Error('BAD_FROZEN_QA_GOLD');
 const found=new Set((detected.issues??[]).map(x=>typeof x==='string'?x:x.id));
 const tp=[...found].filter(id=>muts.has(id)).length,fp=[...found].filter(id=>!muts.has(id)).length,fn=muts.size-tp;
 const pre=new Map((before.checks??[]).map(x=>[x.id,x.status]));
 const post=new Map((after.checks??[]).map(x=>[x.id,x.status]));
 const missing=[...muts,...controls].filter(id=>!pre.has(id)||!post.has(id));
 const invalidStartingConditions=[...muts].filter(id=>pre.get(id)!=='MISMATCH').concat([...controls].filter(id=>pre.get(id)!=='MATCH'));
 const fixed=[...muts].filter(id=>pre.get(id)==='MISMATCH'&&post.get(id)==='MATCH');
 const attempted=new Set((detected.attemptedFixIds??[]).filter(id=>muts.has(id)));
 const regressed=[...controls].filter(id=>pre.get(id)==='MATCH'&&post.get(id)==='MISMATCH');
 return {tp,fp,fn,precision:tp+fp?tp/(tp+fp):null,recall:tp/(tp+fn),confirmedFixes:fixed.length,attemptedFixes:attempted.size,
  fixSuccess:attempted.size?fixed.filter(id=>attempted.has(id)).length/attempted.size:null,
  regressions:regressed.length,regressionIds:regressed,
  missingIndependentAssertions:missing,invalidStartingConditions,status:missing.length||invalidStartingConditions.length?'INCONCLUSIVE':'SCORED'};
}
export function scoreFidelity(report,lock){
 const c=report.counts??{},sum=statuses.reduce((v,k)=>v+(c[k]??0),0),rows=report.checks??[];
 const valid=sum===150&&rows.length===150&&new Set(rows.map(x=>x.id)).size===150&&
  statuses.every(k=>Number.isInteger(c[k])&&c[k]>=0)&&rows.every(x=>statuses.includes(x.status))&&(!report.scopeErrors?.length)&&!['BLOCKED','SYNTHETIC_ONLY'].includes(report.status)&&
  statuses.every(k=>rows.filter(x=>x.status===k).length===c[k])&&
  report.expectedSha256===lock.goldSha256&&typeof report.actualSha256==='string'&&/^[0-9a-f]{64}$/i.test(report.actualSha256);
 return {status:valid?'SCORED':'INCONCLUSIVE',match:valid?c.MATCH:null,mismatch:valid?c.MISMATCH:null,notEvaluable:valid?c.NOT_EVALUABLE:null,
  evaluableCoverage:valid?(c.MATCH+c.MISMATCH)/150:null,totalVerifiedRatio:valid?c.MATCH/150:null,
  actualEvidence:report.actualSha256??null,reportedEvaluatorStatus:report.status??'UNKNOWN'};
}
export function auditBaseline(records){
 if(!Array.isArray(records)||!records.length)return {status:'UNVERIFIED_BASELINE',scanned:0,findings:[]};
 const pattern=/codex[-_]pm[-_]killer|(?:^|[/\s])SKILL\.md|gold[-_ ]?(?:truth|dataset|assertions)|benchmarks\/v6\.3|references\/(?:v6|provider-neutral)|Difference Analyst|UI Fixer/i;
 const findings=[];
 for(let i=0;i<records.length;i++){
  const r=records[i];if(!['user','system','developer','tool','tool_result'].includes(r.role))continue;
  const content=typeof r.content==='string'?r.content:JSON.stringify(r.content??'');
  // A prohibition is not proof the agent received a skill or opened its source.
  const safePolicy=/^\s*Do not read SKILL\.md or any skill instructions\.\s*Use only the ordinary task prompt\.\s*$/i;
  if(pattern.test(content)&&!((r.role==='system'||r.role==='developer'||r.role==='user')&&safePolicy.test(content)))
   findings.push({row:i,role:r.role,reason:'SKILL_OR_GOLD_INPUT_EXPOSURE'});
 }
 return {status:findings.length?'CONTAMINATED':'NO_LEAK_FOUND_IN_SUBMITTED_LOG',scanned:records.length,findings};
}
export function validateBudget(ledger,lock){
 const cap=Math.round(lock.approvedCapUsd*1e6),req=ledger.requests??[];
 const actual=req.filter(x=>x.state==='SETTLED').reduce((v,x)=>v+(x.actualMicro??0),0);
 const reserved=req.filter(x=>x.state!=='SETTLED'&&x.state!=='VOID').reduce((v,x)=>v+(x.reservedMicro??0),0);
 const ok=ledger.capMicro===cap&&actual+reserved<=cap&&req.every(x=>/^(I|II)-(A|B|C)-/.test(x.id??'')&&x.state==='SETTLED'&&
   /^[a-f0-9]{64}$/i.test(x.rawSha256??'')&&/^[a-f0-9]{64}$/i.test(x.usageSha256??'')&&Number.isInteger(x.actualMicro)&&x.actualMicro>=0);
 return {status:ok?'RECORDED_POLICY_CONSISTENT':'UNVERIFIED_BILLING_LEDGER',capUsd:lock.approvedCapUsd,estimatedTotalUsd:actual/1e6,reservedUsd:reserved/1e6,requestCount:req.length,
  caveat:'Journal-derived cost is not a provider invoice.'};
}
function cost(ledger,track,group){const prefix=track+'-'+group+'-',r=(ledger.requests??[]).filter(x=>x.id?.startsWith(prefix));return {requests:r.length,usd:r.reduce((v,x)=>v+(x.actualMicro??0),0)/1e6}}
async function verifiedUsage(ledger,track,group,folder){
 const requests=(ledger.requests??[]).filter(r=>r.id?.startsWith(track+'-'+group+'-'));
 const tokens={inputTokens:0,outputTokens:0,cachedInputTokens:0,reasoningOutputTokens:0};
 for(const req of requests){
  const bytes=await fs.readFile(path.join(folder,'usage',encodeURIComponent(req.id)+'.json'));
  if(sha256(bytes)!==req.usageSha256)throw Error('API_USAGE_EVIDENCE_HASH_MISMATCH: '+req.id);
  const u=JSON.parse(bytes.toString('utf8'));
  if(u.requestId!==req.id||u.model!==req.model)throw Error('API_USAGE_REQUEST_OR_MODEL_MISMATCH');
  for(const k of Object.keys(tokens)){
   if(!Number.isSafeInteger(u[k])||u[k]<0)throw Error('API_USAGE_INVALID_'+k);
   tokens[k]+=u[k];
  }
 }
 return tokens;
}
const arg=k=>{const a=process.argv.slice(2),i=a.indexOf('--'+k);return i<0?null:a[i+1]};
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const dir=arg('run'),qaPath=arg('qa-gold'),ledgerPath=arg('ledger'),proofPath=arg('parallel-proof'),out=arg('out');
 if(!dir||!qaPath||!ledgerPath||!out)throw Error('Usage: grade.mjs --run PRIVATE_RUN_DIR --qa-gold PRIVATE_QA_GOLD.json --ledger PRIVATE_LEDGER.json --parallel-proof PRIVATE_C_PARALLEL.json --out PRIVATE_GRADED.json');
 const lock=await parse(path.join(dir,'private-plan-lock.json')),qa=await parse(qaPath),ledger=await parse(ledgerPath),errors=[];
 if(await hashFile(qaPath)!==lock.qaGoldSha256)errors.push('QA_GOLD_CHANGED');
 const budget=validateBudget(ledger,lock);
 if(budget.status!=='RECORDED_POLICY_CONSISTENT')errors.push('BUDGET_EVIDENCE_MISSING_OR_UNCERTAIN');
 const proof=proofPath?await parse(proofPath).catch(()=>({status:'C_PARALLEL_BLOCKED'})):{status:'C_PARALLEL_BLOCKED'};
 if(proof.status!=='PARALLEL_HOST_LOG_RECORDED')errors.push('C_REAL_PARALLELISM_NOT_SHOWN');
 const report={schemaVersion:1,runId:lock.runId,protocolVersion:lock.protocolVersion,skillCommit:lock.skillCommit,
  evaluatorCommit:lock.evaluatorCommit,goldSha256:lock.goldSha256,qaGoldSha256:lock.qaGoldSha256,
  sourceHashes:lock.sourceHashes,budget,cParallel:proof.status,tracks:{I:{},II:{}},errors,repeatCount:1,validity:'INCONCLUSIVE',
  caveat:'Post-run evidence check cannot authenticate Figma source, submitted host logs, browser permissions or final provider charges.'};
 for(const t of TRACKS)for(const g of GROUPS){
  const folder=path.join(dir,'evidence','track-'+t,g),c=cost(ledger,t,g);
  const row={state:'NOT_RUN',model:lock.models[g],estimatedUsd:c.usd,requests:c.requests};
  if(c.requests===0){row.reason='NO_API_USAGE_JOURNAL_FOR_GROUP';report.tracks[t][g]=row;continue}
  try{
   const meta=await parse(path.join(folder,'run.json'));
   if(meta.initialProjectSha256!==lock.sourceHashes[t]||meta.model!==lock.models[g]||meta.reasoning!==lock.reasoning||meta.completed!==true)throw Error('RUN_METADATA_UNMATCHED');
   if(meta.realVueRuntime!==true||meta.contextIsolationConfirmed!==true||meta.figmadirectInspector!==true||meta.hostInputLogComplete!==true)throw Error('HOST_REAL_VUE_FIGMA_ISOLATION_UNVERIFIED');
   if(g==='C'&&meta.agentRuntime!=='NATIVE_PARALLEL')throw Error('C_NOT_ACTUAL_PARALLEL');
   if(!Number.isFinite(meta.durationMs)||meta.durationMs<0)throw Error('RUNTIME_DURATION_MISSING');
   row.durationMs=meta.durationMs;
   row.tokens=await verifiedUsage(ledger,t,g,folder);
   const fin=await parse(path.join(folder,t==='I'?'final-quality.json':'after-quality.json'));
   const actualPath=path.join(folder,'final-runtime.json'),actualBytes=await fs.readFile(actualPath),runtime=JSON.parse(actualBytes.toString('utf8'));
   if(runtime.captureEnvironment!=='REAL_APP_RUNTIME'||JSON.stringify(runtime.viewport)!==JSON.stringify(lock.viewport)||
      runtime.errors?.length||runtime.captureWarnings?.length||runtime.coverageComplete===false)throw Error('NOT_CLEAN_REAL_APP_CAPTURE');
   if(fin.actualSha256!==sha256(actualBytes))throw Error('EVALUATOR_RUNTIME_HASH_MISMATCH');
   row.quality=scoreFidelity(fin,lock);
   if(row.quality.status!=='SCORED')throw Error('FROZEN_150_INDEPENDENT_REPORT_INVALID');
   const context=await parse(path.join(folder,'inbound-context.json'));
   if(g==='A'){row.contamination=auditBaseline(context);if(row.contamination.status!=='NO_LEAK_FOUND_IN_SUBMITTED_LOG')throw Error('BASELINE_INPUT_NOT_CLEAN_OR_MISSING')}
   if(t==='II'){
    const before=await parse(path.join(folder,'before-quality.json')),detected=await parse(path.join(folder,'detected.json'));
    const beforeBytes=await fs.readFile(path.join(folder,'before-runtime.json')),beforeRuntime=JSON.parse(beforeBytes.toString('utf8'));
    if(beforeRuntime.captureEnvironment!=='REAL_APP_RUNTIME'||JSON.stringify(beforeRuntime.viewport)!==JSON.stringify(lock.viewport)||beforeRuntime.errors?.length||beforeRuntime.captureWarnings?.length)throw Error('BEFORE_QA_RUNTIME_INVALID');
    if(before.actualSha256!==sha256(beforeBytes)||before.expectedSha256!==lock.goldSha256||scoreFidelity(before,lock).status!=='SCORED')throw Error('BEFORE_QA_REPORT_UNVERIFIED');
    row.qa=scoreQA(qa,detected,before,fin);
    if(row.qa.status!=='SCORED')throw Error('QA_ASSERTION_EVIDENCE_MISSING');
   }
   row.state=g==='C'&&proof.status!=='PARALLEL_HOST_LOG_RECORDED'?'C_PARALLEL_BLOCKED':'COMPLETE';
  }catch(e){row.state='INCONCLUSIVE';row.reason=String(e.message)}
  report.tracks[t][g]=row;
 }
 report.validity=TRACKS.every(t=>GROUPS.every(g=>report.tracks[t][g].state==='COMPLETE'))&&!errors.length?'EXPLORATORY_SINGLE_RUN':'INCONCLUSIVE';
 report.comparisons={A_vs_B:'Plain baseline versus single skill, within each track',B_vs_C:'Single skill versus actual parallel skill; invalid if C blocked',
   crossVersion:'Comparable only with identical frozen Gold and evaluator commit'};
 await writeJSON(out,report);
 console.log(JSON.stringify({validity:report.validity,errors:report.errors,states:Object.fromEntries(TRACKS.map(t=>[t,Object.fromEntries(GROUPS.map(g=>[g,report.tracks[t][g].state]))]))}));
 if(report.validity!=='EXPLORATORY_SINGLE_RUN')process.exitCode=2;
}
