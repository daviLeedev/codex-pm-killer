#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {auditBaseline} from '../benchmarks/v6.3.3/grade.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const gate=path.join(root,'benchmarks/v6.3/readiness-gate.mjs');
const journal=path.join(root,'benchmarks/v6.3/budget-journal.mjs');
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'v633-blocked-recovery-'));
const call=(file,...args)=>spawnSync(process.execPath,[file,...args],{encoding:'utf8'});
let count=0;
try {
 const docs={
  gold:{status:'FROZEN_RECORDED_EVIDENCE',assertions:150,unknown:[],problems:[],requiredRegionIds:['hero','cta'],truthSha256:'a'.repeat(64)},
  assets:{status:'READY',packId:'frozen-assets',manifestSha256:'b'.repeat(64),originalVisualFidelity:'ORIGINAL_NOT_EVALUABLE',issues:[]},
  approval:{schemaVersion:1,currency:'USD',scope:'ALL_AB_C',approvedMaxUsd:5,approvedBy:'USER_EXPLICIT',evidenceId:'synthetic-test'},
  browser:{status:'PASS',realBrowser:true,stableTwoCaptures:true,fontEvidenceConfirmed:1},
  mapping:{regions:[{id:'hero',selector:'#hero'},{id:'cta',selector:'#cta'}]}
 };
 for(const [name,value] of Object.entries(docs))await fs.writeFile(path.join(tmp,name+'.json'),JSON.stringify(value));
 const args=['--gold-lock',path.join(tmp,'gold.json'),'--asset-lock',path.join(tmp,'assets.json'),'--approval',path.join(tmp,'approval.json'),'--browser-report',path.join(tmp,'browser.json'),'--out',path.join(tmp,'readiness.json')];
 let r=call(gate,'--phase','pre-build',...args);
 assert.equal(r.status,0,r.stderr);
 let report=JSON.parse(await fs.readFile(path.join(tmp,'readiness.json'),'utf8'));
 assert.equal(report.status,'READY_FOR_BUILD_WITH_SUBSTITUTES');
 assert.equal(report.postBuildMappingRequired,true);count+=3;
 r=call(gate,...args);assert.notEqual(r.status,0);count++;
 r=call(gate,'--phase','post-build',...args,'--mapping',path.join(tmp,'mapping.json'));assert.equal(r.status,0,r.stderr);count++;
 await fs.writeFile(path.join(tmp,'mapping.json'),JSON.stringify({regions:[{id:'hero',selector:'#hero'}]}));
 r=call(gate,'--phase','post-build',...args,'--mapping',path.join(tmp,'mapping.json'));
 assert.equal(r.status,2);report=JSON.parse(await fs.readFile(path.join(tmp,'readiness.json'),'utf8'));
 assert(report.blockers.some(b=>b.code==='REQUIRED_REGION_NOT_MAPPED'));count+=2;
 const broken={...docs.gold,unknown:[{id:'hero'}]};await fs.writeFile(path.join(tmp,'gold.json'),JSON.stringify(broken));
 r=call(gate,'--phase','pre-build',...args);assert.equal(r.status,2);count++;
 const policy='Do not read SKILL.md or any skill instructions. Use only the ordinary task prompt.';
 assert.equal(auditBaseline([{role:'system',content:policy}]).status,'NO_LEAK_FOUND_IN_SUBMITTED_LOG');count++;
 assert.equal(auditBaseline([{role:'tool',content:'Found SKILL.md and inspected skill instructions'}]).status,'CONTAMINATED');count++;
 const dir=path.join(tmp,'budget');r=call(journal,'init','--dir',dir);assert.equal(r.status,0,r.stderr);count++;
 r=call(journal,'reserve','--dir',dir,'--request-id','overrun','--model','fixture','--max-usd','0.100000');assert.equal(r.status,0,r.stderr);count++;
 const raw=path.join(tmp,'response.json'),usage=path.join(tmp,'usage.json');
 await fs.writeFile(raw,JSON.stringify({id:'fixture',usage:{input_tokens:10,output_tokens:10}}));
 await fs.writeFile(usage,JSON.stringify({source:'synthetic',inputTokens:10,outputTokens:10}));
 r=call(journal,'record-response','--dir',dir,'--request-id','overrun','--response-file',raw);assert.equal(r.status,0,r.stderr);count++;
 r=call(journal,'settle','--dir',dir,'--request-id','overrun','--actual-usd','0.200000','--usage-file',usage);assert.equal(r.status,0,r.stderr);count++;
 r=call(journal,'reserve','--dir',dir,'--request-id','another','--model','fixture','--max-usd','0.050000');
 assert.notEqual(r.status,0,'reservation overrun must halt new paid requests');count++;
 console.log('PASS pre-build/post-build separation, Gold fail-closed, no policy false-positive, reservation overrun guard ('+count+' assertions)');
}finally {await fs.rm(tmp,{recursive:true,force:true})}
