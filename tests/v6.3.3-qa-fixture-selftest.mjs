#!/usr/bin/env node
/** Synthetic source-mutation and proof-gate regression (NOT a real Figma or browser benchmark). */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fixture=path.join(root,'benchmarks/v6.3.3/qa-fixture.mjs');
const proof=path.join(root,'benchmarks/v6.3.3/qa-fixture-proof.mjs');
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'pmk-qa-fixture-'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const call=(file,...args)=>spawnSync(process.execPath,[file,...args],{encoding:'utf8',timeout:30000});
let assertions=0;
try{
 const clean=path.join(tmp,'clean'),faulty=path.join(tmp,'faulty'),privateDir=path.join(tmp,'private');
 await fs.mkdir(path.join(clean,'src'),{recursive:true});await fs.mkdir(privateDir);
 await fs.writeFile(path.join(clean,'package.json'),JSON.stringify({name:'qa-reference',version:'0.1.0',type:'module'}));
 const groups=[
  {category:'geometry',property:'width',css:'width',old:'100px',newValue:'113px'},
  {category:'spacing',property:'padding_top',css:'padding-top',old:'8px',newValue:'19px'},
  {category:'typography',property:'font_size',css:'font-size',old:'14px',newValue:'22px'},
  {category:'color',property:'color',css:'color',old:'#222222',newValue:'#ee0044'},
  {category:'structure',property:'element_present',css:'display',old:'block',newValue:'none'}
 ];
 const checks=[],css=[],html=[],mutations=[];
 for(let i=0;i<150;i++){
  const g=groups[i%groups.length],id='ASSERT-'+String(i).padStart(3,'0'),selector='.slot-'+i;
  const line=selector+'{'+g.css+':'+g.old+';}';
  css.push(line);html.push('<div data-bench-id="L'+i+'" class="slot-'+i+'">Example '+i+'</div>');
  checks.push({id,property:g.property,expected:g.category==='color'?g.old:g.category==='structure'?true:Number.parseFloat(g.old),layerId:'L'+i});
  if(i<20)mutations.push({assertionId:id,category:g.category,file:'src/App.vue',from:line,to:selector+'{'+g.css+':'+g.newValue+';}'});
 }
 const app='<template><main>'+html.join('')+'</main></template>\n<style>\n'+css.join('\n')+'\n</style>\n';
 await fs.writeFile(path.join(clean,'src','App.vue'),app);
 const goldFile=path.join(privateDir,'truth.json');
 const gold={schemaVersion:1,status:'FROZEN_VERIFIED',viewport:{width:375,height:1069},
  layers:checks.map(c=>({id:c.layerId,required:true,checks:[{id:c.id,property:c.property,expected:c.expected}]}))};
 await fs.writeFile(goldFile,JSON.stringify(gold));
 const planPath=path.join(privateDir,'mutations.json'),plan={schemaVersion:1,goldSha256:hash(await fs.readFile(goldFile)),
  mutations,controlIds:checks.slice(20,40).map(x=>x.id)};
 await fs.writeFile(planPath,JSON.stringify(plan));
 const autoPlan=path.join(privateDir,'auto-mutations.json'),autoReport=path.join(privateDir,'auto-report.json');
 let suggested=call(path.join(root,'benchmarks/v6.3.3/qa-plan.mjs'),'--clean',clean,'--gold',goldFile,'--out',autoPlan,'--report',autoReport);
 assert.equal(suggested.status,0,suggested.stderr+' '+suggested.stdout);
 const proposal=JSON.parse(await fs.readFile(autoPlan,'utf8'));
 assert.equal(proposal.mutations.length,20);
 assert.equal(proposal.controlIds.length,20);
 assertions+=3;
 const qaFile=path.join(privateDir,'qa-gold.json'),lockFile=path.join(privateDir,'fixture-lock.json');
 const options=['--clean',clean,'--gold',goldFile,'--plan',planPath,'--out',faulty,'--qa-gold-out',qaFile,'--lock-out',lockFile];
 let run=call(fixture,...options);assert.equal(run.status,0,run.stderr);assertions++;
 const faultApp=await fs.readFile(path.join(faulty,'src','App.vue'),'utf8');
 assert(faultApp.includes('.slot-0{width:113px;}'));
 assert(!faultApp.includes('BENCHMARK_MUTATION'));
 await assert.rejects(fs.access(path.join(faulty,'qa-gold.json')));
 assertions+=3;
 const lock=JSON.parse(await fs.readFile(lockFile,'utf8')),qa=JSON.parse(await fs.readFile(qaFile,'utf8'));
 assert.equal(lock.status,'SOURCE_MUTATIONS_SEEDED_NOT_BROWSER_VERIFIED');
 assert.equal(qa.mutatedIds.length,20);assert.equal(qa.controlIds.length,20);
 assert.equal(lock.categories.length,5);assertions+=4;
 run=call(fixture,...options);assert.notEqual(run.status,0,'reseed overwriting the source must be blocked');assertions++;
 const orig=checks.map(x=>({id:x.id,status:'MATCH'})),seeded=checks.map((x,i)=>({id:x.id,status:i<20?'MISMATCH':'MATCH'}));
 const runtime={captureEnvironment:'REAL_APP_RUNTIME',viewport:gold.viewport,regions:[],coverageComplete:true,errors:[],blockedExternalRequests:[],captureWarnings:[]};
 const runtimeBytes=Buffer.from(JSON.stringify(runtime)),runtimeHash=hash(runtimeBytes);
 const beforePath=path.join(privateDir,'clean-runtime.json'),afterPath=path.join(privateDir,'faulty-runtime.json');
 await fs.writeFile(beforePath,runtimeBytes);await fs.writeFile(afterPath,runtimeBytes);
 const report=entries=>({schemaVersion:1,status:'MISMATCH',expectedSha256:plan.goldSha256,actualSha256:runtimeHash,
  counts:{MATCH:entries.filter(x=>x.status==='MATCH').length,MISMATCH:entries.filter(x=>x.status==='MISMATCH').length,NOT_EVALUABLE:0},
  checks:entries,scopeErrors:[],missingRequiredRegions:[]});
 const cleanQuality=path.join(privateDir,'clean-quality.json'),faultyQuality=path.join(privateDir,'faulty-quality.json');
 await fs.writeFile(cleanQuality,JSON.stringify(report(orig)));
 await fs.writeFile(faultyQuality,JSON.stringify(report(seeded)));
 const output=path.join(privateDir,'fixture-proof.json');
 const params=['--clean',clean,'--faulty',faulty,'--gold',goldFile,'--qa-gold',qaFile,
  '--fixture-lock',lockFile,'--clean-quality',cleanQuality,'--faulty-quality',faultyQuality,
  '--clean-runtime',beforePath,'--faulty-runtime',afterPath,'--out',output];
 run=call(proof,...params);assert.equal(run.status,0,run.stderr);
 let p=JSON.parse(await fs.readFile(output,'utf8'));
 assert.equal(p.status,'QA_FIXTURE_VERIFIED_FOR_FROZEN_40');
 assert.equal(p.confirmedFaults,20);
 assert.equal(p.confirmedHealthyControls,20);assertions+=4;
 const corrupted=structuredClone(report(seeded));corrupted.checks[25].status='MISMATCH';
 await fs.writeFile(faultyQuality,JSON.stringify(corrupted));
 run=call(proof,...params.slice(0,-1),path.join(privateDir,'failed-control-proof.json'));
 assert.equal(run.status,2,'healthy control failing must block');
 assertions++;
 await fs.writeFile(path.join(faulty,'src','App.vue'),faultApp+'<!-- tampered -->');
 run=call(proof,...params.slice(0,-1),path.join(privateDir,'tampered-proof.json'));
 assert.equal(run.status,2,'mutated app source hash must remain pinned');
 assertions++;
 console.log('PASS v6.3.3 QA source mutation and fail-closed proof regression: '+assertions+' synthetic assertions');
}finally{await fs.rm(tmp,{recursive:true,force:true})}
