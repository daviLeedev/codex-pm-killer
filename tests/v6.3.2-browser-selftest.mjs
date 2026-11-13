#!/usr/bin/env node
/** Live Playwright Chromium smoke and controlled mutations. No Figma or paid API. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {evaluate} from '../benchmarks/v6.3/evaluate.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const script=path.join(root,'benchmarks/v6.3/capture-runtime.mjs');
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'pmk-v632-browser-'));
await fs.writeFile(path.join(tmp,'package.json'),'{}');
const img='iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAFUlEQVR4nGN8dqLiPwMSYGJAA4QFAM9OAy21jcaZAAAAAElFTkSuQmCC';
const html=(variant='')=>`<!doctype html><html><head><style>
body{font-family:${variant==='font'?'monospace':'Arial, sans-serif'};margin:0}
#stack{display:block;width:200px}.line{height:20px;width:80px;background:#ddd}#second{margin-top:${variant==='gap'?'12':'8'}px;position:sticky;top:0}
button{font:inherit}input::placeholder{color:#888}img{object-fit:cover;width:20px;height:20px}
</style></head><body>
<section id="stack"><div class="line" id="first">First</div><div class="line" id="second">Second</div></section>
<input id="input" placeholder="Search products" />
${variant==='missing'?'':'<button id="button">Buy now</button>'}
${variant==='placeholder'?'<svg id="image" data-benchmark-asset-id="hero" width="20" height="20"><path d="M 1 1 L 3 3"/></svg>':'<img id="image" data-benchmark-asset-id="hero" src="data:image/png;base64,'+img+'" alt="Hero">'}
</body></html>`;
let checked=0;
const mapping={regions:[{id:'stack',selector:'#stack',required:true},{id:'button',selector:'#button',required:true},{id:'input',selector:'#input',required:true},{id:'image',selector:'#image',required:true}]};
const caps=['stack','button','input','image'];
function run(args){return new Promise((resolve,reject)=>{
 const cp=spawn(process.execPath,[script,...args],{cwd:root,env:process.env});let out='',err='';
 cp.stdout.on('data',x=>out+=x);cp.stderr.on('data',x=>err+=x);
 cp.on('error',reject);cp.on('close',code=>resolve({code,out,err}));
})}
try{
 await fs.writeFile(path.join(tmp,'mapping.json'),JSON.stringify(mapping));
 async function capture(variant,name){
  const fixturePath=path.join(tmp,name+'.html');await fs.writeFile(fixturePath,html(variant));
  const out=path.join(tmp,name,'facts.json'),args=['--fixture-html',fixturePath,'--mapping',path.join(tmp,'mapping.json'),'--out',out,'--width','375','--height','1069','--assert-stable','--wait-ms','0'];
  const exe=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;if(exe)args.push('--browser-executable',exe);
  const r=await run(args);assert.equal(r.code,0,r.err);return JSON.parse(await fs.readFile(out,'utf8'));
 }
 const base=await capture('','baseline');assert.equal(base.errors.length,0);assert.equal(base.captureWarnings.length,0);assert.equal(base.coverageComplete,true);checked++;
 const font=base.regions.find(x=>x.id==='button');assert.equal(font.fontEvidence.source,'CDP_PLATFORM_FONTS');assert.equal(font.fontActualUseVerified,true,JSON.stringify(font.fontEvidence));checked++;
 const asset=base.regions.find(x=>x.id==='image');assert.equal(asset.imageLoaded,true);assert.equal(asset.assetPackId,'hero');assert.equal(asset.assetKind,'raster_photo');checked++;
 const stack=base.regions.find(x=>x.id==='stack');assert.equal(stack.childRects[1].inFlow,true,'sticky should remain in flow');checked++;
 const truth={viewport:base.viewport,status:'FROZEN_VERIFIED',layers:caps.map(id=>({id,required:true,source:'SYNTHETIC_TEST',evidence:'evidence.txt',evidenceSha256:'a'.repeat(64),checks:[{id:id+'.element',property:'element_present',expected:true}]}))};
 truth.layers.find(x=>x.id==='stack').checks.push({id:'gap',property:'gap',expected:8,tolerance:1});
 truth.layers.find(x=>x.id==='button').checks.push({id:'font',property:'font',expected:font.actualRenderedFont});
 truth.layers.find(x=>x.id==='image').checks.push({id:'asset_kind',property:'asset_kind',expected:'raster_photo'},{id:'asset_id',property:'asset_pack_id',expected:'hero'},{id:'image_loaded',property:'image_loaded',expected:true});
 truth.layers.find(x=>x.id==='input').checks.push({id:'placeholder_text',property:'placeholder_text',expected:'Search products'},{id:'placeholder_color',property:'placeholder_color',expected:'#888888'});
 const opts={root:tmp,synthetic:true,hashes:new Map([['evidence.txt','a'.repeat(64)]])};
 const baseline=evaluate(truth,base,opts);assert.equal(baseline.counts.MISMATCH,0,JSON.stringify(baseline.checks));assert.equal(baseline.counts.NOT_EVALUABLE,0,JSON.stringify(baseline.checks));checked++;
 const changed=await capture('gap','gap-mutation');const result=evaluate(truth,changed,opts);assert.equal(result.checks.find(x=>x.id==='gap').status,'MISMATCH');checked++;
 const missing=await capture('missing','missing-mutation');const miss=evaluate(truth,missing,opts);assert.notEqual(miss.status,'VERIFIED_RECORDED_SCOPE');assert(miss.missingRequiredRegions.some(x=>x.id==='button'));checked++;
 const placeholder=await capture('placeholder','asset-mutation');const sub=evaluate(truth,placeholder,opts);assert.equal(sub.checks.find(x=>x.id==='asset_kind').status,'MISMATCH');checked++;
 const wrongfont=await capture('font','font-mutation');const f=evaluate(truth,wrongfont,opts);assert.equal(f.checks.find(x=>x.id==='font').status,'MISMATCH',JSON.stringify(f.checks.find(x=>x.id==='font')));checked++;
 const stable=await capture('','repeat');assert.deepEqual(stable.regions.map(x=>[x.id,x.width,x.height,x.text]),base.regions.map(x=>[x.id,x.width,x.height,x.text]));checked++;
 console.log('PASS v6.3.2 real Chromium browser checks '+checked+' including CDP fonts, sticky in-flow, assets, missing CTA, gap and font mutations');
}finally{await fs.rm(tmp,{recursive:true,force:true})}
