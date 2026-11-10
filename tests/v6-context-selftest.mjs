#!/usr/bin/env node
/** Synthetic context management mutation suite: air-gaps, budgets, hashes, resume. */
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const work=await mkdtemp(path.join(tmpdir(),'contextv6-'));
const qa=path.join(work,'.design-qa/v6');
const cli=path.join(skill,'scripts/v6-context.mjs');
const orch=path.join(skill,'scripts/v6-orchestrator.mjs');
let assertions=0;
const scope={figmaFrame:'Synthetic Modal',appRoute:'http://localhost:5173/synthetic',viewport:{width:400,height:844,deviceScaleFactor:1},baselineContentSha256:'a'.repeat(64)};
const cmd=(exe,...rest)=>{const r=spawnSync(process.execPath,[exe,rest[0],'--workspace',work,...rest.slice(1)],{encoding:'utf8'});return {ok:r.status===0,stdout:r.stdout,stderr:r.stderr}};
function pass(c,description){assert(c.ok,description+' '+c.stderr);assertions++}
function reject(c,description){assert(!c.ok,description+' should fail');assertions++}
async function put(name,contents){const f=path.join(qa,name);await mkdir(path.dirname(f),{recursive:true});await writeFile(f,contents);return path.relative(work,f).replaceAll('\\','/')}
async function note(task,id,kind,priority,summary,evidence){return cmd(cli,'note','--task',task,'--id',id,'--kind',kind,'--priority',priority,'--confidence','DIRECT','--summary',summary,'--evidence',evidence)}
async function stateChange(fn){const f=path.join(qa,'state.json');const s=JSON.parse(await readFile(f,'utf8'));fn(s);await writeFile(f,JSON.stringify(s,null,2)+'\n')}
async function pack(role){const r=cmd(cli,'pack','--task',role);pass(r,'Pack '+role);return JSON.parse(await readFile(path.join(qa,'context/packs',role+'.json'),'utf8'))}
try{
 const scopePath=await put('scope.json',JSON.stringify(scope));pass(cmd(orch,'init','--scope',scopePath),'Initialize v6');pass(cmd(cli,'init'),'Initialize context');
 const baseline=await put('proofs/baseline.txt','Synthetic baseline reference');
 pass(await note('main','priority-constraint','CONSTRAINT','P0','Keep view-only Figma and no API/MCP.',baseline),'Record shared constraint');
 reject(await note('main','priority-constraint','CONSTRAINT','P0','Duplicate note',baseline),'Reject note overwrite');
 reject(await note('main','credential','FACT','P1','Authorization: Bearer abcdefghijklmnopqrstuvwxyz',baseline),'Reject secret');
 reject(await note('main','invalid-path','FACT','P1','Outside workspace','../../etc/hosts'),'Reject outside path');
 await stateChange(s=>{for(const t of s.tasks)if(['figma','dom','difference','fixer','review','gate'].includes(t.id))t.status='ACTIVE'});
 const fig=await put('proofs/figma.txt','Observed Figma from synthetic viewer');
 const dom=await put('proofs/dom.txt','Measured actual app from synthetic runtime');
 const diff=await put('proofs/diff.txt','Calculated mismatch synthetic');
 pass(await note('figma','figma-width','FACT','P1','Figma close area size is expected 40.',fig),'Record Figma');
 pass(await note('dom','dom-width','FACT','P1','DOM close area measures 28.',dom),'Record DOM');
 pass(await note('difference','delta-width','FACT','P1','Discrepancy width negative 12.',diff),'Record comparison');
 let a=await pack('figma'),b=await pack('dom');
 assert(a.notes.every(n=>!['dom-width','delta-width'].includes(n.id)));assert(b.notes.every(n=>!['figma-width','delta-width'].includes(n.id)));assertions+=2;
 await stateChange(s=>{for(const t of s.tasks)if(['figma','dom','difference','fixer','review'].includes(t.id))t.status='DONE'});
 const c=await pack('difference'),d=await pack('fixer'),e=await pack('review'),g=await pack('gate');
 assert(c.notes.some(n=>n.id==='figma-width')&&c.notes.some(n=>n.id==='dom-width')&&!c.notes.some(n=>n.id==='delta-width'));assertions++;
 assert(d.notes.some(n=>n.id==='delta-width')&&!d.notes.some(n=>n.id==='dom-width'));assertions++;
 assert(e.notes.length===1&&e.notes[0].id==='priority-constraint'&&e.dependencyProofs.length===0);assertions++;
 assert(g.notes.some(n=>n.id==='delta-width')&&g.notes.some(n=>n.id==='dom-width'));assertions++;
 pass(cmd(cli,'verify'),'Verify evidence hashes');
 pass(cmd(cli,'checkpoint'),'Create checkpoint');pass(cmd(cli,'resume'),'Resume unchanged run');
 await stateChange(s=>{s.events.push({type:'SYNTHETIC_PROGRESS'})});
 reject(cmd(cli,'resume'),'Reject stale orchestrator snapshot');
 pass(cmd(cli,'checkpoint'),'Refresh checkpoint after state update');pass(cmd(cli,'resume'),'Resume fresh snapshot');
 await writeFile(path.join(qa,'proofs/dom.txt'),'Mutated after capture');
 reject(cmd(cli,'verify'),'Detect tampered raw evidence');
 reject(cmd(cli,'pack','--task','difference'),'Reject stale evidence when packaging');
 reject(cmd(cli,'checkpoint'),'Refuse unverifiable checkpoint');
 // Independent test: overflow of a pinned P0 note must not lead to silent omission.
 await writeFile(path.join(qa,'proofs/dom.txt'),'Measured actual app from synthetic runtime');
 const small=await put('small-budget.json',JSON.stringify({schemaVersion:1,maxCharsByRole:{figma:700,default:700}}));
 reject(cmd(cli,'pack','--task','figma','--config',path.join(work,small)),'Cannot truncate mandatory P0 notes');
 console.log('v6-context synthetic selftest PASS ('+assertions+' assertions including role isolation, tamper evidence, stale checkpoint, path privacy, budget)');
}finally{await rm(work,{recursive:true,force:true})}
