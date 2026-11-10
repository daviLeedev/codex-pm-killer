#!/usr/bin/env node
/** Strict synthetic mutation tests for the v6 orchestration, locks, budget and evidence contracts. */
import {mkdtemp,writeFile,readFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),cli=path.join(root,'scripts/v6-orchestrator.mjs');
const contextCli=path.join(root,'scripts/v6-context.mjs');
const tmp=await mkdtemp(path.join(tmpdir(),'pmv6-')),qa=path.join(tmp,'.design-qa/v6');let checks=0;
const scope={figmaFrame:'Terms Modal',appRoute:'http://localhost:5173/terms',viewport:{width:400,height:844,deviceScaleFactor:1},baselineContentSha256:'a'.repeat(64)};
async function fixture(name,body){const p=path.join(qa,name);await mkdir(path.dirname(p),{recursive:true});await writeFile(p,typeof body==='string'?body:JSON.stringify(body,null,2));return '.design-qa/v6/'+name}
function cmd(...args){const r=spawnSync(process.execPath,[cli,args[0],'--workspace',tmp,...args.slice(1)],{encoding:'utf8'});return {ok:r.status===0,out:r.stdout,err:r.stderr,code:r.status}}
function ok(r,why){assert(r.ok,why+' '+r.err);checks++}
function rejected(r,why){assert(!r.ok,why);checks++}
try{
 await fixture('scope.json',scope);ok(cmd('init','--scope','.design-qa/v6/scope.json'),'Initialize run');
 const state=JSON.parse(await readFile(path.join(qa,'state.json'),'utf8')),runId=state.runId;
 const ctx=(...args)=>{const r=spawnSync(process.execPath,[contextCli,args[0],'--workspace',tmp,...args.slice(1)],{encoding:'utf8'});return {ok:r.status===0,out:r.stdout,err:r.stderr,code:r.status}};
 ok(ctx('init'),'Initialize role-scoped context');
 const pack=task=>ok(ctx('pack','--task',task),'Build context pack '+task);
 pack('figma');pack('dom');
 ok(cmd('status'),'Report status');
 rejected(cmd('assign','--task','difference','--actor','analyst','--model','sol'),'Prevent early comparison');
 for(const [actor,figma,dom] of [['A',true,false],['B',false,true],['E',true,false]]){
  await fixture(actor+'-cap.txt','Real capability must be verified in live tests; synthetic selftest only.');
  ok(cmd('capability','--actor',actor,'--figma',String(figma),'--dom',String(dom),'--evidence','.design-qa/v6/'+actor+'-cap.txt'),'Store capability');
 }
 rejected(cmd('assign','--task','figma','--actor','B','--model','sol'),'Deny Figma to non-Figma agent');
 rejected(cmd('assign','--task','figma','--actor','A','--model','astra'),'Block Astra');
 rejected(cmd('assign','--task','figma','--actor','A','--model','sol'),'Reject missing browser lease');
 const lease=cmd('browser','--action','acquire','--actor','A');ok(lease,'Acquire browser A');const nonce=JSON.parse(lease.out).nonce;
 rejected(cmd('browser','--action','acquire','--actor','E'),'Deny simultaneous browser owners');
 rejected(cmd('browser','--action','release','--actor','E','--nonce',nonce),'Deny foreign release');
 ok(cmd('assign','--task','figma','--actor','A','--model','sol'),'Dispatch A');
 ok(cmd('assign','--task','dom','--actor','B','--model','luna'),'Dispatch B in parallel');
 rejected(cmd('assign','--task','difference','--actor','analyst','--model','sol'),'Check worker cap/dependencies');
 async function record(task,actor,extra={},contractScope=scope){
  const evidence=await fixture(task+'-proof.txt','Real observations require live app and Figma. Synthetic here.');
  const data={schemaVersion:1,runId,scope:contractScope,role:task,actor,status:'PASS',artifacts:[evidence],...extra};
  await fixture(task+'-report.json',data);
  return cmd('record','--task',task,'--actor',actor,'--input','.design-qa/v6/'+task+'-report.json');
 }
 rejected(await record('figma','A',{figmaDirect:true,figmaSource:'FIGMA_UI_OBSERVED'},{...scope,baselineContentSha256:'wrong'}),'Reject mismatched copy');
 ok(await record('figma','A',{figmaDirect:true,figmaSource:'FIGMA_UI_OBSERVED'}),'Record Figma');
 rejected(cmd('browser','--action','release','--actor','A','--nonce','invalid'),'Reject wrong lease nonce');
 ok(cmd('browser','--action','release','--actor','A','--nonce',nonce),'Release Figma lock');
 ok(await record('dom','B',{appSource:'APP_RUNTIME_MEASURED'}),'Record DOM');
 pack('difference');ok(cmd('assign','--task','difference','--actor','C','--model','sol'),'Difference after both');
 rejected(await record('difference','C',{crossChecked:false,sourceTasks:['figma','dom']}),'Deny unsupported compare');
 ok(await record('difference','C',{crossChecked:true,sourceTasks:['figma','dom']}),'Record comparison');
 rejected(cmd('assign','--task','fixer','--actor','D','--model','sol'),'Require explicit writer grant');
 pack('fixer');ok(cmd('assign','--task','fixer','--actor','D','--model','sol','--allow-edit','true'),'Fixer writes');
 ok(await record('fixer','D',{changedFiles:['src/components/Terms.vue'],regressionTests:['npm run build']}),'Record fixer');
 rejected(cmd('assign','--task','review','--actor','A','--model','sol'),'Second reviewer cannot be first');
 rejected(cmd('assign','--task','review','--actor','E','--model','sol'),'Reviewer needs browser lease');
 const lease2=cmd('browser','--action','acquire','--actor','E');ok(lease2,'Reviewer lease acquired');const nonce2=JSON.parse(lease2.out).nonce;
 pack('review');ok(cmd('assign','--task','review','--actor','E','--model','sol'),'Independent reviewer dispatched');
 rejected(await record('review','E',{figmaDirect:true,figmaSource:'FIGMA_UI_OBSERVED',independent:false,originalInspector:'A',newlyFoundRegions:[]}),'Cannot fake independent');
 ok(await record('review','E',{figmaDirect:true,figmaSource:'FIGMA_UI_OBSERVED',independent:true,originalInspector:'A',newlyFoundRegions:[]}),'Independent verified contract');
 ok(cmd('browser','--action','release','--actor','E','--nonce',nonce2),'Release reviewer browser');
 pack('gate');ok(cmd('assign','--task','gate','--actor','MAIN','--model','node'),'Final task');
 const reports={v4:'.design-qa/v6/v4-gate.json',v5:'.design-qa/v6/v5-gate.json',independent:'.design-qa/v6/v5-independent.json'};
 await fixture('v4-gate.json',{status:'VERIFIED_RECORDED_SCOPE',errors:[]});
 await fixture('v5-gate.json',{status:'PARTIAL',errors:['gap']});
 await fixture('v5-independent.json',{status:'INDEPENDENT_AGREEMENT',onlyFirst:[],onlySecond:[]});
 rejected(await record('gate','MAIN',{reportPaths:reports,discrepanciesResolved:true}),'Block false v5 pass');
 await fixture('v5-gate.json',{status:'VERIFIED_RECORDED_SCOPE',errors:[]});
 ok(await record('gate','MAIN',{reportPaths:reports,discrepanciesResolved:true}),'Final combined gate');
 const last=cmd('gate');ok(last,'Full completion');assert.equal(JSON.parse(last.out).verified,true);
 // Budget hard cap test and injected policy, in fresh workspace to ensure no state coupling.
 const budgetTmp=await mkdtemp(path.join(tmpdir(),'pmv6-budget-'));
 try{const bqa=path.join(budgetTmp,'.design-qa/v6');await mkdir(bqa,{recursive:true});await writeFile(path.join(bqa,'scope.json'),JSON.stringify(scope));
  const policy=JSON.parse(await readFile(path.join(root,'config/v6-balanced.json'),'utf8'));policy.budget.maxAbstractUnits=5;await writeFile(path.join(bqa,'low-budget.json'),JSON.stringify(policy));
  const cr=(...args)=>spawnSync(process.execPath,[cli,args[0],'--workspace',budgetTmp,...args.slice(1)],{encoding:'utf8'});
  assert.equal(cr('init','--scope','.design-qa/v6/scope.json','--config',path.join(bqa,'low-budget.json')).status,0);checks++;
  assert.equal(spawnSync(process.execPath,[contextCli,'init','--workspace',budgetTmp],{encoding:'utf8'}).status,0);assert.equal(spawnSync(process.execPath,[contextCli,'pack','--workspace',budgetTmp,'--task','dom'],{encoding:'utf8'}).status,0);await writeFile(path.join(bqa,'cap.txt'),'app runtime');assert.equal(cr('capability','--actor','B','--figma','false','--dom','true','--evidence','.design-qa/v6/cap.txt').status,0);
  assert.notEqual(cr('assign','--task','dom','--actor','B','--model','luna').status,0);checks++;
 }finally{await rm(budgetTmp,{recursive:true,force:true})}
 console.log('v6 synthetic selftest PASS ('+checks+' assertions, including mismatched scope, wrong owner, budget, Astra block, independent review, dependencies)');
}finally{await rm(tmp,{recursive:true,force:true})}
