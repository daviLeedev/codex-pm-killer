#!/usr/bin/env node
/** Held-out non-ecommerce layout: no Home/CTA-specific matcher assumptions. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const root=path.join(repo,'scripts/fidelity');
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'pmk-heldout-'));
const run=(name,...args)=>spawnSync(process.execPath,[path.join(root,name),...args],{encoding:'utf8'});
try{
 const d={schemaVersion:1,status:'VERIFIED_EVIDENCE_FILES',frame:{id:'SupportPanel',width:390,height:844},
  regions:[
   {id:'SupportPanel',path:'SupportPanel',role:'main',order:0,required:true,source:'FIGMA_UI_OBSERVED',evidenceSha256:'a'.repeat(64)},
   {id:'Toolbar',path:'SupportPanel/Toolbar',parentId:'SupportPanel',role:'region',order:0,required:true,source:'FIGMA_UI_MEASURED',
    evidenceSha256:'b'.repeat(64),box:{width:390,height:64}},
   {id:'Action',path:'SupportPanel/Action',parentId:'SupportPanel',role:'button',order:1,required:true,source:'FIGMA_UI_MEASURED',
    evidenceSha256:'c'.repeat(64),box:{width:110,height:40},text:'Contact support'}
  ]};
 const r={schemaVersion:1,status:'DOM_DISCOVERED',captureEnvironment:'REAL_APP_RUNTIME',viewport:{width:390,height:844},
  elements:[
   {id:'#root',selector:'#root',parentId:null,order:0,role:'main',figmaHint:'SupportPanel',visible:true,box:{width:390,height:844},computed:{}},
   {id:'#toolbar',selector:'#toolbar',parentId:'#root',order:0,role:'region',figmaHint:'Toolbar',visible:true,box:{width:380,height:64},computed:{}}
  ],warnings:[],truncated:false};
 const dp=path.join(dir,'d.json'),rp=path.join(dir,'r.json'),mp=path.join(dir,'m.json'),ip=path.join(dir,'issues.json');
 await fs.writeFile(dp,JSON.stringify(d));await fs.writeFile(rp,JSON.stringify(r));
 assert.equal(run('match-regions.mjs','--design',dp,'--runtime',rp,'--out',mp).status,2);
 assert.equal(run('detect.mjs','--design',dp,'--runtime',rp,'--mapping',mp,'--out',ip).status,0);
 const result=JSON.parse(await fs.readFile(ip,'utf8'));
 assert(result.issues.some(x=>x.regionId==='Action'&&x.severity==='P0'));
 assert(result.issues.some(x=>x.regionId==='Toolbar'&&x.comparison.property==='width'));
 console.log('PASS held-out SupportPanel missing element and geometry detection (4 checks)');
}finally{await fs.rm(dir,{recursive:true,force:true})}
