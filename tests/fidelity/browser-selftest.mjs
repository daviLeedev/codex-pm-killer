#!/usr/bin/env node
/** Real Chromium local-app DOM discovery and CDP CSS tracing, no Figma credentials. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'pmk-fidelity-browser-'));
const image='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLytQAAAABJRU5ErkJggg==';
const page='<html><head><style>.hero{width:375px;height:100px;background-color:#fff}.cta{width:300px;height:50px;margin-top:8px;color:#222}input::placeholder{color:#999}</style></head><body><main id="home" data-design-qa="Home"><div class="hero" data-design-qa="Hero">Popular</div><button id="cta" class="cta" data-design-qa="CTA">Buy now</button><input id="search" placeholder="Search"><img id="asset" src="data:image/png;base64,'+image+'"></main></body></html>';
const server=createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html'});res.end(page)});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port;
async function run(file,args){
 const script=path.join(repo,'scripts/fidelity',file);
 return await new Promise((resolve,reject)=>{
  const p=spawn(process.execPath,[script,...args],{cwd:repo});let stderr='';
  p.stderr.on('data',b=>stderr+=b);
  p.on('exit',c=>c===0?resolve():reject(Error(file+' exit='+c+' '+stderr)));
 });
}
try{
 const domFile=path.join(dir,'dom.json');
 await run('discover-dom.mjs',['--url',url,'--width','375','--height','800','--out',domFile]);
 const discovered=JSON.parse(await fs.readFile(domFile,'utf8'));
 assert.equal(discovered.status,'DOM_DISCOVERED');
 assert.equal(discovered.captureEnvironment,'REAL_APP_RUNTIME');
 assert.equal(discovered.elements.find(x=>x.figmaHint==='CTA')?.box.width,300);
 assert.equal(discovered.elements.find(x=>x.id==='#search')?.text,'Search');
 assert.equal(discovered.elements.find(x=>x.id==='#asset')?.imageLoaded,true);
 const issuesPath=path.join(dir,'issues.json'),tracePath=path.join(dir,'trace.json');
 const issues={schemaVersion:1,status:'ISSUES_RECORDED',issues:[{issueId:'CTA-WIDTH',regionId:'CTA',severity:'P1',status:'DETECTED',domSelector:'#cta',comparison:{property:'width'}}]};
 await fs.writeFile(issuesPath,JSON.stringify(issues));
 await run('trace-css.mjs',['--url',url,'--width','375','--height','800','--issues',issuesPath,'--project-root',dir,'--out',tracePath]);
 const traced=JSON.parse(await fs.readFile(tracePath,'utf8'));
 assert.equal(traced.status,'CSS_RULES_RECORDED');
 assert(traced.issues[0].rules.some(r=>r.selector.includes('.cta')));
 const plan=path.join(dir,'plan.json');
 await run('plan-fix.mjs',['--issues',issuesPath,'--trace',tracePath,'--out',plan]);
 const fixed=JSON.parse(await fs.readFile(plan,'utf8'));
 assert.equal(fixed.plans.length,1);
 console.log('PASS v6.4.1 browser DOM + CDP CSS + fix plan (8 assertions)');
}finally{server.close();await fs.rm(dir,{recursive:true,force:true})}
