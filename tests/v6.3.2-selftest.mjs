#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {evaluate} from '../benchmarks/v6.3/evaluate.mjs';
import {validateAssetPack} from '../benchmarks/v6.3/asset-pack.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'pmk-v632-unit-'));
let tests=0;
const same={width:375,height:1069};const ev='synthetic/evidence.txt';const hash='a'.repeat(64),opts={root:tmp,synthetic:true,hashes:new Map([[ev,hash]])};
const truth={schemaVersion:1,status:'FROZEN_VERIFIED',viewport:same,layers:[{id:'cta',required:true,source:'SYNTHETIC_TEST',evidence:ev,evidenceSha256:hash,checks:[{id:'CTA.width',property:'width',expected:40,severity:'P0'}]}]};
function audit(runtime){return evaluate(truth,{viewport:same,coverageComplete:true,regions:runtime,errors:[],blockedExternalRequests:[]},opts)}
try{
 let r=audit([{id:'cta',visible:true,width:40}]);assert.equal(r.checks[0].status,'MATCH');assert.deepEqual(r.missingRequiredRegions,[]);tests++;
 r=audit([]);assert.notEqual(r.status,'VERIFIED_RECORDED_SCOPE');assert.deepEqual(r.missingRequiredRegions,[{id:'cta',reason:'MISSING'}]);tests++;
 r=audit([{id:'cta',visible:false,width:40}]);assert.notEqual(r.status,'VERIFIED_RECORDED_SCOPE');assert.equal(r.missingRequiredRegions[0].reason,'HIDDEN');tests++;
 r=audit([{id:'cta',visible:true,width:40},{id:'cta',visible:true,width:40}]);assert.notEqual(r.status,'VERIFIED_RECORDED_SCOPE');assert.equal(r.missingRequiredRegions[0].reason,'DUPLICATE');tests++;
 const optional=structuredClone(truth);optional.layers[0].required=false;const optionalResult=evaluate(optional,{viewport:same,coverageComplete:true,regions:[]},opts);assert.equal(optionalResult.missingRequiredRegions.length,0);tests++;
 const font=structuredClone(truth);font.layers[0].checks[0]={id:'font',property:'font',expected:'Inter'};
 let fr=evaluate(font,{viewport:same,coverageComplete:true,regions:[{id:'cta',visible:true,actualRenderedFont:'Inter',fontActualUseVerified:false}]},opts);
 assert.equal(fr.checks[0].status,'NOT_EVALUABLE');tests++;
 fr=evaluate(font,{viewport:same,coverageComplete:true,regions:[{id:'cta',visible:true,actualRenderedFont:'Inter',fontActualUseVerified:true}]},opts);
 assert.equal(fr.checks[0].status,'MATCH');tests++;
 const asset=structuredClone(truth);asset.layers[0].checks[0]={id:'asset',property:'asset_pack_id',expected:'hero'};
 let ar=evaluate(asset,{viewport:same,coverageComplete:true,regions:[{id:'cta',visible:true,assetPackId:'hero'}]},opts);
 assert.equal(ar.checks[0].status,'MATCH');tests++;
 ar=evaluate(asset,{viewport:same,coverageComplete:true,regions:[{id:'cta',visible:true,assetPackId:'wrong'}]},opts);
 assert.equal(ar.checks[0].status,'MISMATCH');tests++;
 const assetDir=path.join(tmp,'assets');await fs.mkdir(path.join(assetDir,'images'),{recursive:true});
 const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="6"><rect width="10" height="6"/></svg>');await fs.writeFile(path.join(assetDir,'images/hero.svg'),svg);
 const manifest={schemaVersion:1,packId:'algolia-demo-v1',assets:[{id:'hero',source:'BENCHMARK_SUBSTITUTE',originalAvailable:false,license:'CC0 sample',path:'images/hero.svg',width:10,height:6,sha256:sha(svg)}]};
 const file=path.join(assetDir,'pack.json');await fs.writeFile(file,JSON.stringify(manifest));
 let pack=await validateAssetPack(file,{root:assetDir});assert.equal(pack.status,'READY');assert.equal(pack.originalVisualFidelity,'ORIGINAL_NOT_EVALUABLE');tests++;
 manifest.assets[0].sha256='0'.repeat(64);await fs.writeFile(file,JSON.stringify(manifest));pack=await validateAssetPack(file,{root:assetDir});assert.equal(pack.status,'PARTIAL');assert(pack.issues.some(s=>s.includes('HASH_MISMATCH')));tests++;
 manifest.assets[0].sha256=sha(svg);manifest.assets[0].path='../outside.svg';await fs.writeFile(file,JSON.stringify(manifest));pack=await validateAssetPack(file,{root:assetDir});assert.equal(pack.status,'PARTIAL');tests++;
 manifest.assets[0].path='images/hero.svg';manifest.assets[0].originalAvailable=true;await fs.writeFile(file,JSON.stringify(manifest));pack=await validateAssetPack(file,{root:assetDir});assert.equal(pack.status,'PARTIAL');tests++;
 console.log('PASS v6.3.2 unit tests '+tests+' assertions (required region, font, asset pack)');
}finally{await fs.rm(tmp,{recursive:true,force:true})}
