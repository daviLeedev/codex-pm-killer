#!/usr/bin/env node
/** Pure + end-to-end CLI synthetic rehearsal. No paid APIs, Figma or real model calls. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {scoreQA,scoreFidelity,auditBaseline,validateBudget} from '../benchmarks/v6.3.3/grade.mjs';
import {treeHash,hashFile} from '../benchmarks/v6.3.3/core.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=await fs.mkdtemp(path.join(os.tmpdir(),'pmk-v633-'));
const cli=(script,args)=>spawnSync(process.execPath,[path.join(root,script),...args],{encoding:'utf8',timeout:40000});
const hash=x=>createHash('sha256').update(x).digest('hex');
let n=0;
try{
 const pI=path.join(dir,'initial'),pII=path.join(dir,'faulty');await fs.mkdir(pI);await fs.mkdir(pII);
 await fs.writeFile(path.join(pI,'index.html'),'<main>clean initial Vue skeleton</main>');
 await fs.writeFile(path.join(pII,'index.html'),'<main>independent QA fixture skeleton</main>');
 await fs.writeFile(path.join(pI,'.env'),'SECRET_NEVER_COPY');
 const counts={width:40,gap:10,padding_top:20,font:30,fill:15,text:10,asset_kind:15,child_count:10};
 const checks=[];for(const [property,count] of Object.entries(counts))for(let i=0;i<count;i++)checks.push({id:'test-'+checks.length,property,expected:'fixture',source:'FIGMA_UI_MEASURED'});
 assert.equal(checks.length,150);n++;
 const gold={schemaVersion:1,status:'FROZEN_VERIFIED',viewport:{width:375,height:1069},layers:[{id:'Home',required:true,checks}]};
 const goldFile=path.join(dir,'gold.json');await fs.writeFile(goldFile,JSON.stringify(gold));
 const qaGold={mutatedIds:checks.slice(0,20).map(x=>x.id),controlIds:checks.slice(20,40).map(x=>x.id)};
 const qaFile=path.join(dir,'qa-gold.json');await fs.writeFile(qaFile,JSON.stringify(qaGold));
 const asset=path.join(dir,'asset.json');await fs.writeFile(asset,'{"assets":[]}');
 const goldLockFile=path.join(dir,'gold-lock.json'),assetLockFile=path.join(dir,'asset-lock.json'),readyFile=path.join(dir,'readiness.json');
 const goldSha=await hashFile(goldFile),assetSha=await hashFile(asset);
 await fs.writeFile(goldLockFile,JSON.stringify({status:'FROZEN_RECORDED_EVIDENCE',truthSha256:goldSha,assertions:150,unknown:[],problems:[]}));
 await fs.writeFile(assetLockFile,JSON.stringify({status:'READY',manifestSha256:assetSha,issues:[]}));
 await fs.writeFile(readyFile,JSON.stringify({status:'READY_WITH_SUBSTITUTES',truthSha256:goldSha,packSha256:assetSha,approvedCapUsd:10}));
 const plan={schemaVersion:1,runId:'algolia-home-v633-test-01',scope:'Algolia-Mobile-Home',figmaUrl:'https://www.figma.com/community/file/981543186947734892',
  task:'Reproduce the mobile Home only with the same tools and assets.',inputs:{implementationProject:'initial',qaFaultyProject:'faulty',
   goldTruth:'gold.json',qaGold:'qa-gold.json',assetManifest:'asset.json',goldLock:'gold-lock.json',assetLock:'asset-lock.json',readinessReport:'readiness.json'},
  models:{A:'test-model',B:'test-model',C:'test-model'},reasoning:'low',viewport:{width:375,height:1069},
  approvedCapUsd:10,skillCommit:'a'.repeat(40),evaluatorCommit:'b'.repeat(40),protocolVersion:'3.0.0',browserVersion:'test-chromium'};
 const planFile=path.join(dir,'plan.json'),out=path.join(dir,'run');await fs.writeFile(planFile,JSON.stringify(plan));
 let r=cli('benchmarks/v6.3.3/prepare.mjs',['--plan',planFile,'--out',out]);assert.equal(r.status,0,r.stderr);n++;
 const lock=JSON.parse(await fs.readFile(path.join(out,'private-plan-lock.json'),'utf8'));
 assert.equal(lock.goldPropertyGroups.spacing,30);assert.equal(lock.goldPropertyGroups.asset,15);n+=2;
 for(const t of ['I','II']){
  const vals=[];
  for(const g of ['A','B','C']){
   const d=path.join(out,'work','track-'+t,g);vals.push(await treeHash(d));
   await assert.rejects(fs.access(path.join(d,'.env')));n++;
  }
  assert.equal(new Set(vals).size,1);assert.equal(vals[0],lock.sourceHashes[t]);n+=2;
 }
 const promptA=await fs.readFile(path.join(out,'prompts','I-A.txt'),'utf8');
 const promptB=await fs.readFile(path.join(out,'prompts','I-B.txt'),'utf8');
 assert(!/SKILL\.md|codex-pm-killer/i.test(promptA));assert(/codex-pm-killer/i.test(promptB));n+=2;
 r=cli('benchmarks/v6.3.3/prepare.mjs',['--plan',planFile,'--out',out]);assert.notEqual(r.status,0);n++;
 const wrong=path.join(dir,'wrong.json');await fs.writeFile(wrong,JSON.stringify({...plan,task:'Read SKILL.md first'}));
 r=cli('benchmarks/v6.3.3/prepare.mjs',['--plan',wrong,'--out',path.join(dir,'wrong-run')]);assert.notEqual(r.status,0);n++;
 const endChecks=checks.map(x=>({id:x.id,status:'MATCH'}));
 const startChecks=checks.map((x,i)=>({id:x.id,status:i<20?'MISMATCH':'MATCH'}));
 const q=(rows,actual)=>({status:'MISMATCH',expectedSha256:lock.goldSha256,actualSha256:actual,
  scopeErrors:[],counts:{MATCH:rows.filter(x=>x.status==='MATCH').length,MISMATCH:rows.filter(x=>x.status==='MISMATCH').length,NOT_EVALUABLE:0},checks:rows});
 const runtime={captureEnvironment:'REAL_APP_RUNTIME',viewport:lock.viewport,errors:[],captureWarnings:[],coverageComplete:true,regions:[{id:'Home',visible:true}]};
 const bytes=Buffer.from(JSON.stringify(runtime)),actual=hash(bytes);
 const beforeQ=q(startChecks,actual),afterQ=q(endChecks,actual);
 assert.equal(scoreFidelity(afterQ,lock).status,'SCORED');n++;
 assert.equal(scoreFidelity({...afterQ,expectedSha256:'f'.repeat(64)},lock).status,'INCONCLUSIVE');n++;
 const detected={issues:[...qaGold.mutatedIds.slice(0,18),qaGold.controlIds[0]],attemptedFixIds:qaGold.mutatedIds.slice(0,10)};
 const metrics=scoreQA(qaGold,detected,beforeQ,afterQ);
 assert.equal(metrics.tp,18);assert.equal(metrics.fp,1);assert.equal(metrics.fn,2);assert.equal(metrics.confirmedFixes,20);
 assert.equal(metrics.regressions,0);n+=5;
 assert.equal(scoreQA(qaGold,detected,afterQ,afterQ).status,'INCONCLUSIVE');n++;
 assert.equal(auditBaseline([{role:'user',content:'Please implement mobile Home'}]).status,'NO_LEAK_FOUND_IN_SUBMITTED_LOG');n++;
 assert.equal(auditBaseline([{role:'tool',content:'Found SKILL.md with instructions'}]).status,'CONTAMINATED');n++;
 const logdir=path.join(dir,'hostlogs');await fs.mkdir(logdir);
 const proofs={};
 for(const id of ['w1','w2']){
  const f=path.join(logdir,id+'.log');await fs.writeFile(f,'native-host-agent-'+id);
  proofs[id]={file:id+'.log',sha:await hashFile(f)};
 }
 const at=i=>new Date(Date.UTC(2026,10,13,0,0,i)).toISOString();
 const events=[];
 for(const id of ['w1','w2'])events.push({type:'agent.spawn',workerId:id,sessionId:id+'-native-session',hostLogPath:proofs[id].file,hostLogSha256:proofs[id].sha,at:at(0)});
 for(const t of ['I','II']){
  const offset=t==='I'?2:20;
  for(const [j,id] of ['w1','w2'].entries()){
   events.push({type:'task.start',track:t,taskId:t+'-'+id,workerId:id,sessionId:id+'-native-session',role:j?'DOM Inspector':'Figma Inspector',at:at(offset+j)});
   events.push({type:'task.end',track:t,taskId:t+'-'+id,workerId:id,sessionId:id+'-native-session',at:at(offset+j+5)});
  }
 }
 events.push({type:'browser.acquire',browserId:'figma',workerId:'w1',at:at(1)});
 events.push({type:'browser.release',browserId:'figma',workerId:'w1',at:at(9)});
 const evFile=path.join(dir,'events.json'),proofFile=path.join(dir,'proof.json');
 await fs.writeFile(evFile,JSON.stringify({events}));
 r=cli('benchmarks/v6.3.3/parallel-proof.mjs',['--events',evFile,'--evidence-root',logdir,'--out',proofFile]);
 assert.equal(r.status,0,r.stderr);n++;
 const parallel=JSON.parse(await fs.readFile(proofFile,'utf8'));
 assert.equal(parallel.status,'PARALLEL_HOST_LOG_RECORDED');
 assert(parallel.parallelPairs.I&&parallel.parallelPairs.II);n+=2;
 const singleTrack=events.filter(e=>!e.taskId?.startsWith('II-'));
 await fs.writeFile(evFile,JSON.stringify({events:singleTrack}));
 const failedProof=path.join(dir,'failed-proof.json');
 r=cli('benchmarks/v6.3.3/parallel-proof.mjs',['--events',evFile,'--evidence-root',logdir,'--out',failedProof]);
 assert.notEqual(r.status,0);n++;
 const ledger={schemaVersion:1,capMicro:10000000,requests:[]};
 for(const t of ['I','II'])for(const g of ['A','B','C']){
  const requestId=t+'-'+g+'-1';
  const usage={requestId,model:'test-model',inputTokens:1000,outputTokens:200,cachedInputTokens:100,reasoningOutputTokens:50};
  const usageBytes=Buffer.from(JSON.stringify(usage));
  ledger.requests.push({id:requestId,model:'test-model',state:'SETTLED',actualMicro:100000,rawSha256:'e'.repeat(64),usageSha256:hash(usageBytes)});
  const d=path.join(out,'evidence','track-'+t,g);await fs.mkdir(d,{recursive:true});
  await fs.mkdir(path.join(d,'usage'));
  await fs.writeFile(path.join(d,'usage',encodeURIComponent(requestId)+'.json'),usageBytes);
  const meta={initialProjectSha256:lock.sourceHashes[t],model:'test-model',reasoning:'low',completed:true,realVueRuntime:true,contextIsolationConfirmed:true,figmadirectInspector:true,hostInputLogComplete:true,durationMs:1000,
   ...(g==='C'?{agentRuntime:'NATIVE_PARALLEL'}:{})};
  await fs.writeFile(path.join(d,'run.json'),JSON.stringify(meta));
  await fs.writeFile(path.join(d,'inbound-context.json'),JSON.stringify([{role:'user',content:'Implement Home and self-review'}]));
  await fs.writeFile(path.join(d,'final-runtime.json'),bytes);
  await fs.writeFile(path.join(d,t==='I'?'final-quality.json':'after-quality.json'),JSON.stringify(afterQ));
  if(t==='II'){
   await fs.writeFile(path.join(d,'before-runtime.json'),bytes);
   await fs.writeFile(path.join(d,'before-quality.json'),JSON.stringify(beforeQ));
   await fs.writeFile(path.join(d,'detected.json'),JSON.stringify(detected));
  }
 }
 assert.equal(validateBudget(ledger,lock).status,'RECORDED_POLICY_CONSISTENT');n++;
 const ledgerFile=path.join(dir,'ledger.json');await fs.writeFile(ledgerFile,JSON.stringify(ledger));
 const gradeFile=path.join(dir,'graded.json');
 const params=['--run',out,'--qa-gold',qaFile,'--ledger',ledgerFile,'--parallel-proof',proofFile,'--out',gradeFile];
 r=cli('benchmarks/v6.3.3/grade.mjs',params);
 assert.equal(r.status,0,r.stderr+' '+r.stdout);n++;
 const report=JSON.parse(await fs.readFile(gradeFile,'utf8'));
 assert.equal(report.validity,'EXPLORATORY_SINGLE_RUN');assert.equal(report.tracks.II.B.qa.tp,18);assert.equal(report.tracks.I.A.tokens.inputTokens,1000);n+=3;
 const repeat2=path.join(dir,'graded2.json'),repeat3=path.join(dir,'graded3.json');
 await fs.writeFile(repeat2,JSON.stringify({...report,runId:report.runId+'-02'}));
 await fs.writeFile(repeat3,JSON.stringify({...report,runId:report.runId+'-03'}));
 const aggregated=path.join(dir,'aggregate.json');
 r=cli('benchmarks/v6.3.3/aggregate.mjs',['--report',gradeFile,'--report',repeat2,'--report',repeat3,'--out',aggregated]);
 assert.equal(r.status,0,r.stderr);n++;
 let multi=JSON.parse(await fs.readFile(aggregated,'utf8'));
 assert.equal(multi.status,'REPEATED_DESCRIPTIVE');assert.equal(multi.pairedDelta.I['B-A']['quality.match'].n,3);n+=2;
 const publicEntry=path.join(dir,'public-draft.json');
 r=cli('benchmarks/v6.3.3/history-entry.mjs',['--graded',gradeFile,'--out',publicEntry]);
 assert.equal(r.status,0,r.stderr);n++;
 r=cli('benchmarks/history/validate.mjs',[publicEntry]);assert.equal(r.status,0,r.stderr+' '+r.stdout);n++;
 await fs.writeFile(repeat3,JSON.stringify({...report,runId:report.runId+'-03',goldSha256:'0'.repeat(64)}));
 r=cli('benchmarks/v6.3.3/aggregate.mjs',['--report',gradeFile,'--report',repeat2,'--report',repeat3,'--out',path.join(dir,'bad-aggregate.json')]);
 assert.notEqual(r.status,0);n++;
 await fs.writeFile(path.join(out,'evidence','track-I','A','inbound-context.json'),JSON.stringify([{role:'tool',content:'read SKILL.md'}]));
 await fs.rm(gradeFile);
 r=cli('benchmarks/v6.3.3/grade.mjs',params);
 assert.notEqual(r.status,0);n++;
 const contaminated=JSON.parse(await fs.readFile(gradeFile,'utf8'));
 assert.equal(contaminated.tracks.I.A.state,'INCONCLUSIVE');n++;
 console.log('PASS v6.3.3 benchmark protocol, workspace isolation, QA metrics, parallel evidence and grader: '+n+' assertions');
}finally{await fs.rm(dir,{recursive:true,force:true})}
