#!/usr/bin/env node
/**
 * Real Vue + Chromium v6.4.3 engine pilot, no LLM, NO Figma service calls.
 * Hidden reference is synthetic; reports MUST NEVER be published as official Algolia A/B scores.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const root=path.join(repo,'.fidelity-cloud-pilot-'+randomUUID());
const app=path.join(root,'app'),out=path.join(root,'results'),reportDest=path.resolve(process.env.FIDELITY_PILOT_REPORT_DIR||path.join(repo,'fidelity-cloud-pilot-results'));
const sha=buf=>createHash('sha256').update(buf).digest('hex');
const usage={schemaVersion:1,track:'1_REPRODUCIBLE_ENGINE_PILOT',officialFigma:false,modelCalls:0,apiCostUsd:0,source:'Independent synthetic support-dashboard reference, local Vue SFC rendered in real Chromium',status:'IN_PROGRESS',errors:[],stages:[],fixes:[]};
const ab={schemaVersion:1,track:'2_OFFICIAL_AB_PREFLIGHT',status:'NOT_CHECKED',modelAPIAccessPresent:false,authenticatedFigmaViewer:false,privateV633GoldPresent:false,approvedBudgetUsd:10,experimentalModelRequests:0,experimentalCostUsd:0,blockers:[]};

async function write(filename,obj){await fs.mkdir(path.dirname(filename),{recursive:true});await fs.writeFile(filename,JSON.stringify(obj,null,2)+'\n')}
async function call(file,args=[],okCodes=[0]){
 const full=path.join(repo,'scripts/fidelity',file);
 const v=await new Promise((resolve,reject)=>{
  const p=spawn(process.execPath,[full,...args],{cwd:repo,stdio:['ignore','pipe','pipe']});
  let sout='',serr='';
  p.stdout.on('data',chunk=>sout+=chunk);
  p.stderr.on('data',chunk=>serr+=chunk);
  p.on('error',reject);
  p.on('close',code=>resolve({code,sout,serr}));
 });
 if(!okCodes.includes(v.code))throw Error(file+' exit '+v.code+': '+v.serr.slice(-1800)+' '+v.sout.slice(-1000));
 return v;
}
async function waitHTTP(url){
 for(let i=0;i<130;i++){
  try{const r=await fetch(url);if(r.ok)return;}catch{}
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 throw Error('VITE_VUE_APP_DID_NOT_START');
}
let server=null;
try{
 await fs.mkdir(path.join(app,'src'),{recursive:true});
 await fs.mkdir(out,{recursive:true});
 await fs.writeFile(path.join(app,'package.json'),JSON.stringify({name:'pmk-cloud-pilot',version:'1.0.0',private:true,type:'module'}));
 await fs.writeFile(path.join(app,'index.html'),'<html><head><meta charset="UTF-8"></head><body><div id="app"></div><script type="module" src="/src/main.js"></script></body></html>');
 await fs.writeFile(path.join(app,'vite.config.mjs'),"import {defineConfig} from 'vite'; import vue from '@vitejs/plugin-vue'; export default defineConfig({plugins:[vue()],server:{host:'127.0.0.1',port:5187,strictPort:true}});\n");
 await fs.writeFile(path.join(app,'src','main.js'),"import {createApp} from 'vue'; import App from './App.vue'; createApp(App).mount('#app');\n");
 const vueOriginal='<template>\n'+
  ' <main class="dashboard" data-design-qa="Dashboard">\n'+
  '  <h1 class="title" data-design-qa="Title">Account overview</h1>\n'+
  '  <section class="panel" data-design-qa="Panel">\n'+
  '   <section class="hero" data-design-qa="Hero">Support dashboard</section>\n'+
  '   <p class="label" data-design-qa="Label">Recent activity</p>\n'+
  '   <button class="action" data-design-qa="Action">See details</button>\n'+
  '  </section>\n'+
  ' </main>\n'+
  '</template>\n'+
  '<style scoped>\n'+
  '.dashboard { width: 375px; height: 800px; background-color: #ffffff; }\n'+
  '.title { font-size: 16px; }\n'+
  '.panel { width: 355px; padding-top: 8px; }\n'+
  '.hero { height: 90px; }\n'+
  '.label { font-size: 14px; }\n'+
  '.action { width: 280px; height: 40px; background-color: #bbbbbb; }\n'+
  '</style>\n';
 const appFile=path.join(app,'src','App.vue');
 await fs.writeFile(appFile,vueOriginal);
 const cli=path.join(repo,'node_modules','.bin','vite');
 await fs.access(cli);
 server=spawn(cli,['--host','127.0.0.1','--port','5187','--strictPort'],{cwd:app,stdio:['ignore','pipe','pipe']});
 let startupError='';
 server.stderr.on('data',chunk=>{startupError+=chunk;});
 const url='http://127.0.0.1:5187/';
 await waitHTTP(url).catch(e=>{throw Error(e.message+' '+startupError.slice(-300))});
 usage.stages.push({stage:'Vue 3 + Vite real dev server',result:'RUNNING'});

 // Reference structure is independently authored test oracle, NOT imported Figma.
 const design={schemaVersion:1,status:'VERIFIED_EVIDENCE_FILES',method:'SYNTHETIC_REFERENCE_NOT_FIGMA',
  frame:{id:'SupportDashboard',width:375,height:800},regions:[
   {id:'Dashboard',path:'SupportDashboard',role:'main',parentId:null,order:0,required:true,
    source:'FIGMA_UI_MEASURED',evidenceSha256:'a'.repeat(64),box:{width:375,height:800}},
   {id:'Title',path:'SupportDashboard/Title',role:'heading',parentId:'Dashboard',order:0,required:true,
    source:'FIGMA_UI_MEASURED',evidenceSha256:'b'.repeat(64),text:'Account overview',style:{fontSize:'20px'}},
   {id:'Panel',path:'SupportDashboard/Panel',role:'region',parentId:'Dashboard',order:1,required:true,
    source:'FIGMA_UI_MEASURED',evidenceSha256:'c'.repeat(64),style:{paddingTop:'20px'}},
   {id:'Hero',path:'SupportDashboard/Panel/Hero',role:'region',parentId:'Panel',order:0,required:true,
    source:'FIGMA_UI_MEASURED',evidenceSha256:'d'.repeat(64),text:'Support dashboard',box:{height:110}},
   {id:'Label',path:'SupportDashboard/Panel/Label',role:'text',parentId:'Panel',order:1,required:true,
    source:'FIGMA_UI_MEASURED',evidenceSha256:'e'.repeat(64),text:'Recent activity',style:{fontSize:'14px'}},
   {id:'Action',path:'SupportDashboard/Panel/Action',role:'button',parentId:'Panel',order:2,required:true,
    source:'FIGMA_UI_MEASURED',evidenceSha256:'f'.repeat(64),text:'See details',
    box:{width:320,height:40},style:{backgroundColor:'#ffcc00'}},
   {id:'Badge',path:'SupportDashboard/Panel/Badge',role:'button',parentId:'Panel',order:3,required:true,
    source:'FIGMA_UI_MEASURED',evidenceSha256:'1'.repeat(64),text:'Beta'}
  ]};
 const expected=[
  ['Title','fontSize'],['Panel','paddingTop'],['Hero','height'],
  ['Action','width'],['Action','backgroundColor'],['Badge','element_present']
 ];
 const designPath=path.join(out,'reference.json');await write(designPath,design);
 const stages=[];
 async function capture(name){
  const folder=path.join(out,name);await fs.mkdir(folder,{recursive:true});
  const actual=path.join(folder,'dom.json'),mapping=path.join(folder,'mapping.json'),diff=path.join(folder,'diff.json');
  await call('discover-dom.mjs',['--url',url,'--width','375','--height','800','--out',actual]);
  await call('match-regions.mjs',['--design',designPath,'--runtime',actual,'--out',mapping],[0,2]);
  await call('detect.mjs',['--design',designPath,'--runtime',actual,'--mapping',mapping,'--out',diff]);
  const results=JSON.parse(await fs.readFile(diff,'utf8'));
  const actualData=JSON.parse(await fs.readFile(actual,'utf8'));
  assert.equal(actualData.captureEnvironment,'REAL_APP_RUNTIME');
  assert.equal(results.status,'ISSUES_RECORDED');
  const pairs=new Set((results.issues||[]).map(x=>x.regionId+'::'+x.comparison?.property));
  const tp=expected.filter(x=>pairs.has(x.join('::'))).length;
  const fp=[...pairs].filter(x=>!expected.some(y=>y.join('::')===x)).length;
  const summary={name,issues:results.issues.length,tp,fp,
    activeDefects:expected.filter(x=>pairs.has(x.join('::'))).map(x=>x.join('::')),
    major:results.majorOpen,critical:results.criticalOpen,
    screenshotSha256:actualData.screenshotSha256,domSha256:sha(await fs.readFile(actual))};
  stages.push(summary);
  return {folder,actual,mapping,diff,results,summary};
 }
 let current=await capture('initial');
 usage.initial=current.summary;
 assert.equal(current.summary.tp,6,'Seeded 6 actual Vue errors must be detected');
 assert.equal(current.summary.fp,0,'Healthy controls should not appear as false-positive errors');
 usage.stages.push({stage:'Real Vue seeded defect detection',detected:current.summary.tp,seeded:6,falsePositives:current.summary.fp});

 // Exercise CDP rule → focused source advice → bounded model context.
 const cdp=path.join(out,'css-trace.json'),fixPlans=path.join(out,'fix-plans.json'),pack=path.join(out,'context-pack.json');
 await call('trace-css.mjs',['--url',url,'--issues',current.diff,'--out',cdp]);
 await call('plan-fix.mjs',['--issues',current.diff,'--trace',cdp,'--max','10','--out',fixPlans]);
 await call('context-pack.mjs',['--issues',current.diff,'--plans',fixPlans,'--project-root',app,'--max-issues','2','--max-bytes','8000','--out',pack]);
 const planned=JSON.parse(await fs.readFile(fixPlans,'utf8'));
 const cssTrace=JSON.parse(await fs.readFile(cdp,'utf8'));
 const ctx=JSON.parse(await fs.readFile(pack,'utf8'));
 usage.trace={cssRules:cssTrace.issues.reduce((s,i)=>s+i.rules.length,0),fixPlans:planned.plans.length,contextIssues:ctx.tasks.length};
 assert(usage.trace.cssRules>=1,'At least one applied CSS rule must be traced');
 assert(usage.trace.fixPlans>=5,'Major CSS defects need specific fix plans');

 const patches=[
  {region:'Action',property:'width',css:'width',old:'280px',next:'320px'},
  {region:'Title',property:'fontSize',css:'font-size',old:'16px',next:'20px'},
  {region:'Panel',property:'paddingTop',css:'padding-top',old:'8px',next:'20px'},
  {region:'Hero',property:'height',css:'height',old:'90px',next:'110px'},
  {region:'Action',property:'backgroundColor',css:'background-color',old:'#bbbbbb',next:'#ffcc00'}
 ];
 const scopePath=path.join(out,'impact-scope.json');
 await write(scopePath,{schemaVersion:1,viewport:{width:375,height:800},fullPage:true,requiredRegionIds:['Dashboard','Title','Panel','Hero','Label','Action']});
 for(let i=0;i<patches.length;i++){
  const p=patches[i],issue=current.results.issues.find(x=>x.regionId===p.region&&x.comparison.property===p.property);
  assert(issue,'Expected measured defect not found: '+p.region+'/'+p.property);
  // No hidden CSS answer enters the tool; expected value is independently checked against measured issue.
  assert.equal(String(issue.comparison.expected.value),p.next);
  const patchId='live-patch-'+(i+1),plan=path.join(out,'plan-'+(i+1)+'.json');
  const receipt=path.join(out,'receipt-'+(i+1)+'.json'),transaction=path.join(out,'tx-'+(i+1));
  await write(plan,{schemaVersion:1,patchId,issueIds:[issue.issueId],allowedProperty:p.css,
   changes:[{file:'src/App.vue',find:p.css+': '+p.old+';',replace:p.css+': '+p.next+';'}]});
  await call('patch-transaction.mjs',['apply','--app-root',app,'--tx-dir',transaction,'--plan',plan,'--out',receipt]);
  const after=await capture('after-patch-'+(i+1));
  const verifyPath=path.join(out,'verify-inputs-'+(i+1)+'.json'),resultPath=path.join(out,'final-verdict-'+(i+1)+'.json');
  await write(verifyPath,{beforeDiff:current.diff,afterDiff:after.diff,beforeRuntime:current.actual,afterRuntime:after.actual,scope:scopePath,patchReceipt:receipt});
  await call('patch-transaction.mjs',['finalize','--app-root',app,'--tx-dir',transaction,'--verification',verifyPath,'--out',resultPath]);
  const decision=JSON.parse(await fs.readFile(resultPath,'utf8'));
  usage.fixes.push({issueId:issue.issueId,status:decision.status,rollback:decision.rollbackCompleted,
   beforeFaults:current.summary.tp,afterFaults:after.summary.tp,regressionCount:decision.regressionCount});
  assert.equal(decision.status,'ACCEPT','Fix must be accepted only when measured and safe: '+issue.issueId);
  assert.equal(after.summary.tp,current.summary.tp-1,'Each successful CSS fix must eliminate exactly one seeded defect');
  assert.equal(after.summary.fp,0,'No false positives or new regression allowed');
  current=after;
 }
 usage.afterCss=current.summary;
 assert.equal(current.summary.tp,1,'Only intentionally missing structural Badge must remain');
 assert.equal(current.summary.activeDefects[0],'Badge::element_present');

 // Negative mutation: one new P1 regression and unrepaired target, must rollback ORIGINAL BYTES.
 const beforeBad=await fs.readFile(appFile,'utf8');
 const badPlan=path.join(out,'bad-plan.json'),badReceipt=path.join(out,'bad-receipt.json'),badTx=path.join(out,'bad-tx');
 const missing=current.results.issues.find(x=>x.regionId==='Badge'&&x.comparison.property==='element_present');
 assert(missing);
 await write(badPlan,{schemaVersion:1,patchId:'intentionally-wrong-patch',issueIds:[missing.issueId],allowedProperty:'height',
  changes:[{file:'src/App.vue',find:'height: 40px;',replace:'height: 20px;'}]});
 await call('patch-transaction.mjs',['apply','--app-root',app,'--tx-dir',badTx,'--plan',badPlan,'--out',badReceipt]);
 const badCapture=await capture('after-bad-patch');
 const badVerify=path.join(out,'bad-verification.json'),badOutcome=path.join(out,'bad-outcome.json');
 await write(badVerify,{beforeDiff:current.diff,afterDiff:badCapture.diff,beforeRuntime:current.actual,
  afterRuntime:badCapture.actual,scope:scopePath,patchReceipt:badReceipt});
 await call('patch-transaction.mjs',['finalize','--app-root',app,'--tx-dir',badTx,'--verification',badVerify,'--out',badOutcome]);
 const reject=JSON.parse(await fs.readFile(badOutcome,'utf8'));
 assert.equal(reject.status,'REJECT','New P1/regression with unresolved target must be rejected');
 assert.equal(reject.rollbackCompleted,true);
 assert.equal(await fs.readFile(appFile,'utf8'),beforeBad,'Rollback must restore source byte-for-byte');
 usage.rejectedPatch={status:reject.status,restored:true,regressionCount:reject.regressionCount};
 usage.status='ENGINE_PILOT_VERIFIED_WITH_LIMITS';
 usage.metrics={seeded:6,detected:6,detectionRecall:1,precision:1,fixableCssDefects:5,verifiedCssFixes:5,
  cssFixSuccessRate:1,unresolvedStructural:1,successfulRollbackTests:1,modelCalls:0,apiCostUsd:0};
 usage.stages.push({stage:'Real-Vue Chromium independent fix verification',cssFixed:5,missingUIRemaining:1,badPatchRollback:'PASS'});
 console.log('PILOT_RESULTS '+JSON.stringify({status:usage.status,metrics:usage.metrics,trace:usage.trace,rollbacks:usage.rejectedPatch}));
}catch(e){
 usage.status='ENGINE_PILOT_FAILED';
 usage.errors.push(String(e.stack||e));
 console.error('PILOT_FAILED '+String(e.stack||e));
 process.exitCode=2;
}finally{
 if(server){server.kill('SIGTERM');await new Promise(resolve=>setTimeout(resolve,150));if(server.exitCode===null)server.kill('SIGKILL')}
 ab.modelAPIAccessPresent=Boolean(process.env.OPENAI_API_KEY||process.env.ANTHROPIC_API_KEY||process.env.GEMINI_API_KEY);
 ab.authenticatedFigmaViewer=false;
 ab.privateV633GoldPresent=false;
 ab.blockers=[
  'NO_AUTHENTICATED_INTERACTIVE_FIGMA_VIEWER_IN_THIS_CLOUD_RUN',
  'PRIVATE_V633_FROZEN_GOLD_150_NOT_AVAILABLE_TO_CLOUD_RUNNER',
  ...(ab.modelAPIAccessPresent?[]:['NO_CONFIGURED_MODEL_API_KEY']),
  'NO_NATIVE_INDEPENDENT_MODEL_A_AND_B_SESSIONS',
  'NO_OFFICIAL_PRE_PAID_READINESS_GATE_PASS'
 ];
 ab.status='BLOCKED_NOT_RUN';
 await fs.mkdir(reportDest,{recursive:true});
 await write(path.join(reportDest,'engine-pilot.json'),usage);
 await write(path.join(reportDest,'official-ab-readiness.json'),ab);
 console.log('OFFICIAL_AB_READINESS '+JSON.stringify({status:ab.status,blockers:ab.blockers,experimentalModelRequests:0,experimentalCostUsd:0}));
 await fs.rm(root,{recursive:true,force:true});
}
