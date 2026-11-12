#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const file=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../benchmarks/v6.3/budget-journal.mjs'),tmp=await fs.mkdtemp(path.join(os.tmpdir(),'pmk-budget-'));
const dir=path.join(tmp,'account');let count=0;
const invoke=(...args)=>{const r=spawnSync(process.execPath,[file,args[0],'--dir',dir,...args.slice(1)],{encoding:'utf8'});return {ok:r.status===0,text:r.stdout,err:r.stderr,code:r.status}};
const pass=(r,desc)=>{assert.equal(r.code,0,desc+': '+r.err);count++;return r};
const reject=(r,desc)=>{assert.notEqual(r.code,0,desc);count++;return r};
try{
 pass(invoke('init'),'initialize $5 cap');
 reject(invoke('init'),'cannot replace ledger');
 reject(invoke('reserve','--request-id','bad','--model','sol','--max-usd','6'),'over $5 blocked');
 pass(invoke('reserve','--request-id','A','--model','sol','--max-usd','4.500000'),'reserve A');
 reject(invoke('reserve','--request-id','A','--model','sol','--max-usd','1'),'duplicate ID rejected');
 reject(invoke('reserve','--request-id','B','--model','sol','--max-usd','0.100000'),'block while in-flight');
 const rawFile=path.join(tmp,'response.json'),usage=path.join(tmp,'usage.json');
 await fs.writeFile(rawFile,JSON.stringify({id:'response-A',usage:{input_tokens:1000,output_tokens:1000},output:[]}));
 await fs.writeFile(usage,JSON.stringify({usageSource:'test',input:1000,output:1000,pricing:'fixture'}));
 pass(invoke('record-response','--request-id','A','--response-file',rawFile),'raw stored before settlement');
 const saved=await fs.readFile(path.join(dir,'raw','A.json'));
 assert.deepEqual(saved,await fs.readFile(rawFile));count++;
 reject(invoke('reserve','--request-id','B','--model','sol','--max-usd','0.100000'),'unsettled response prevents next API call');
 pass(invoke('recover'),'raw persisted across process resume');
 pass(invoke('settle','--request-id','A','--actual-usd','0.125000','--usage-file',usage),'settle evidence-backed cost');
 reject(invoke('settle','--request-id','A','--actual-usd','0.125000','--usage-file',usage),'no duplicate settlement');
 pass(invoke('reserve','--request-id','B','--model','sol','--max-usd','4.800000'),'reserve within remaining balance');
 reject(invoke('reserve','--request-id','C','--model','sol','--max-usd','0.100000'),'no further concurrent paid calls');
 pass(invoke('uncertain','--request-id','B','--reason','timeout_after_send'),'uncertain charges retained');
 reject(invoke('reserve','--request-id','C','--model','sol','--max-usd','0.100000'),'uncertain charges block all new calls');
 const status=pass(invoke('status'),'report pending');
 const j=JSON.parse(status.text);assert.equal(j.requests.find(x=>x.id==='B').state,'UNCERTAIN');assert.equal(j.totals.cap,'5.000000');count+=2;
 pass(invoke('recover'),'uncertain remains no automatic retry');
 console.log('PASS v6.3 budget/journal selftest ('+count+' assertions including durable responses, 5 USD policy, uncertain request blocking)');
}finally{await fs.rm(tmp,{recursive:true,force:true})}
