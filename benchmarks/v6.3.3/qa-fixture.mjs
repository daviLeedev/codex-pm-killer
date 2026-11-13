#!/usr/bin/env node
/** Create 20 known but hidden in-place faults in an independently prepared Vue Home.
 * No Figma browser, network, model API, or evaluator access. Never seed from A/B/C output.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {parse,hashFile,treeHash,copyClean,writeJSON} from './core.mjs';

const args=process.argv.slice(2),opt=k=>{const i=args.indexOf('--'+k);return i<0?null:args[i+1]};
const clean=opt('clean'),goldPath=opt('gold'),planPath=opt('plan'),out=opt('out'),qaGoldPath=opt('qa-gold-out'),lockPath=opt('lock-out');
if([clean,goldPath,planPath,out,qaGoldPath,lockPath].some(x=>!x))throw Error('Usage: qa-fixture.mjs --clean CLEAN_VUE --gold FROZEN_GOLD.json --plan PRIVATE_MUTATIONS.json --out NEW_FAULTY_VUE --qa-gold-out PRIVATE/qa-gold.json --lock-out PRIVATE/fixture-lock.json');

const root=await fs.realpath(clean),dest=path.resolve(out),gold=await parse(goldPath),plan=await parse(planPath),sha=await hashFile(goldPath);
const realPlan=await fs.realpath(planPath),realGold=await fs.realpath(goldPath);
if([dest,path.resolve(qaGoldPath),path.resolve(lockPath)].some(p=>p===root||p.startsWith(root+path.sep)))throw Error('OUTPUT_OR_SECRET_INSIDE_CLEAN_PROJECT');
if([root,realGold,realPlan].some(p=>dest===p||dest.startsWith(p+path.sep)||p.startsWith(dest+path.sep)))throw Error('DESTINATION_OVERLAPS_INPUT');
if(path.resolve(qaGoldPath)===path.resolve(lockPath))throw Error('QA_GOLD_AND_LOCK_MUST_BE_SEPARATE');
for(const target of [qaGoldPath,lockPath]){
 const p=path.resolve(target);
 if(p===dest||p.startsWith(dest+path.sep))throw Error('HIDDEN_QA_GOLD_OR_LOCK_INSIDE_FAULTY_PROJECT');
 try{await fs.access(p);throw Error('OUTPUT_ALREADY_EXISTS: '+p)}catch(e){if(e.code!=='ENOENT')throw e}
}
try{await fs.access(dest);throw Error('FAULTY_DESTINATION_EXISTS')}catch(e){if(e.code!=='ENOENT')throw e}

const goldChecks=(gold.layers??[]).flatMap(l=>(l.checks??[]));
const goldIds=new Set(goldChecks.map(c=>c.id));
if(gold.status!=='FROZEN_VERIFIED'||goldChecks.length!==150||goldIds.size!==150)throw Error('UNVERIFIED_OR_CHANGED_150_ASSERTION_GOLD');
if(plan.schemaVersion!==1||plan.goldSha256!==sha)throw Error('PRIVATE_MUTATION_PLAN_MUST_REFERENCE_FROZEN_GOLD_HASH');
if(!Array.isArray(plan.mutations)||plan.mutations.length!==20||!Array.isArray(plan.controlIds)||plan.controlIds.length!==20)throw Error('REQUIRE_EXACTLY_20_MUTATIONS_AND_20_CONTROLS');
const mutantIds=new Set(),controlIds=new Set(plan.controlIds);
if(controlIds.size!==20)throw Error('DUPLICATE_CONTROL_ID');
const categories=new Set(),fileEdits=new Map(),signatures=new Set(),safeFile=/^src\/[a-zA-Z0-9_./-]+\.(?:vue|css|scss|ts|tsx)$/;
for(const m of plan.mutations){
 if(!m||typeof m!=='object'||typeof m.assertionId!=='string'||!goldIds.has(m.assertionId)||mutantIds.has(m.assertionId))throw Error('INVALID_OR_DUPLICATE_MUTATION_ASSERTION_ID');
 mutantIds.add(m.assertionId);
 if(!['geometry','spacing','typography','color','asset','structure','text'].includes(m.category))throw Error('INVALID_MUTATION_CATEGORY');
 categories.add(m.category);
 if(typeof m.file!=='string'||!safeFile.test(m.file)||m.file.split('/').includes('..'))throw Error('UNSAFE_SOURCE_MUTATION_PATH');
 if(typeof m.from!=='string'||typeof m.to!=='string'||m.from.length<4||m.from.length>2000||m.to.length>2000||!m.to||m.from===m.to)throw Error('INVALID_SOURCE_REPLACEMENT');
 if(/(?:BENCHMARK_MUTATION|QA_MUTATION|INJECTED_DEFECT|FIXME|GOLD_ANSWER)/i.test(m.to))throw Error('FAULT_MARKER_WOULD_LEAK_ANSWER');
 const key=m.file+'||'+m.from;
 if(signatures.has(key))throw Error('DUPLICATE_MUTATION_SOURCE');
 signatures.add(key);
 if(!fileEdits.has(m.file))fileEdits.set(m.file,[]);
 fileEdits.get(m.file).push(m);
}
if([...controlIds].some(x=>!goldIds.has(x)||mutantIds.has(x)))throw Error('CONTROL_ID_NOT_IN_GOLD_OR_OVERLAPS_MUTATION');
if(categories.size<4)throw Error('MUTATIONS_NOT_DIVERSE_ENOUGH: require >=4 defect categories');
const cleanHash=await treeHash(root);
const original=new Map(),changed=new Map();
for(const [filename,edits] of fileEdits){
 const full=path.resolve(root,filename);
 if(!full.startsWith(root+path.sep))throw Error('ESCAPED_SOURCE_ROOT');
 const real=await fs.realpath(full);
 if(!real.startsWith(root+path.sep))throw Error('SOURCE_SYMLINK_OUTSIDE_ROOT');
 const body=await fs.readFile(real,'utf8');
 let updated=body;
 for(const m of edits){
  const appearances=body.split(m.from).length-1;
  if(appearances!==1)throw Error('MUTATION_SOURCE_NOT_UNIQUE: '+m.assertionId+' in '+filename+' ('+appearances+')');
  if(updated.split(m.from).length-1!==1)throw Error('OVERLAPPING_OR_STALE_MUTATION: '+m.assertionId);
  updated=updated.replace(m.from,m.to);
 }
 original.set(filename,body);changed.set(filename,updated);
}
await copyClean(root,dest);
for(const [filename,value] of changed)await fs.writeFile(path.resolve(dest,filename),value);
const faultyHash=await treeHash(dest);
if(faultyHash===cleanHash)throw Error('MUTATIONS_DID_NOT_CHANGE_PROJECT');
const qaGold={schemaVersion:1,sourceGoldSha256:sha,mutatedIds:[...mutantIds],controlIds:[...controlIds],
 warning:'PRIVATE scoring truth. Never expose this file, mutation plan or clean reference to A/B/C agents.'};
await writeJSON(qaGoldPath,qaGold);
const lock={schemaVersion:1,status:'SOURCE_MUTATIONS_SEEDED_NOT_BROWSER_VERIFIED',
 originalReferenceSourceSha256:cleanHash,faultySourceSha256:faultyHash,
 goldSha256:sha,qaGoldSha256:await hashFile(qaGoldPath),mutationPlanSha256:await hashFile(planPath),
 mutationCount:mutantIds.size,controlCount:controlIds.size,categories:[...categories].sort(),
 changedFiles:[...changed.keys()].sort(),
 warning:'Source replacements are NOT proof the intended Figma/DOM assertions actually fail. Must run qa-fixture-proof.mjs against real Chromium before the fixture is authorized.'};
await writeJSON(lockPath,lock);
console.log(JSON.stringify({status:lock.status,mutations:20,controls:20,categories:lock.categories,changedFiles:lock.changedFiles.length,output:dest}));
