#!/usr/bin/env node
/** Verify host-submitted spawn logs, actual overlap, browser ownership. Timestamps alone do NOT prove real agents. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {parse,hashFile,within,overlap,writeJSON} from './core.mjs';
const a=process.argv.slice(2),arg=k=>{const i=a.indexOf('--'+k);return i<0?null:a[i+1]};
const input=arg('events'),root=arg('evidence-root'),out=arg('out'),minOverlap=Number(arg('min-overlap-ms')??1000);
if(!input||!root||!out||!Number.isFinite(minOverlap)||minOverlap<1)throw Error('Usage: parallel-proof.mjs --events events.json --evidence-root PRIVATE_DIR --out proof.json');
const doc=await parse(input),errors=[],events=doc.events??[];
const starts=new Map(),spawns=new Map(),intervals=[],locks=new Map(),lockIntervals=[];
function tick(e){const t=Date.parse(e.at);if(!Number.isFinite(t))errors.push('BAD_TIMESTAMP');return t}
for(const e of events){
 const t=tick(e);if(!Number.isFinite(t))continue;
 if(e.type==='agent.spawn'){
  if(!e.workerId||!e.sessionId||spawns.has(e.sessionId))errors.push('DUPLICATE_OR_MISSING_AGENT_SPAWN');
  else {
   let proofValid=false;
   try{
    const f=within(root,e.hostLogPath);
    if(!e.hostLogSha256||await hashFile(f)!==e.hostLogSha256)throw Error('SHA_MISMATCH');
    proofValid=true;
   }catch{errors.push('AGENT_HOST_EVIDENCE_MISSING_OR_CHANGED: '+e.sessionId)}
   spawns.set(e.sessionId,{...e,proofValid,t});
  }
 }else if(e.type==='task.start'){
  if(!e.taskId||starts.has(e.taskId))errors.push('DUPLICATE_OR_MISSING_TASK_START');
  starts.set(e.taskId,{...e,t});
 }else if(e.type==='task.end'){
  const s=starts.get(e.taskId);
  if(!s||s.t>=t||s.workerId!==e.workerId||s.sessionId!==e.sessionId)errors.push('INVALID_TASK_INTERVAL: '+e.taskId);
  else intervals.push({taskId:e.taskId,workerId:e.workerId,sessionId:e.sessionId,role:s.role,start:s.t,end:t});
 }else if(e.type==='browser.acquire'){
  if(locks.has(e.browserId))errors.push('BROWSER_OWNER_CONFLICT: '+e.browserId);
  locks.set(e.browserId,{...e,t});
 }else if(e.type==='browser.release'){
  const s=locks.get(e.browserId);
  if(!s||s.workerId!==e.workerId||s.t>=t)errors.push('BROWSER_OWNER_RELEASE_INVALID: '+e.browserId);
  else{lockIntervals.push({owner:s.workerId,start:s.t,end:t});locks.delete(e.browserId)}
 }
}
if(locks.size)errors.push('UNCLOSED_BROWSER_LOCK');
let pair=null;
for(let i=0;i<intervals.length;i++)for(let j=i+1;j<intervals.length;j++){
 const x=intervals[i],y=intervals[j],ms=overlap(x,y);
 if(x.sessionId!==y.sessionId&&x.workerId!==y.workerId&&ms>=minOverlap&&
    spawns.get(x.sessionId)?.proofValid&&spawns.get(y.sessionId)?.proofValid&&
    spawns.get(x.sessionId)?.workerId===x.workerId&&spawns.get(y.sessionId)?.workerId===y.workerId&&
    spawns.get(x.sessionId)?.t<=x.start&&spawns.get(y.sessionId)?.t<=y.start)
  if(!pair||ms>pair.overlapMs)pair={a:x.taskId,b:y.taskId,workers:[x.workerId,y.workerId],sessions:[x.sessionId,y.sessionId],overlapMs:ms};
}
for(let i=0;i<lockIntervals.length;i++)for(let j=i+1;j<lockIntervals.length;j++)
 if(lockIntervals[i].owner!==lockIntervals[j].owner&&overlap(lockIntervals[i],lockIntervals[j]))errors.push('OVERLAPPING_FIGMA_BROWSER_OWNERS');
if(!pair)errors.push('NO_ATTESTED_CONCURRENT_INDEPENDENT_SESSIONS');
const result={schemaVersion:1,status:errors.length?'C_PARALLEL_BLOCKED':'PARALLEL_HOST_LOG_RECORDED',parallelPair:pair,spawnCount:spawns.size,completedTasks:intervals.length,errors,
 caveat:'Hashed host logs and overlapping timestamps are recorded evidence, not independent proof of real remote model execution. Human/host attestation is still required.'};
await writeJSON(out,result);console.log(JSON.stringify(result));if(errors.length)process.exitCode=2;
