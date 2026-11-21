#!/usr/bin/env node
/** Real Chromium patch→fresh DOM→difference→independent verifier integration.
 * Uses an isolated local HTML view derived from Vue-style source, NOT live Figma / real Vue certification.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'pmk-fix-browser-'));
const app=path.join(tmp,'app');await fs.mkdir(path.join(app,'src'),{recursive:true});
const src=path.join(app,'src','App.vue');
await fs.writeFile(src,'<style>.cta{width: 300px; height: 50px; display: block; margin-top: 20px;}</style>');
const html=async()=>{const source=await fs.readFile(src,'utf8');const style=source.match(/<style>([\s\S]+?)<\/style>/)?.[1]??'';
 return '<!doctype html><html><head><style>'+style+'</style></head><body><main id="home" data-design-qa="Home"><button class="cta" id="cta" data-design-qa="CTA">Buy now</button></main></body></html>'};
const server=createServer(async(req,res)=>{res.writeHead(200,{'content-type':'text/html'});res.end(await html())});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port;
const sha=b=>createHash('sha256').update(b).digest('hex');
async function call(file,args,expected=0){
 return await new Promise((resolve,reject)=>{
  const p=spawn(process.execPath,[path.join(repo,'scripts/fidelity',file),...args],{cwd:repo});
  let stdout='',stderr='';
  p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);
  p.on('exit',c=>c===expected?resolve({code:c,stdout}):reject(Error(file+' exit='+c+' expected='+expected+' '+stderr+' '+stdout)));
 });
}
async function put(file,value){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(value))}
try{
 const d={
  schemaVersion:1,status:'VERIFIED_EVIDENCE_FILES',frame:{id:'FigmaHome',width:375,height:800},
  regions:[{id:'Home',path:'Home',role:'main',parentId:null,order:0,required:true,source:'FIGMA_UI_MEASURED',evidenceSha256:'a'.repeat(64)},
           {id:'CTA',path:'Home/CTA',role:'button',parentId:'Home',order:0,required:true,source:'FIGMA_UI_MEASURED',
            evidenceSha256:'b'.repeat(64),text:'Buy now',box:{width:320,height:50},style:{}}]};
 const figma=path.join(tmp,'verified-design.json');await put(figma,d);
 async function stage(label){
  const dir=path.join(tmp,label),runtime=path.join(dir,'runtime.json'),mapping=path.join(dir,'mapping.json'),diff=path.join(dir,'diff.json');
  await fs.mkdir(dir,{recursive:true});
  await call('discover-dom.mjs',['--url',url,'--width','375','--height','800','--out',runtime]);
  await call('match-regions.mjs',['--design',figma,'--runtime',runtime,'--out',mapping]);
  await call('detect.mjs',['--design',figma,'--runtime',runtime,'--mapping',mapping,'--out',diff]);
  return {runtime,mapping,diff};
 }
 const before=await stage('before');
 const first=JSON.parse(await fs.readFile(before.diff,'utf8'));
 assert(first.issues.some(x=>x.issueId==='CTA-WIDTH'));
 const patchFile=path.join(tmp,'patch.json'),receipt=path.join(tmp,'receipt.json'),tx=path.join(tmp,'tx');
 await put(patchFile,{schemaVersion:1,patchId:'cta-fix',issueIds:['CTA-WIDTH'],allowedProperty:'width',
  changes:[{file:'src/App.vue',find:'width: 300px;',replace:'width: 320px;'}]});
 await call('patch-transaction.mjs',['apply','--app-root',app,'--tx-dir',tx,'--plan',patchFile,'--out',receipt]);
 const after=await stage('after');
 const finished=JSON.parse(await fs.readFile(after.diff,'utf8'));
 assert(!finished.issues.some(x=>x.issueId==='CTA-WIDTH'));
 const scopeFile=path.join(tmp,'scope.json');await put(scopeFile,{schemaVersion:1,viewport:{width:375,height:800},fullPage:true,requiredRegionIds:['Home','CTA']});
 const verification=path.join(tmp,'verify.json');await put(verification,{
  beforeDiff:before.diff,afterDiff:after.diff,beforeRuntime:before.runtime,afterRuntime:after.runtime,scope:scopeFile,patchReceipt:receipt
 });
 const result=path.join(tmp,'final-verdict.json');
 await call('patch-transaction.mjs',['finalize','--app-root',app,'--tx-dir',tx,'--verification',verification,'--out',result]);
 const verdict=JSON.parse(await fs.readFile(result,'utf8'));
 assert.equal(verdict.status,'ACCEPT');
 assert.equal(verdict.regressionCount,0);
 assert((await fs.readFile(src,'utf8')).includes('width: 320px;'));
 console.log('PASS v6.4.2 actual Chromium CSS patch→recapture→independent verify integration (isolated HTML host)');
}finally{server.close();await fs.rm(tmp,{recursive:true,force:true})}
