#!/usr/bin/env node
import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const run=(script,...args)=>spawnSync(process.execPath,[path.join(root,'scripts',script),...args],{encoding:'utf8'});
let r=run('validate-knowledge.mjs');assert.equal(r.status,0,r.stdout+' '+r.stderr);
r=run('find-relevant-patterns.mjs','--query','모바일 줄바꿈 line-height');assert.equal(r.status,0,r.stderr);const found=JSON.parse(r.stdout);assert.ok(found.results.some(p=>p.id==='QA-0003'));assert.ok(found.results.some(p=>p.id==='QA-0004'));
r=run('find-relevant-patterns.mjs','--query','router watch 종료');assert.equal(r.status,0,r.stderr);assert.ok(JSON.parse(r.stdout).results.some(p=>p.id==='QA-0005'));
console.log('PASS: knowledge validation + relevant pattern search (typography, responsive, router/watch)');
