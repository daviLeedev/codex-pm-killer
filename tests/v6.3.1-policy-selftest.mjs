#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cli=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../benchmarks/v6.3/verify-approved-budget.mjs');
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'pmk-policy-')),a=path.join(tmp,'a.json'),j=path.join(tmp,'j.json');
const approval={schemaVersion:1,currency:'USD',scope:'ALL_AB_C',approvedMaxUsd:5,approvedBy:'USER_EXPLICIT',evidenceId:'private-reference'};
const ledger={schemaVersion:1,capMicro:5000000,requests:[{state:'SETTLED',actualMicro:1000000}]};
async function run(x,y,expected){await fs.writeFile(a,JSON.stringify(x));await fs.writeFile(j,JSON.stringify(y));const r=spawnSync(process.execPath,[cli,'--approval',a,'--ledger',j],{encoding:'utf8'});assert.equal(JSON.parse(r.stdout).status,expected);}
try{
 await run(approval,ledger,'RECORDED_BUDGET_POLICY_CONSISTENT');
 await run({...approval,approvedMaxUsd:10},ledger,'PARTIAL');
 await run(approval,{...ledger,capMicro:10000000},'PARTIAL');
 await run(approval,{...ledger,requests:[{state:'SETTLED',actualMicro:5200000}]},'PARTIAL');
 await run(approval,{...ledger,requests:[{state:'UNCERTAIN',reservedMicro:100000}]},'PARTIAL');
 await run({...approval,approvedBy:'HOST_IMPLICIT'},ledger,'PARTIAL');
 console.log('PASS v6.3.1 budget policy tests: 6');
}finally{await fs.rm(tmp,{recursive:true,force:true})}
