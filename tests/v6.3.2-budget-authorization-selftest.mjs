#!/usr/bin/env node
/** CLI policy regression: separate historical $5 run from newly authorized $10 run. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const journal=path.join(root,'benchmarks/v6.3/budget-journal.mjs');
const verify=path.join(root,'benchmarks/v6.3/verify-approved-budget.mjs');
const gate=path.join(root,'benchmarks/v6.3/readiness-gate.mjs');
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'pmk-budget-approval-'));
const call=(file,...args)=>spawnSync(process.execPath,[file,...args],{encoding:'utf8'});
let count=0;
const outcome=(result,ok,name)=>{assert.equal(result.status===0,ok,name+': '+result.stderr+' '+result.stdout);count++};
try{
 const approvalFile=path.join(tmp,'approval.json');
 const approval={schemaVersion:1,scope:'ALL_AB_C',currency:'USD',approvedMaxUsd:10,approvedBy:'USER_EXPLICIT',evidenceId:'SYNTHETIC_TEST_APPROVAL'};
 await fs.writeFile(approvalFile,JSON.stringify(approval));
 const newDir=path.join(tmp,'new-10-run'),ledger=path.join(newDir,'ledger.json');
 outcome(call(journal,'init','--dir',newDir,'--cap-usd','10.000000'),false,'no $10 without approval file');
 outcome(call(journal,'init','--dir',newDir,'--cap-usd','11.000000','--approval',approvalFile),false,'reject >$10');
 outcome(call(journal,'init','--dir',newDir,'--cap-usd','10.000000','--approval',approvalFile),true,'authorized new $10 ledger');
 outcome(call(verify,'--approval',approvalFile,'--ledger',ledger),true,'verify pinned $10');
 let j=JSON.parse(await fs.readFile(ledger,'utf8'));
 assert.equal(j.capMicro,10000000);
 assert.equal(j.approvalSha256,createHash('sha256').update(await fs.readFile(approvalFile)).digest('hex'));
 count+=2;
 outcome(call(journal,'reserve','--dir',newDir,'--request-id','A','--model','fixture','--max-usd','10.000001'),false,'reservation over $10 blocked');
 await fs.writeFile(approvalFile,JSON.stringify({...approval,evidenceId:'MUTATED_APPROVAL'}));
 outcome(call(verify,'--approval',approvalFile,'--ledger',ledger),false,'approval rewrite rejected');
 await fs.writeFile(approvalFile,JSON.stringify(approval));
 const bad=path.join(tmp,'bad-approval.json');await fs.writeFile(bad,JSON.stringify({...approval,approvedMaxUsd:5}));
 outcome(call(journal,'init','--dir',path.join(tmp,'bad-run'),'--cap-usd','10.000000','--approval',bad),false,'mismatched approval rejected');
 const oldDir=path.join(tmp,'old-5-run');
 outcome(call(journal,'init','--dir',oldDir),true,'default remains $5');
 assert.equal(JSON.parse(await fs.readFile(path.join(oldDir,'ledger.json'),'utf8')).capMicro,5000000);count++;
 const docs={
  gold:{status:'FROZEN_RECORDED_EVIDENCE',assertions:150,unknown:[],problems:[],requiredRegionIds:['home'],truthSha256:'f'.repeat(64)},
  assets:{status:'READY',packId:'shared-v1',manifestSha256:'a'.repeat(64),originalVisualFidelity:'ORIGINAL_NOT_EVALUABLE',issues:[]},
  mapping:{regions:[{id:'home',selector:'#home'}]},
  browser:{status:'PASS',realBrowser:true,stableTwoCaptures:true,fontEvidenceConfirmed:1}
 };
 const args=[];
 const map={gold:'gold-lock',assets:'asset-lock',mapping:'mapping',browser:'browser-report'};
 for(const [key,doc] of Object.entries(docs)){
  const f=path.join(tmp,key+'.json');await fs.writeFile(f,JSON.stringify(doc));args.push('--'+map[key],f);
 }
 const report=path.join(tmp,'ready.json');
 outcome(call(gate,...args,'--approval',approvalFile,'--ledger',ledger,'--out',report),true,'readiness accepts pinned $10 ledger');
 j.capMicro=5000000;await fs.writeFile(ledger,JSON.stringify(j));
 outcome(call(gate,...args,'--approval',approvalFile,'--ledger',ledger,'--out',report),false,'readiness rejects cap mismatch');
 console.log('PASS v6.3.2 explicit $10 authorization and historic $5 compatibility ('+count+' checks)');
}finally{await fs.rm(tmp,{recursive:true,force:true})}
