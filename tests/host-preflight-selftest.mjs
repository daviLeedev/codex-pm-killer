#!/usr/bin/env node
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const script=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../scripts/host-preflight.mjs'),tmp=mkdtempSync(path.join(tmpdir(),'pmk-host-')),file=path.join(tmp,'host.json');
let checked=0;
function run(c){
 writeFileSync(file,JSON.stringify({schemaVersion:1,host:'test',capabilities:c}));
 const r=spawnSync(process.execPath,[script,'--config',file],{encoding:'utf8'});
 return {code:r.status,out:r.stdout?JSON.parse(r.stdout):null,err:r.stderr};
}
const full={filesystemRead:true,filesystemWrite:true,nodeProcess:true,terminal:true,appRuntimeBrowser:true,figmaViewerDirect:true,figmaViewerAuthenticated:true,subagents:true,secondDirectFigmaReviewer:true};
try{
 let r=run(full);assert.equal(r.code,0);assert.equal(r.out.status,'READY_REPORTED_CAPABILITIES');checked++;
 r=run({...full,figmaViewerDirect:false});assert.equal(r.code,2);assert(r.out.blockers.some(x=>x.code==='FIGMA_ACCESS_BLOCKED'));checked++;
 r=run({...full,subagents:false});assert.equal(r.code,0);assert.equal(r.out.parallelFigmaAndDom,false);assert(r.out.notes.some(x=>x.includes('sequentially')));checked++;
 r=run({...full,secondDirectFigmaReviewer:false});assert.equal(r.code,2);assert.equal(r.out.status,'PARTIAL');checked++;
 r=run({...full,nodeProcess:false});assert.equal(r.code,2);assert.equal(r.out.status,'BLOCKED');checked++;
 r=run({...full,filesystemRead:'yes'});assert.notEqual(r.code,0);checked++;
 console.log('host-preflight-selftest PASS '+checked+' scenarios');
}finally{rmSync(tmp,{recursive:true,force:true})}
