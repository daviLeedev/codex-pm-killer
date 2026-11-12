#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cli=path.join(base,'benchmarks/history/validate.mjs'),sample=JSON.parse(await fs.readFile(path.join(base,'benchmarks/history/2026-11-12-algolia-home-v6.3.json')));
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'pmk-hist-')),f=path.join(dir,'sample.json');
async function check(x,pass){await fs.writeFile(f,JSON.stringify(x));const r=spawnSync(process.execPath,[cli,f],{encoding:'utf8'});assert.equal(r.status===0,pass,r.stderr)}
try{
 await check(sample,true);
 await check({...sample,results:{...sample.results,A:{...sample.results.A,match:120}}},false);
 await check({...sample,apiKey:'sk-proj-test-secret'},false);
 await check({...sample,internal:'https://private.example'},false);
 await check({...sample,resultStatus:'PIXEL_PERFECT'},false);
 console.log('PASS v6.3.1 public history tests: 5');
}finally{await fs.rm(dir,{recursive:true,force:true})}
