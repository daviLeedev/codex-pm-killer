#!/usr/bin/env node
/** Synthetic proof fixture for transactional CSS patch acceptance/rejection/rollback. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const txCli=path.join(repo,'scripts/fidelity/patch-transaction.mjs');
const sha=b=>createHash('sha256').update(b).digest('hex');
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'pmk-patch-'));
const cli=(script,args,code)=>{const r=spawnSync(process.execPath,[script,...args],{encoding:'utf8'});assert.equal(r.status,code,r.stderr+' '+r.stdout);return r};
let n=0;
try{
 const app=path.join(tmp,'app');await fs.mkdir(path.join(app,'src'),{recursive:true});
 const appFile=path.join(app,'src','App.vue');
 await fs.writeFile(appFile,'<template><button>Buy now</button></template>\n<style>.cta { width: 300px; }</style>\n');
 const planFile=path.join(tmp,'plan.json'),receipt=path.join(tmp,'receipt.json');
 const p={schemaVersion:1,patchId:'height-correction',issueIds:['CTA-WIDTH'],allowedProperty:'width',
  changes:[{file:'src/App.vue',find:'width: 300px;',replace:'width: 320px;'}]};
 await fs.writeFile(planFile,JSON.stringify(p));
 const tx=path.join(tmp,'tx1');
 cli(txCli,['apply','--app-root',app,'--tx-dir',tx,'--plan',planFile,'--out',receipt],0);n++;
 assert((await fs.readFile(appFile,'utf8')).includes('width: 320px;'));n++;
 const rec=JSON.parse(await fs.readFile(receipt,'utf8'));assert.equal(rec.patchId,'height-correction');n++;
 const scope={schemaVersion:1,viewport:{width:375,height:800},fullPage:true,requiredRegionIds:['CTA','Home']};
 const scopeFile=path.join(tmp,'scope.json');await fs.writeFile(scopeFile,JSON.stringify(scope));
 const beforeDir=path.join(tmp,'before'),afterDir=path.join(tmp,'after');await fs.mkdir(beforeDir);await fs.mkdir(afterDir);
 const firstScreenshot=Buffer.from('FAKE_SCREENSHOT_FOR_SYNTHETIC_TEST_ONLY_1'),lastScreenshot=Buffer.from('FAKE_SCREENSHOT_FOR_SYNTHETIC_TEST_ONLY_2');
 await fs.writeFile(path.join(beforeDir,'dom-discovery.png'),firstScreenshot);
 await fs.writeFile(path.join(afterDir,'dom-discovery.png'),lastScreenshot);
 const route='http://localhost:5173',vp={width:375,height:800};
 const runtime=(screen,box)=>({schemaVersion:1,captureEnvironment:'REAL_APP_RUNTIME',status:'DOM_DISCOVERED',route,viewport:vp,
  elements:[{id:'#home',figmaHint:'Home',visible:true},{id:'#cta',figmaHint:'CTA',visible:true,box:{width:box}}],
  coverageComplete:true,errors:[],warnings:[],truncated:false,
  screenshotPath:'dom-discovery.png',screenshotSha256:sha(screen)});
 const beforeRuntime=path.join(beforeDir,'runtime.json'),afterRuntime=path.join(afterDir,'runtime.json');
 await fs.writeFile(beforeRuntime,JSON.stringify(runtime(firstScreenshot,300)));
 await fs.writeFile(afterRuntime,JSON.stringify(runtime(lastScreenshot,320)));
 const issue={issueId:'CTA-WIDTH',regionId:'CTA',severity:'P1',comparison:{delta:-20}};
 const detected=path.join(tmp,'detected.json'),resolved=path.join(tmp,'resolved.json');
 const makeDiff=(file,runtimeSha,issues)=>fs.writeFile(file,JSON.stringify({schemaVersion:1,status:'ISSUES_RECORDED',designSha256:'a'.repeat(64),
  runtimeSha256:runtimeSha,coverage:{evaluable:1},issues,unknown:[]}));
 await makeDiff(detected,sha(await fs.readFile(beforeRuntime)),[issue]);
 await makeDiff(resolved,sha(await fs.readFile(afterRuntime)),[]);
 const evidence=path.join(tmp,'verification.json');
 const putEvidence=async(afterDiff=resolved)=>fs.writeFile(evidence,JSON.stringify({beforeDiff:detected,afterDiff,
  beforeRuntime,afterRuntime,scope:scopeFile,patchReceipt:receipt}));
 await putEvidence();
 const verdict=path.join(tmp,'verdict.json');
 cli(txCli,['finalize','--app-root',app,'--tx-dir',tx,'--verification',evidence,'--out',verdict],0);n++;
 const accepted=JSON.parse(await fs.readFile(verdict,'utf8'));
 assert.equal(accepted.status,'ACCEPT');assert.equal(accepted.rollbackCompleted,false);n+=2;
 assert((await fs.readFile(appFile,'utf8')).includes('width: 320px;'));n++;
 await fs.writeFile(appFile,(await fs.readFile(appFile,'utf8')).replace('width: 320px;','width: 300px;'));
 const tx2=path.join(tmp,'tx2'),receipt2=path.join(tmp,'receipt2.json'),p2={...p,patchId:'bad-width-fix',changes:[{...p.changes[0],replace:'width: 280px;'}]};
 const plan2=path.join(tmp,'plan2.json');await fs.writeFile(plan2,JSON.stringify(p2));
 cli(txCli,['apply','--app-root',app,'--tx-dir',tx2,'--plan',plan2,'--out',receipt2],0);n++;
 await makeDiff(resolved,sha(await fs.readFile(afterRuntime)),[{...issue,comparison:{delta:-40}}]);
 const evidence2=path.join(tmp,'verification2.json');await fs.writeFile(evidence2,JSON.stringify({beforeDiff:detected,afterDiff:resolved,
  beforeRuntime,afterRuntime,scope:scopeFile,patchReceipt:receipt2}));
 const rejected=path.join(tmp,'rejected.json');
 cli(txCli,['finalize','--app-root',app,'--tx-dir',tx2,'--verification',evidence2,'--out',rejected],0);n++;
 const outcome=JSON.parse(await fs.readFile(rejected,'utf8'));
 assert.equal(outcome.status,'REJECT');assert.equal(outcome.rollbackCompleted,true);n+=2;
 assert((await fs.readFile(appFile,'utf8')).includes('width: 300px;'));n++;
 await fs.writeFile(plan2,JSON.stringify({...p2,patchId:'recovery-case'}));
 const tx3=path.join(tmp,'tx3');
 cli(txCli,['apply','--app-root',app,'--tx-dir',tx3,'--plan',plan2],0);
 cli(txCli,['recover','--app-root',app,'--tx-dir',tx3],0);
 assert((await fs.readFile(appFile,'utf8')).includes('width: 300px;'));n++;
 console.log('PASS v6.4.2 synthetic CSS patch verify/rollback '+n+' assertions');
}finally{await fs.rm(tmp,{recursive:true,force:true})}
