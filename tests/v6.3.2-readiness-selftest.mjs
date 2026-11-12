#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),cli=path.join(root,'benchmarks/v6.3/readiness-gate.mjs');
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'pmk-ready-'));let count=0;
const input={
 gold:{status:'FROZEN_RECORDED_EVIDENCE',assertions:150,unknown:[],problems:[],requiredRegionIds:['home','cta'],truthSha256:'f'.repeat(64)},
 assets:{status:'READY',packId:'common-home-v1',manifestSha256:'a'.repeat(64),originalVisualFidelity:'ORIGINAL_NOT_EVALUABLE',issues:[]},
 mapping:{regions:[{id:'home',selector:'#home'},{id:'cta',selector:'#cta'}]},
 approval:{schemaVersion:1,scope:'ALL_AB_C',currency:'USD',approvedMaxUsd:5,approvedBy:'USER_EXPLICIT',evidenceId:'user-approval'},
 browser:{status:'PASS',realBrowser:true,stableTwoCaptures:true,fontEvidenceConfirmed:1}
};
const files={gold:'gold.json',assets:'assets.json',mapping:'mapping.json',approval:'approval.json',browser:'browser.json'};
async function run(mod={}){
 for(const key of Object.keys(files))await fs.writeFile(path.join(tmp,files[key]),JSON.stringify(mod[key]??input[key]));
 const args=[cli];for(const [k,f] of Object.entries(files))args.push('--'+({'gold':'gold-lock','assets':'asset-lock','mapping':'mapping','approval':'approval','browser':'browser-report'}[k]),path.join(tmp,f));
 args.push('--out',path.join(tmp,'report.json'));
 const r=spawnSync(process.execPath,args,{encoding:'utf8'});return {code:r.status,data:JSON.parse((await fs.readFile(path.join(tmp,'report.json'),'utf8')))};
}
try{
 let r=await run();assert.equal(r.code,0);assert.equal(r.data.status,'READY_WITH_SUBSTITUTES');count++;
 r=await run({gold:{...input.gold,unknown:[{id:'x'}]}});assert.equal(r.code,2);assert(r.data.blockers.some(x=>x.code==='GOLD_NOT_VERIFIED'));count++;
 r=await run({mapping:{regions:[{id:'home',selector:'#home'}]}});assert.equal(r.code,2);assert(r.data.blockers.some(x=>x.code==='REQUIRED_REGION_NOT_MAPPED'));count++;
 r=await run({gold:{...input.gold,requiredRegionIds:[]}});assert.equal(r.code,2);assert(r.data.blockers.some(x=>x.code==='REQUIRED_REGION_INVENTORY_MISSING'));count++;
 r=await run({approval:{...input.approval,approvedMaxUsd:10}});assert.equal(r.code,2);assert(r.data.blockers.some(x=>x.code==='BUDGET_NOT_APPROVED'));count++;
 r=await run({browser:{...input.browser,stableTwoCaptures:false}});assert.equal(r.code,2);assert(r.data.blockers.some(x=>x.code==='BROWSER_SMOKE_NOT_READY'));count++;
 r=await run({assets:{...input.assets,status:'PARTIAL'}});assert.equal(r.code,2);assert(r.data.blockers.some(x=>x.code==='ASSET_PACK_NOT_LOCKED'));count++;
 r=await run({browser:{...input.browser,fontEvidenceConfirmed:0}});assert.equal(r.code,2);assert(r.data.blockers.some(x=>x.code==='FONT_BROWSER_PROOF_MISSING'));count++;
 console.log('PASS v6.3.2 readiness gate '+count+' scenarios');
}finally{await fs.rm(tmp,{recursive:true,force:true})}
