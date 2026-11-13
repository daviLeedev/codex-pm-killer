#!/usr/bin/env node
/** Regression: documented --manifest/--root/--out/--pack-id CLI options must work. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cli=path.join(repo,'benchmarks/v6.3/asset-pack.mjs');
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'pmk-asset-cli-'));
const sha=b=>createHash('sha256').update(b).digest('hex');
try{
 const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="10"><rect width="16" height="10"/></svg>');
 await fs.writeFile(path.join(tmp,'hero.svg'),svg);
 const manifest=path.join(tmp,'pack.json'),output=path.join(tmp,'asset-lock.json');
 const data={schemaVersion:1,packId:'test-home-assets-v1',assets:[{
  id:'hero',source:'BENCHMARK_SUBSTITUTE',originalAvailable:false,license:'Self-authored test SVG',
  width:16,height:10,path:'hero.svg',sha256:sha(svg)
 }]};
 await fs.writeFile(manifest,JSON.stringify(data));
 const run=(...args)=>spawnSync(process.execPath,[cli,...args],{encoding:'utf8'});
 const r=run('--manifest',manifest,'--root',tmp,'--out',output,'--pack-id','test-home-assets-v1');
 assert.equal(r.status,0,'documented flags must succeed: '+r.stderr);
 const lock=JSON.parse(await fs.readFile(output,'utf8'));
 assert.equal(lock.status,'READY');
 assert.equal(lock.count,1);
 assert.equal(lock.assets[0].status,'PASS');
 assert.equal(lock.manifestSha256,sha(await fs.readFile(manifest)));
 const wrong=run('--manifest',manifest,'--root',tmp,'--out',output,'--pack-id','other-pack');
 assert.equal(wrong.status,2,'pack-id mismatch must not certify READY');
 const omitted=run('--manifest',manifest,'--root',tmp);
 assert.notEqual(omitted.status,0,'missing --out must be rejected');
 console.log('PASS asset-pack documented CLI options and errors (7 assertions)');
}finally{await fs.rm(tmp,{recursive:true,force:true})}
