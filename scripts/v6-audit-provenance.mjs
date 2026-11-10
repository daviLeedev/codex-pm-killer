#!/usr/bin/env node
/** v6.1: Evidence-bound report audit. Does not contact Figma or assert screenshot authenticity. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const argv = process.argv.slice(2);
const opt = (name, fallback) => { const n=argv.indexOf('--'+name); return n<0?fallback:argv[n+1]; };
const workspace = await fs.realpath(path.resolve(opt('workspace',process.cwd())));
const infile = opt('input');
if (!infile) throw Error('Usage: node scripts/v6-audit-provenance.mjs --input .design-qa/page/manifest.json [--workspace .] [--out .design-qa/page/audit-report.json]');
const out = path.resolve(workspace,opt('out','.design-qa/v6.1/audit-report.json'));
const within = p => p===workspace||p.startsWith(workspace+path.sep);
async function artifact(p) {
 if (typeof p!=='string'||!p.trim()||path.isAbsolute(p)) throw Error('Evidence must be workspace-relative: '+p);
 const absolute=await fs.realpath(path.resolve(workspace,p));
 if (!within(absolute)) throw Error('Evidence escapes workspace: '+p);
 const stat=await fs.stat(absolute);
 if (!stat.isFile()||stat.size<1) throw Error('Evidence missing or empty: '+p);
 return absolute;
}
const digest = data => createHash('sha256').update(data).digest('hex');
const parse = async file => JSON.parse(await fs.readFile(file,'utf8'));
const m=await parse(await artifact(infile));
if (m.schemaVersion!==1) throw Error('Invalid audit-manifest schemaVersion');
const blockers=[],followUps=[],checks=[],failures=[],environments=new Map(),evidence=new Map();
function block(code, detail, action) {
 blockers.push({code,detail});
 if (action) followUps.push({code,action});
}
const scope=m.scope||{};
if(!scope.frame||!scope.appRoute||!scope.viewport?.width||!scope.viewport?.height)
 block('SCOPE_INCOMPLETE','Missing frame, appRoute or viewport','Record the verified Figma frame and actual comparison conditions');
if(scope.coverage!=='COMPLETE')block('COVERAGE_PARTIAL','Frame/state inventory incomplete','List uninspected states, then inspect or explicitly narrow the scope');
const goals=new Set(['REAL_APP_VISUAL','LIVE_END_TO_END','FIXTURE_ONLY']);
if(!goals.has(scope.goal))block('SCOPE_GOAL','Unrecognized verification goal','Choose REAL_APP_VISUAL, LIVE_END_TO_END or FIXTURE_ONLY');
const envKinds=new Set(['REAL_APP_RUNTIME','ISOLATED_VUE_FIXTURE','SOURCE_ONLY']);
for(const e of m.environments||[]) {
 if(!e.id||environments.has(e.id)||!envKinds.has(e.kind))block('ENV_INVALID','Invalid or duplicate environment: '+e.id,'Identify each runtime separately');
 else environments.set(e.id,e);
}
if(!environments.size)block('ENV_MISSING','No declared runtime environments','Record actual app, fixture or source-only environment');
const sourceTypes=new Set(['FIGMA_VIEWER','APP_RUNTIME','FIXTURE_RUNTIME','TEST_RUN','ORCHESTRATOR','SOURCE_REVIEW']);
for(const e of m.evidence||[]) {
 if(!e.id||evidence.has(e.id)||!sourceTypes.has(e.source)) {
  block('EVIDENCE_INVALID','Duplicate/invalid evidence ID: '+e.id,'Create unique evidence IDs with source types');continue;
 }
 let measured;
 try { measured=digest(await fs.readFile(await artifact(e.path))); }
 catch(err){ block('EVIDENCE_MISSING',e.id+': '+err.message,'Restore the recorded evidence'); }
 if(!/^[a-f0-9]{64}$/i.test(e.sha256||'')||measured!==e.sha256)
  block('EVIDENCE_HASH',e.id+' has invalid hash or changed bytes','Re-capture and recompute evidence hash');
 if(e.environmentId&&!environments.has(e.environmentId))block('EVIDENCE_ENV',e.id+' has no known environment','Link evidence to runtime inventory');
 evidence.set(e.id,{...e,measured});
}
function ref(id,source,who) {
 const e=evidence.get(id);
 if(!e){block('PROOF_MISSING',who+' missing proof ID '+id,'Attach Figma and actual runtime evidence');return false;}
 if(source&&e.source!==source){block('PROOF_SOURCE',who+': '+id+' expected '+source+' got '+e.source,'Select correctly sourced proof');return false;}
 return !!e.measured&&e.measured===e.sha256;
}
const number=n=>typeof n==='number'&&Number.isFinite(n);
const ids=new Set();
for(const c of m.claims||[]) {
 if(!c.id||ids.has(c.id))block('CLAIM_ID','Duplicate/missing claim ID '+c.id,'Use unique IDs');
 ids.add(c.id);
 const env=environments.get(c.environmentId);
 if(!env){block('CLAIM_ENV',c.id+' has no runtime environment','Supply a measured environment');continue;}
 const appType=env.kind==='REAL_APP_RUNTIME'?'APP_RUNTIME':env.kind==='ISOLATED_VUE_FIXTURE'?'FIXTURE_RUNTIME':'SOURCE_REVIEW';
 if(env.viewport&&scope.viewport&&(env.viewport.width!==scope.viewport.width||env.viewport.height!==scope.viewport.height||env.viewport.deviceScaleFactor!==scope.viewport.deviceScaleFactor))
  block('VIEWPORT_MISMATCH',c.id+' viewport differs from recorded scope','Capture at the same width, height and device scale');
 let trusted=ref(c.appEvidenceId,appType,c.id);
 const appProof=evidence.get(c.appEvidenceId);
 if(appProof?.environmentId&&appProof.environmentId!==c.environmentId){block('CLAIM_PROOF_ENV',c.id+' references evidence from a different runtime','Use evidence from the measured environment');trusted=false;}
 if(c.kind!=='BEHAVIOR')trusted=ref(c.figmaEvidenceId,'FIGMA_VIEWER',c.id)&&trusted;
 if(scope.goal==='REAL_APP_VISUAL'&&env.kind!=='REAL_APP_RUNTIME')
  block('FIXTURE_NOT_REAL_APP',c.id+' was measured in '+env.kind,'Re-run the same assertions on the actual application route');
 if(scope.goal==='LIVE_END_TO_END'&&(env.kind!=='REAL_APP_RUNTIME'||env.apiMode!=='LIVE'))
  block('NOT_LIVE_E2E',c.id+' lacks live app/API evidence','Verify the actual route and API, or narrow the claim');
 let calculated='BLOCKED',delta=null;
 if(number(c.expected)&&number(c.actual)&&number(c.tolerancePx)&&c.tolerancePx>=0){
  delta=Number((c.actual-c.expected).toFixed(4));calculated=Math.abs(delta)<=c.tolerancePx?'PASS':'FAIL';
 } else if(c.kind==='BEHAVIOR'&&typeof c.expectedOutcome==='string'&&typeof c.observedOutcome==='string'){
  calculated=c.expectedOutcome===c.observedOutcome?'PASS':'FAIL';
 }else block('CLAIM_UNMEASURED',c.id+' has no actual comparable values','Supply measured bounds or observed behavior');
 if(c.reportedStatus&&c.reportedStatus!==calculated)block('CLAIM_FALSE_PASS',c.id+' reported '+c.reportedStatus+' but calculated '+calculated,'Correct the claim status');
 if(!trusted)calculated='BLOCKED';
 if(calculated!=='PASS')block('CLAIM_NOT_PASS',c.id+' '+calculated,'Fix and remeasure under the same conditions');
 checks.push({id:c.id,environment:env.kind,status:calculated,expected:c.expected??c.expectedOutcome??null,actual:c.actual??c.observedOutcome??null,delta,figmaEvidenceId:c.figmaEvidenceId??null,appEvidenceId:c.appEvidenceId});
}
if(!checks.length)block('CLAIMS_EMPTY','No actual measured assertions','Provide at least one Figma/app comparison');
const testKinds=new Set(['DESIGN_BASELINE_CONFLICT','DESIGN_MISMATCH','TEST_INFRASTRUCTURE','BEHAVIOR_REGRESSION','UNKNOWN']);
const testIds=new Set();
for(const t of m.tests||[]){
 if(!t.id||testIds.has(t.id))block('TEST_ID','Duplicate/missing test ID '+t.id,'Give each test a stable ID');
 testIds.add(t.id);
 if(!['PASS','FAIL','BLOCKED','SKIPPED'].includes(t.status))block('TEST_STATUS','Unknown test status '+t.id,'Record test status');
 if(t.status!=='PASS'){
  if(!testKinds.has(t.category)||t.category==='UNKNOWN')block('TEST_UNCLASSIFIED',t.id,'Classify as design, infrastructure, baseline or behavior issue');
  if(!t.impact?.trim()||!t.followUp?.trim())block('TEST_TRIAGE_MISSING',t.id,'Record impact and concrete retest action');
  failures.push({id:t.id,category:t.category??'UNKNOWN',status:t.status,impact:t.impact??'',followUp:t.followUp??''});
  block('TEST_FAILED',t.id+' '+t.status,'Resolve and rerun '+t.id+' — '+(t.followUp||'triage required'));
 }
 for(const id of t.evidenceIds||[])ref(id,null,'test '+t.id);
}
if(!m.tests?.length)block('TESTS_EMPTY','No test execution records','Run regression tests and classify any failures');
if(m.baseline?.claim==='IDENTICAL'){
 const a=evidence.get(m.baseline.originalEvidenceId),b=evidence.get(m.baseline.localEvidenceId);
 if(!a||!b||!a.measured||a.measured!==b.measured)
  block('BASELINE_UNPROVEN','Original/local file equality not evidenced by equal SHA-256','Attach both file hashes and compare them');
}
const agents={status:'NOT_EXECUTED',roles:[],independent:false,warning:'Self-reported tool logs cannot authenticate agent identity or viewer access'};
if(m.agentRun?.statePath) {
 try{
  const s=await parse(await artifact(m.agentRun.statePath));
  if(s.schemaVersion!==1||!s.runId||!Array.isArray(s.tasks))throw Error('Invalid orchestrator state.json');
  if(s.scope?.figmaFrame!==scope.frame||s.scope?.appRoute!==scope.appRoute||s.scope?.viewport?.width!==scope.viewport.width||s.scope?.viewport?.height!==scope.viewport.height)
   block('AGENT_SCOPE_MISMATCH','Orchestrator recorded a different frame, route or viewport','Re-run or select evidence for the exact audit scope');
  if(s.final!=='VERIFIED_RECORDED_SCOPE')block('AGENT_FINAL_INCOMPLETE','Orchestrator has not passed its final gate','Run v6 gate rather than substituting report PASS');
  agents.runId=s.runId;
  const roles=['figma','dom','difference','fixer','review','gate'];
  const t=roles.map(id=>s.tasks.find(z=>z.id===id));
  agents.roles=t.map((r,i)=>({role:roles[i],actor:r?.actor??null,status:r?.status??'MISSING',model:r?.model??null,proofCount:r?.evidence?.length??0}));
  agents.independent=Boolean(t[0]?.actor&&t[4]?.actor&&t[0].actor!==t[4].actor&&s.capabilities?.[t[0].actor]?.figmaDirect===true&&s.capabilities?.[t[4].actor]?.figmaDirect===true);
  const recorded=roles.every((role,i)=>s.events?.some(ev=>ev.type==='ASSIGN'&&ev.task===role&&ev.actor===t[i]?.actor)&&s.events?.some(ev=>ev.type==='RECORD'&&ev.task===role&&ev.actor===t[i]?.actor&&ev.status==='DONE'));
  const complete=t.every(z=>z?.status==='DONE'&&z.actor&&z.evidence?.length);
  for(const role of t.filter(Boolean))for(const ev of role.evidence||[]){
   try{if(digest(await fs.readFile(await artifact(ev.path)))!==ev.sha256)block('AGENT_PROOF_HASH',role.id+' evidence changed','Re-run the affected stage');}
   catch(err){block('AGENT_PROOF_MISSING',role.id+': '+err.message,'Restore stage proof');}
  }
  agents.status=complete&&recorded&&agents.independent?'RECORDED_MULTI_AGENT':'INCOMPLETE';
  if(!complete||!recorded)block('AGENTS_INCOMPLETE','Missing assigned/recorded/DONE stage evidence','Execute the absent v6 stages or report fallback mode');
  if(!agents.independent)block('REVIEW_NOT_INDEPENDENT','No distinct directly capable Figma reviewers','Run a second direct Figma audit or remain PARTIAL');
 }catch(err){block('AGENT_LEDGER_INVALID',err.message,'Supply valid local v6 state.json');}
}else block('AGENT_TRACE_MISSING','Skill version does not prove multi-agent execution','Attach v6 state.json or explicitly report single-agent mode');
if(scope.goal==='LIVE_END_TO_END'&&!(m.environments||[]).some(e=>e.kind==='REAL_APP_RUNTIME'&&e.apiMode==='LIVE'))
 block('LIVE_ENV_MISSING','Live runtime/API environment unavailable','Run real service flow in approved environment');
const uniqueFollow=[...new Map(followUps.map(x=>[x.code+'|'+x.action,x])).values()];
const result={schemaVersion:1,createdAt:new Date().toISOString(),status:blockers.length?'PARTIAL':'VERIFIED_RECORDED_SCOPE',scope,
 counts:{claims:checks.length,claimsPassed:checks.filter(c=>c.status==='PASS').length,tests:(m.tests||[]).length,testsFailed:failures.length,blockers:blockers.length},
 agents,checks,failedTests:failures,blockers,followUps:uniqueFollow,
 warning:'This tool validates the declared evidence chain and v6 state only. It cannot prove source authenticity, complete Figma inspection, or real device behavior.'};
if(!within(out))throw Error('Output must stay in workspace');
await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify(result,null,2)+'\n');
const markdown=['# QA Follow-up — '+result.status,'','Evidence and tests remain local to the application workspace.','',...uniqueFollow.map((f,i)=>(i+1)+'. **'+f.code+'** — '+f.action),'','The PASS gate applies only to recorded scope; fixtures do not prove live application behavior.'].join('\n')+'\n';
await fs.writeFile(path.join(path.dirname(out),'FOLLOW_UP.md'),markdown);
console.log(JSON.stringify({status:result.status,counts:result.counts,agentStatus:agents.status,report:out},null,2));
if(result.status!=='VERIFIED_RECORDED_SCOPE')process.exitCode=2;
