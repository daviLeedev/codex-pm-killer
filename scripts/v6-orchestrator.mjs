#!/usr/bin/env node
/**
 * Evidence-oriented multi-agent coordinator. Does NOT spawn models, access Figma,
 * or charge credits: the host Codex session performs those actions explicitly.
 * CommonJS-free, dependencies limited to Node 22 built-ins.
 */
import fs from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const SCRIPT_DIR=path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONFIG=path.resolve(SCRIPT_DIR,'../config/v6-balanced.json');
const TASKS=[
 {id:'figma',role:'figma',dependsOn:[]},
 {id:'dom',role:'dom',dependsOn:[]},
 {id:'difference',role:'difference',dependsOn:['figma','dom']},
 {id:'fixer',role:'fixer',dependsOn:['difference']},
 {id:'review',role:'review',dependsOn:['fixer']},
 {id:'gate',role:'gate',dependsOn:['review']}
];
const ARG=process.argv.slice(2),command=ARG.shift();
function option(name,fallback=null){let i=ARG.indexOf('--'+name);return i<0?fallback:ARG[i+1]}
function requireOpt(n){const v=option(n);if(!v||v.startsWith('--'))throw Error('Missing --'+n);return v}
function assert(x,msg){if(!x)throw Error(msg)}
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
async function write(p,data){await fs.mkdir(path.dirname(p),{recursive:true});const tmp=p+'.'+randomUUID()+'.tmp';await fs.writeFile(tmp,JSON.stringify(data,null,2)+'\n');await fs.rename(tmp,p)}
async function within(root,p){const full=path.resolve(root,p);assert(full.startsWith(root+path.sep),'Evidence outside workspace: '+p);const s=await fs.stat(full);assert(s.isFile()&&s.size>0,'Missing/empty evidence: '+p);return {path:p,sha256:createHash('sha256').update(await fs.readFile(full)).digest('hex'),bytes:s.size}}
const work=path.resolve(option('workspace',process.cwd())),qa=path.resolve(option('state',path.join(work,'.design-qa','v6'))),statePath=path.join(qa,'state.json'),mutex=path.join(qa,'.state-lock'),browserPath=path.join(qa,'browser-lease.json');
assert(qa===work||qa.startsWith(work+path.sep),'State must stay inside workspace');
async function transaction(callback){await fs.mkdir(qa,{recursive:true});let ok=false;for(let i=0;i<35;i++){try{await fs.mkdir(mutex);ok=true;break}catch(e){if(e.code!=='EEXIST')throw e;await new Promise(r=>setTimeout(r,25))}}
 assert(ok,'State lock busy: no automatic stale-lock takeover');try{return await callback()}finally{await fs.rmdir(mutex)}}
async function load(){const s=await read(statePath);assert(s.schemaVersion===1,'Unsupported state');return s}
function activeCount(s){return s.tasks.filter(t=>t.status==='ACTIVE').length}
function used(s){return s.usage.reduce((n,x)=>n+x.units,0)}
function reserved(s){return s.tasks.filter(t=>t.status==='ACTIVE').reduce((n,t)=>n+t.reservation,0)}
function failPolicy(s){return {limit:s.policy.budget.maxAbstractUnits,spent:used(s),reserved:reserved(s),remaining:s.policy.budget.maxAbstractUnits-used(s)-reserved(s)}}
function requiredTask(s,id){const t=s.tasks.find(x=>x.id===id);assert(t,'Unknown task '+id);return t}
function isReady(s,t){return t.status==='PENDING'&&t.dependsOn.every(x=>requiredTask(s,x).status==='DONE')}
function family(model){return /astra/i.test(model)?'Astra':/luna/i.test(model)?'Luna':/sol/i.test(model)?'Sol':'unknown'}
async function browserLease(){try{return await read(browserPath)}catch(e){if(e.code==='ENOENT')return null;throw e}}
function ensureDirect(s,agent){const c=s.capabilities[agent];assert(c&&c.figmaDirect===true&&c.evidenceRef,'Agent '+agent+' has not proven direct Figma browser capability')}
function ensureBrowser(lease,agent,s){assert(lease&&lease.actor===agent&&lease.runId===s.runId,'Figma browser lease not owned by '+agent)}
function append(s,type,payload){s.events.push({seq:s.events.length+1,type,at:new Date().toISOString(),...payload})}
function summarize(s){return {runId:s.runId,policy:s.policy.name,concurrency:{active:activeCount(s),max:s.policy.maxConcurrentWorkers},budget:failPolicy(s),tasks:s.tasks.map(({id,status,actor,model,attempts})=>({id,status,actor,model,attempts})),ready:s.tasks.filter(x=>isReady(s,x)).map(x=>x.id),final:s.final}}
const OUTPUT=(o)=>console.log(JSON.stringify(o,null,2));
try{
 if(command==='init'){
  const cfg=await read(path.resolve(option('config',DEFAULT_CONFIG)));
  const scopeEvidence=await within(work,requireOpt('scope'));const scope=await read(path.resolve(work,scopeEvidence.path));
  assert(scope.figmaFrame&&scope.appRoute&&scope.viewport?.width>0&&scope.viewport?.height>0&&scope.baselineContentSha256,'Scope needs frame, route, viewport and baseline content SHA');
  assert(cfg.schemaVersion===1&&cfg.maxConcurrentWorkers>0&&cfg.budget.maxAbstractUnits>0,'Bad policy');
  await transaction(async()=>{try{await fs.access(statePath);throw Error('Existing v6 run; use a new --state or archive previous run')}catch(e){if(e.code!=='ENOENT')throw e}
   const s={schemaVersion:1,runId:randomUUID(),workspace:work,scope,scopeEvidence,createdAt:new Date().toISOString(),policy:cfg,capabilities:{},usage:[],events:[],final:'PENDING',tasks:TASKS.map(x=>({...x,status:'PENDING',actor:null,model:null,attempts:0,reservation:0,evidence:[]}))};await write(statePath,s);OUTPUT(summarize(s))});
 }else if(command==='capability'){
  await transaction(async()=>{const s=await load(),actor=requireOpt('actor'),figma=option('figma')==='true',evidenceRef=requireOpt('evidence');const e=await within(work,evidenceRef);s.capabilities[actor]={figmaDirect:figma,domRuntime:option('dom')==='true',evidenceRef:e.path,evidenceSha:e.sha256,reportedAt:new Date().toISOString()};append(s,'CAPABILITY',{actor,figma});await write(statePath,s);OUTPUT(s.capabilities[actor])});
 }else if(command==='browser'){
  await transaction(async()=>{const s=await load(),op=requireOpt('action'),actor=requireOpt('actor');if(op==='acquire'){
   ensureDirect(s,actor);assert(!await browserLease(),'Browser already owned; no concurrent Figma tab interaction');const lease={runId:s.runId,actor,nonce:randomUUID(),acquiredAt:new Date().toISOString()};await fs.writeFile(browserPath,JSON.stringify(lease,null,2)+'\n',{flag:'wx'});append(s,'BROWSER_ACQUIRE',{actor});await write(statePath,s);OUTPUT(lease);
  }else if(op==='release'){
   const lease=await browserLease();assert(lease&&lease.actor===actor&&lease.nonce===requireOpt('nonce'),'Browser release requires original owner and lease nonce');await fs.unlink(browserPath);append(s,'BROWSER_RELEASE',{actor});await write(statePath,s);OUTPUT({released:true});
  }else if(op==='recover'){
   assert(option('confirmed')==='true','Explicit human-confirmed recovery required');const e=await within(work,requireOpt('evidence'));assert(e,'Recovery evidence required');const lease=await browserLease();assert(lease,'No lease to recover');await fs.unlink(browserPath);append(s,'BROWSER_RECOVER',{actor,previousOwner:lease.actor,record:e});await write(statePath,s);OUTPUT({recovered:true,previousOwner:lease.actor});
  }else throw Error('browser action acquire|release|recover')});
 }else if(command==='assign'){
  await transaction(async()=>{const s=await load(),t=requiredTask(s,requireOpt('task')),actor=requireOpt('actor'),model=requireOpt('model');assert(isReady(s,t),'Task not ready / predecessor evidence unresolved');assert(activeCount(s)<s.policy.maxConcurrentWorkers,'Concurrent worker limit reached');
   if(t.role==='figma'||t.role==='review'){ensureDirect(s,actor);ensureBrowser(await browserLease(),actor,s)}
   if(t.role==='review'){const first=requiredTask(s,'figma');assert(actor!==first.actor,'Independent reviewer cannot be original Figma inspector')}
   if(t.role==='fixer'){assert(option('allow-edit')==='true','Only fixer may edit application; explicit --allow-edit true required')}
   if(family(model)==='Astra'){assert(!s.policy.budget.humanApprovalForAstra,'Astra requires external user approval; policy deliberately does not self-approve')}
   const estimate=s.policy.budget.estimatedTaskUnits[t.id];assert(Number.isFinite(estimate)&&estimate>0,'No stage budget estimate');assert(failPolicy(s).remaining>=estimate,'Budget limit exceeded; no dispatch');
   t.status='ACTIVE';t.actor=actor;t.model=model;t.startedAt=new Date().toISOString();t.reservation=estimate;t.attempts++;append(s,'ASSIGN',{task:t.id,actor,model,reserved:estimate});await write(statePath,s);OUTPUT({task:t.id,actor,model,estimate,dependencies:t.dependsOn,capabilities:s.capabilities[actor]??null,warning:'Host must explicitly spawn actual Codex agent; this CLI is coordination only'})});
 }else if(command==='record'){
  await transaction(async()=>{const s=await load(),t=requiredTask(s,requireOpt('task')),actor=requireOpt('actor');assert(t.status==='ACTIVE'&&t.actor===actor,'Only assigned active agent can record');const input=await within(work,requireOpt('input')),data=await read(path.resolve(work,input.path));assert(data.schemaVersion===1&&data.runId===s.runId&&data.role===t.role&&data.actor===actor,'Invalid evidence contract identity');assert(['PASS','PARTIAL','BLOCKED'].includes(data.status),'Result needs explicit status');assert(data.scope&&data.scope.figmaFrame===s.scope.figmaFrame&&data.scope.appRoute===s.scope.appRoute&&data.scope.viewport?.width===s.scope.viewport.width&&data.scope.viewport?.height===s.scope.viewport.height&&data.scope.viewport?.deviceScaleFactor===s.scope.viewport.deviceScaleFactor&&data.scope.baselineContentSha256===s.scope.baselineContentSha256,'Result scope/viewport/copy differs from baseline');assert(Array.isArray(data.artifacts)&&data.artifacts.length,'Result missing artifacts');let checked=[];for(const f of data.artifacts)checked.push(await within(work,f));
   if(t.role==='figma'||t.role==='review'){ensureDirect(s,actor);ensureBrowser(await browserLease(),actor,s);assert(data.figmaDirect===true&&data.figmaSource==='FIGMA_UI_OBSERVED','Requires direct Figma viewer observations')}
   if(t.role==='dom')assert(data.appSource==='APP_RUNTIME_MEASURED'&&s.capabilities[actor]?.domRuntime===true,'Real runtime DOM source required');
   if(t.role==='difference')assert(data.crossChecked===true&&data.sourceTasks?.includes('figma')&&data.sourceTasks?.includes('dom'),'Difference result needs both input sources');
   if(t.role==='fixer')assert(Array.isArray(data.changedFiles)&&Array.isArray(data.regressionTests),'Fixer must record source changes and regressions');
   if(t.role==='review'){assert(data.independent===true&&data.originalInspector===requiredTask(s,'figma').actor&&data.originalInspector!==actor,'Second inspection must be distinct and directly observed');assert(Array.isArray(data.newlyFoundRegions),'Second pass must declare discovered differences')}
   if(t.role==='gate'){
    assert(data.discrepanciesResolved===true,'Open discrepancies forbid final PASS');
    const reports=data.reportPaths;assert(reports&&reports.v4&&reports.v5&&reports.independent,'Gate must name real v4/v5/independent report paths');
    const verifiedReports=[];for(const key of ['v4','v5','independent']){
      const e=await within(work,reports[key]),j=await read(path.resolve(work,e.path));
      const expected=key==='independent'?'INDEPENDENT_AGREEMENT':'VERIFIED_RECORDED_SCOPE';
      assert(j.status===expected&&!(j.errors?.length)&&!(j.problems?.length)&&!(j.onlyFirst?.length)&&!(j.onlySecond?.length),'Gate report '+key+' is not verified');verifiedReports.push(e);
    }
    checked.push(...verifiedReports);
   }
   const units=option('units')==null?t.reservation:Number(option('units'));assert(Number.isFinite(units)&&units>=0,'Invalid reported work units');assert(used(s)+units<=s.policy.budget.maxAbstractUnits,'Cost cap would be exceeded');
   t.status=data.status==='PASS'?'DONE':data.status;t.evidence=[input,...checked];t.completedAt=new Date().toISOString();t.reservation=0;t.reportedUnits=units;s.usage.push({task:t.id,actor,units,kind:option('units')==null?'ESTIMATED':'REPORTED_NOT_BILLED'});append(s,'RECORD',{task:t.id,actor,status:t.status,units});if(t.role==='gate'&&t.status==='DONE')s.final='VERIFIED_RECORDED_SCOPE';await write(statePath,s);OUTPUT({task:t.id,status:t.status,attachments:checked.length,budget:failPolicy(s)})});
 }else if(command==='retry'){
  await transaction(async()=>{const s=await load(),t=requiredTask(s,requireOpt('task'));assert(['PARTIAL','BLOCKED'].includes(t.status),'Retry is only for unresolved tasks');assert(t.attempts<s.policy.escalation.maxRetriesPerTask,'Retry budget exhausted; escalate for human review');assert(!s.tasks.some(x=>x.dependsOn.includes(t.id)&&x.status!=='PENDING'),'Cannot retry a task after downstream work');t.status='PENDING';t.actor=null;t.model=null;t.reservation=0;append(s,'RETRY',{task:t.id,reason:requireOpt('reason')});await write(statePath,s);OUTPUT({task:t.id,status:'PENDING',attempts:t.attempts})});
 }else if(command==='escalate'){
  await transaction(async()=>{const s=await load(),t=requiredTask(s,requireOpt('task')),reason=requireOpt('reason');assert(t.status==='PARTIAL'||t.status==='BLOCKED','Escalate only unresolved work');const target=option('target','Sol-high');const approved=false;append(s,'ESCALATION_PROPOSAL',{task:t.id,reason,target,approved});await write(statePath,s);OUTPUT({task:t.id,target,approved,recommendation:'Human must approve Astra/model change outside this script. Do not respawn automatically.',budget:failPolicy(s)})});
 }else if(command==='status'||command==='gate'){
  const s=await load();const report=summarize(s);if(command==='gate'){const all=s.tasks.every(t=>t.status==='DONE'),pendingBrowser=!!await browserLease();report.verified=all&&s.final==='VERIFIED_RECORDED_SCOPE'&&!pendingBrowser;report.failures=[...s.tasks.filter(x=>x.status!=='DONE').map(x=>x.id+': '+x.status),...(pendingBrowser?['Figma browser lease still active']:[])];process.exitCode=report.verified?0:1}OUTPUT(report);
 }else{
  console.log('Usage: v6-orchestrator.mjs init|capability|browser|assign|record|escalate|status|gate --workspace PATH [--state PATH]');process.exitCode=2
 }
}catch(e){console.error('V6_FAIL:',e.message);process.exitCode=1}
