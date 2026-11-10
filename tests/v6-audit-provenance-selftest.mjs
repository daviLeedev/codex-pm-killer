#!/usr/bin/env node
/** Synthetic negative fixtures. Never claim these represent live Figma verification. */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const cli=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../scripts/v6-audit-provenance.mjs');
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'pm-v61-'));
const sha=x=>createHash('sha256').update(x).digest('hex');
const write=async(rel,data)=>{const p=path.join(dir,rel);await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,typeof data==='string'?data:JSON.stringify(data));return rel;};
let count=0;
async function run(m){
 await write('manifest.json',m);
 const p=spawnSync(process.execPath,[cli,'--workspace',dir,'--input','manifest.json','--out','output/report.json'],{encoding:'utf8'});
 assert.notEqual(p.status,null,p.stderr);
 const report=JSON.parse(await fs.readFile(path.join(dir,'output/report.json'),'utf8'));
 return {p,report};
}
async function base(){
 const entries=[['figma','FIGMA_VIEWER'],['app','APP_RUNTIME'],['fixture','FIXTURE_RUNTIME'],['test','TEST_RUN'],['source','SOURCE_REVIEW']];
 const evidence=[];
 for(const [id,source] of entries){const data='proof '+id;const file=await write('proof/'+id+'.txt',data);evidence.push({id,source,path:file,sha256:sha(data)});}
 const m={schemaVersion:1,scope:{frame:'Anonymous Frame',appRoute:'http://localhost:5173/demo',viewport:{width:360,height:818},coverage:'COMPLETE',goal:'REAL_APP_VISUAL'},
 environments:[{id:'real',kind:'REAL_APP_RUNTIME',apiMode:'MOCKED'},{id:'fixture',kind:'ISOLATED_VUE_FIXTURE',apiMode:'NONE'}],evidence,
 claims:[{id:'button-height',environmentId:'real',kind:'GEOMETRY',expected:50,actual:50,tolerancePx:1,figmaEvidenceId:'figma',appEvidenceId:'app',reportedStatus:'PASS'}],
 tests:[{id:'smoke',status:'PASS',category:'TEST_INFRASTRUCTURE',evidenceIds:['test']}],
 agentRun:{statePath:'state.json'}};
 const roles=['figma','dom','difference','fixer','review','gate'];
 const tasks=[];const events=[];
 for(const [i,id] of roles.entries()){
  const proof='state-proof-'+id;
  await write('proof/stage-'+id+'.txt',proof);
  const who=['F','D','C','X','R','MAIN'][i];
  tasks.push({id,actor:who,model:'sol',status:'DONE',evidence:[{path:'proof/stage-'+id+'.txt',sha256:sha(proof)}]});
  events.push({type:'ASSIGN',task:id,actor:who},{type:'RECORD',task:id,actor:who,status:'DONE'});
 }
 await write('state.json',{schemaVersion:1,runId:'selftest',scope:{figmaFrame:'Anonymous Frame',appRoute:'http://localhost:5173/demo',viewport:{width:360,height:818}},final:'VERIFIED_RECORDED_SCOPE',tasks,events,capabilities:{F:{figmaDirect:true},R:{figmaDirect:true}}});
 return m;
}
function check(result,status,code){assert.equal(result.report.status,status);assert.equal(result.p.status,status==='PARTIAL'?2:0,result.p.stderr);if(code)assert(result.report.blockers.some(x=>x.code===code),code);count++;}
try{
 let m=await base();check(await run(m),'VERIFIED_RECORDED_SCOPE');
 m=await base();m.claims[0].environmentId='fixture';m.claims[0].appEvidenceId='fixture';check(await run(m),'PARTIAL','FIXTURE_NOT_REAL_APP');
 m=await base();m.claims[0].actual=40;check(await run(m),'PARTIAL','CLAIM_FALSE_PASS');
 m=await base();m.claims[0].actual=40;m.claims[0].reportedStatus='FAIL';check(await run(m),'PARTIAL','CLAIM_NOT_PASS');
 m=await base();m.tests=[{id:'style-16-vs-15',status:'FAIL',category:'DESIGN_BASELINE_CONFLICT',impact:'Unresolved layout baseline',followUp:'Compare latest Figma Properties',evidenceIds:['test']},{id:'missing-jsdom',status:'BLOCKED',category:'TEST_INFRASTRUCTURE',impact:'Tests did not run',followUp:'Install dependency and rerun'}];check(await run(m),'PARTIAL','TEST_FAILED');
 m=await base();m.tests=[{id:'bad',status:'FAIL',category:'UNKNOWN',impact:'',followUp:''}];check(await run(m),'PARTIAL','TEST_UNCLASSIFIED');
 m=await base();m.scope.coverage='PARTIAL';check(await run(m),'PARTIAL','COVERAGE_PARTIAL');
 m=await base();m.agentRun=undefined;check(await run(m),'PARTIAL','AGENT_TRACE_MISSING');
 m=await base();const state=JSON.parse(await fs.readFile(path.join(dir,'state.json'),'utf8'));state.tasks[4].actor='F';await write('state.json',state);check(await run(m),'PARTIAL','REVIEW_NOT_INDEPENDENT');
 m=await base();m.evidence.find(x=>x.id==='app').sha256='a'.repeat(64);check(await run(m),'PARTIAL','EVIDENCE_HASH');
 m=await base();m.scope.goal='LIVE_END_TO_END';check(await run(m),'PARTIAL','NOT_LIVE_E2E');
 m=await base();m.baseline={claim:'IDENTICAL',originalEvidenceId:'source',localEvidenceId:'app'};check(await run(m),'PARTIAL','BASELINE_UNPROVEN');
 m=await base();m.evidence.push({...m.evidence[0]});check(await run(m),'PARTIAL','EVIDENCE_INVALID');
 m=await base();m.claims=[];check(await run(m),'PARTIAL','CLAIMS_EMPTY');
 m=await base();m.tests=[];check(await run(m),'PARTIAL','TESTS_EMPTY');
 m=await base();m.claims[0].appEvidenceId='source';check(await run(m),'PARTIAL','PROOF_SOURCE');
 m=await base();m.environments[0].viewport={width:390,height:844,deviceScaleFactor:1};check(await run(m),'PARTIAL','VIEWPORT_MISMATCH');
 m=await base();m.evidence.find(x=>x.id==='app').environmentId='fixture';check(await run(m),'PARTIAL','CLAIM_PROOF_ENV');
 m=await base();const state2=JSON.parse(await fs.readFile(path.join(dir,'state.json'),'utf8'));state2.final='PENDING';await write('state.json',state2);check(await run(m),'PARTIAL','AGENT_FINAL_INCOMPLETE');
 console.log('PASS v6.1 provenance selftest: '+count+' synthetic scenarios');
}finally{await fs.rm(dir,{recursive:true,force:true});}
