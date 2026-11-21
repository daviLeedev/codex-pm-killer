#!/usr/bin/env node
/** Synthetic contract and state-machine regression. Not a real Figma/app claim. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const runCli=path.join(repo,'scripts/fidelity/run.mjs');
const inventoryCli=path.join(repo,'scripts/fidelity/inventory.mjs');
const sha=b=>createHash('sha256').update(b).digest('hex');
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'pmk-fidelity-'));
const cli=(verb,args=[],ok=true)=>{const r=spawnSync(process.execPath,[runCli,verb,'--workspace',path.join(tmp,'run'),...args],{encoding:'utf8'});assert.equal(r.status===0,ok,verb+' '+r.stderr+' '+r.stdout);return r};
const write=async(name,obj)=>{const p=path.join(tmp,'run',name);await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,typeof obj==='string'?obj:JSON.stringify(obj));return p};
let checks=0;
try{
 const root=path.join(tmp,'run');await fs.mkdir(root);
 const cfg=path.join(tmp,'config.json');
 await fs.writeFile(cfg,JSON.stringify({schemaVersion:1,runId:'home-fidelity-01',frameId:'HomeFrame',viewport:{width:375,height:800},maxIterations:3,maxUsd:1}));
 cli('init',['--config',cfg]);checks++;
 cli('done',['--artifact',cfg],false);checks++;
 const proof=await write('proof/figma.txt','OFFLINE_SYNTHETIC_ONLY');
 const invData=await write('inventory-input.json',{schemaVersion:1,method:'AUTHENTICATED_VIEW_ONLY_BROWSER',inspectorActor:'synthetic-inspector',completeInventory:true,
  frame:{id:'HomeFrame',width:375,height:800},regions:[{id:'CTA',path:'Home/CTA',role:'button',order:0,required:true,
  source:'FIGMA_UI_MEASURED',evidencePath:'proof/figma.txt',evidenceSha256:sha(await fs.readFile(proof)),box:{width:320,height:50}}]});
 const inv=path.join(root,'inventory-verified.json');
 const invResult=spawnSync(process.execPath,[inventoryCli,'--input',invData,'--evidence-root',root,'--out',inv],{encoding:'utf8'});
 assert.equal(invResult.status,0,invResult.stderr);checks++;
 cli('observe',['--artifact',inv]);checks++;
 const runtime=h=>({schemaVersion:1,captureEnvironment:'REAL_APP_RUNTIME',viewport:{width:375,height:800},coverageComplete:true,
  regions:[{id:'CTA',visible:true,box:{width:320,height:h}}],errors:[],captureWarnings:[],blockedExternalRequests:[]});
 const before=await write('before-runtime.json',runtime(55));cli('capture',['--artifact',before]);checks++;
 const mapped=await write('mapped.json',{schemaVersion:1,status:'MAPPING_RECORDED',mappings:[{regionId:'CTA',nodeId:'CTA',status:'MATCHED'}]});
 cli('map',['--artifact',mapped]);checks++;
 const observed=await write('diff.json',{schemaVersion:1,status:'ISSUES_RECORDED',designSha256:sha(await fs.readFile(inv)),runtimeSha256:sha(await fs.readFile(before)),
  coverage:{evaluable:1},issues:[{issueId:'CTA-HEIGHT',severity:'P1',status:'DETECTED',category:'GEOMETRY',comparison:{property:'height',expected:{value:50},actual:{value:55},delta:5}}]});
 cli('detect',['--artifact',observed]);checks++;
 const plan=await write('diagnosis.json',{schemaVersion:1,plans:[{issueId:'CTA-HEIGHT',hypothesis:'height mismatch'}]});
 cli('diagnose',['--artifact',plan]);checks++;
 const patch=await write('patch.json',{schemaVersion:1,patchId:'patch1',beforeSourceSha256:'a'.repeat(64),afterSourceSha256:'b'.repeat(64),issueIds:['CTA-HEIGHT']});
 cli('patch',['--artifact',patch]);checks++;
 const bad=await write('reject-incorrect.json',{schemaVersion:1,status:'ACCEPT',patchId:'patch1',beforeRuntimeSha256:'c'.repeat(64),
  afterRuntimeSha256:'d'.repeat(64),recheckedRegionIds:['CTA'],scopeEqual:true,currentCaptureEnvironment:'REAL_APP_RUNTIME',
  targetImproved:true,regressionCount:1,newP0:0});
 cli('verify',['--artifact',bad],false);checks++;
 const verdict=await write('valid-verdict.json',{...JSON.parse(await fs.readFile(bad,'utf8')),regressionCount:0});
 cli('verify',['--artifact',verdict]);checks++;
 const after=await write('after-runtime.json',runtime(50));cli('next',['--artifact',after]);checks++;
 cli('map',['--artifact',mapped]);checks++;
 const zero=await write('zero-diff.json',{schemaVersion:1,status:'ISSUES_RECORDED',designSha256:sha(await fs.readFile(inv)),runtimeSha256:sha(await fs.readFile(after)),
  coverage:{evaluable:1},issues:[]});cli('detect',['--artifact',zero]);checks++;
 const reviewBad=await write('review-self.json',{schemaVersion:1,status:'INDEPENDENT_REVIEW_RECORDED',actor:'synthetic-inspector',
  figmaEvidenceSha256:'a'.repeat(64),runtimeEvidenceSha256:'b'.repeat(64),realFigmaViewerRevisited:true,realAppRecaptured:true,
  criticalMissing:0,regressions:0,evaluableCoverage:1});
 cli('review',['--artifact',reviewBad],false);checks++;
 const review=await write('review-different-actor.json',{...JSON.parse(await fs.readFile(reviewBad,'utf8')),actor:'different-synthetic-inspector'});
 cli('review',['--artifact',review]);checks++;
 const final=await write('final-gate.json',{schemaVersion:1,status:'FINAL_GATE_PASS',independentReviewSha256:sha(await fs.readFile(review)),
  buildOrTypecheckPass:true,noOpenP0:true,noOpenP1:true});
 cli('done',['--artifact',final]);checks++;
 const state=JSON.parse(await fs.readFile(path.join(root,'state.json'),'utf8'));
 assert.equal(state.state,'DONE');assert.equal(state.iteration,1);checks+=2;
 console.log('PASS v6.4.0 synthetic fidelity state transitions '+checks+' assertions');
}finally{await fs.rm(tmp,{recursive:true,force:true})}
