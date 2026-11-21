#!/usr/bin/env node
/** Offline matching / missing-area / causal-hypothesis regression. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'pmk-match-'));
const run=(script,...args)=>spawnSync(process.execPath,[path.join(repo,'scripts/fidelity',script),...args],{encoding:'utf8'});
let n=0;
try{
 const design={
  schemaVersion:1,status:'VERIFIED_EVIDENCE_FILES',frame:{id:'Home',width:375,height:800},
  regions:[
   {id:'Home',path:'Home',role:'main',parentId:null,order:0,required:true,source:'FIGMA_UI_MEASURED',evidenceSha256:'a'.repeat(64),box:{x:0,y:0,width:375,height:800}},
   {id:'CTA',path:'Home/CTA',role:'button',parentId:'Home',order:0,required:true,source:'FIGMA_UI_MEASURED',evidenceSha256:'b'.repeat(64),text:'Buy now',box:{x:20,y:680,width:320,height:50},style:{backgroundColor:'#ffffff'}},
   {id:'Price',path:'Home/Price',role:'text',parentId:'Home',order:1,required:true,source:'FIGMA_UI_MEASURED',evidenceSha256:'c'.repeat(64),text:'$39',box:{x:20,y:630,width:100,height:20}},
   {id:'Missing',path:'Home/Missing',role:'button',parentId:'Home',order:2,required:true,source:'FIGMA_UI_MEASURED',evidenceSha256:'d'.repeat(64),text:'Wishlist',box:{x:335,y:680,width:25,height:25}}
  ]
 };
 const runtime={
  schemaVersion:1,status:'DOM_DISCOVERED',captureEnvironment:'REAL_APP_RUNTIME',viewport:{width:375,height:800},
  elements:[
   {id:'#home',selector:'#home',parentId:null,order:0,visible:true,role:'main',figmaHint:'Home',text:'',box:{x:0,y:0,width:375,height:800},computed:{}},
   {id:'#cta',selector:'#cta',parentId:'#home',order:0,visible:true,role:'button',figmaHint:'CTA',text:'Buy now',box:{x:20,y:680,width:300,height:50},computed:{backgroundColor:'rgb(255, 255, 255)'}},
   {id:'#price',selector:'#price',parentId:'#home',order:1,visible:true,role:'text',figmaHint:'Price',text:'$39',box:{x:20,y:630,width:100,height:20},computed:{}}
  ],warnings:[],errors:[],truncated:false
 };
 const fd=path.join(tmp,'design.json'),fr=path.join(tmp,'dom.json'),fm=path.join(tmp,'map.json'),fo=path.join(tmp,'diff.json');
 await fs.writeFile(fd,JSON.stringify(design));await fs.writeFile(fr,JSON.stringify(runtime));
 let r=run('match-regions.mjs','--design',fd,'--runtime',fr,'--out',fm);
 assert.equal(r.status,2,r.stderr);n++;
 const map=JSON.parse(await fs.readFile(fm,'utf8'));
 assert.equal(map.counts.STRUCTURAL_MISSING,1);assert.equal(map.mappings.find(m=>m.regionId==='CTA').nodeId,'#cta');n+=2;
 r=run('detect.mjs','--design',fd,'--runtime',fr,'--mapping',fm,'--out',fo);
 assert.equal(r.status,0,r.stderr);n++;
 const report=JSON.parse(await fs.readFile(fo,'utf8'));
 assert(report.issues.some(x=>x.issueId==='MISSING-MISSING'&&x.severity==='P0'));n++;
 const width=report.issues.find(x=>x.issueId==='CTA-WIDTH');
 assert.equal(width?.comparison.delta,-20);n++;
 assert(!report.issues.some(x=>x.regionId==='CTA'&&x.comparison.property==='backgroundColor'));n++;
 const dom2=structuredClone(runtime);
 delete dom2.elements[2].figmaHint;
 dom2.elements[2].id='#price1';dom2.elements[2].selector='#price1';
 dom2.elements.push({...dom2.elements[2],id:'#price2',selector:'#price2'});
 await fs.writeFile(fr,JSON.stringify(dom2));
 r=run('match-regions.mjs','--design',fd,'--runtime',fr,'--out',fm);
 assert.equal(r.status,2);n++;
 const ambiguous=JSON.parse(await fs.readFile(fm,'utf8'));
 assert.equal(ambiguous.mappings.find(x=>x.regionId==='Price').status,'AMBIGUOUS_MAPPING');n++;
 r=run('detect.mjs','--design',fd,'--runtime',fr,'--mapping',fm,'--out',fo);
 assert.equal(r.status,0,r.stderr);
 const second=JSON.parse(await fs.readFile(fo,'utf8'));
 assert(second.unknown.some(x=>x.regionId==='Price'&&x.reason==='AMBIGUOUS_MAPPING'));
 assert(!second.issues.some(x=>x.regionId==='Price'&&x.comparison.property==='element_present'));n+=2;
 console.log('PASS v6.4.1 inventory matching + structural detection '+n+' assertions');
}finally{await fs.rm(tmp,{recursive:true,force:true})}
