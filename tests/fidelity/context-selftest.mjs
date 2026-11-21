#!/usr/bin/env node
/** Compact, safe task pack assembly: no hidden benchmark Gold, deterministic byte bound. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),cli=path.join(repo,'scripts/fidelity/context-pack.mjs');
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'pmk-context-pack-'));
const sha=b=>createHash('sha256').update(b).digest('hex');
try{
 const app=path.join(tmp,'app');await fs.mkdir(path.join(app,'src'),{recursive:true});
 await fs.writeFile(path.join(app,'src','CTA.vue'),'<style>\n.cta{\n width: 300px;\n height: 50px;\n padding-top: 28px;\n}\n</style>');
 const issues={schemaVersion:1,status:'ISSUES_RECORDED',issues:Array.from({length:5},(_,i)=>({
  issueId:'CTA-'+i,severity:'P1',category:'GEOMETRY',domSelector:'.cta',
  comparison:{property:'width',expected:{value:320,source:'FIGMA_UI_MEASURED'},actual:{value:300,source:'APP_RUNTIME_MEASURED'},delta:-20,tolerance:1},
  evidence:{figmaSha256:'a'.repeat(64),runtimeSha256:'b'.repeat(64)}}))};
 const issueFile=path.join(tmp,'issues.json'),planFile=path.join(tmp,'plans.json'),out=path.join(tmp,'pack.json');
 await fs.writeFile(issueFile,JSON.stringify(issues));
 const plans={schemaVersion:1,status:'FIX_PLANS_READY',inputIssuesSha256:sha(await fs.readFile(issueFile)),
  plans:issues.issues.map(x=>({issueId:x.issueId,property:'width',hypothesis:{cause:'LOCAL_STYLE_OR_COMPONENT',confidence:'CDP_RULE_CANDIDATES'},
   cssCandidates:[{selector:'.cta',sourceFile:'src/CTA.vue',sourceGrade:'EXISTING_LOCAL_SOURCE_CANDIDATE'}],
   fixPolicy:{maxFiles:1,maxProperties:1}}))};
 await fs.writeFile(planFile,JSON.stringify(plans));
 const args=['--issues',issueFile,'--plans',planFile,'--project-root',app,'--out',out,'--max-issues','2','--max-bytes','3500'];
 const r=spawnSync(process.execPath,[cli,...args],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr+' '+r.stdout);
 const pack=JSON.parse(await fs.readFile(out,'utf8'));
 assert.equal(pack.status,'SCOPED_FIX_CONTEXT');
 assert.equal(pack.tasks.length,2);
 assert(Buffer.byteLength(JSON.stringify(pack))<=3500);
 assert(pack.tasks[0].sourceSnippets.some(x=>x.relativeFile==='src/CTA.vue'));
 assert(!JSON.stringify(pack).includes('sk-proj'));
 await fs.writeFile(planFile,JSON.stringify({...plans,inputIssuesSha256:'c'.repeat(64)}));
 const fail=spawnSync(process.execPath,[cli,...args],{encoding:'utf8'});
 assert.notEqual(fail.status,0);
 console.log('PASS scoped fix context pack with hash and byte limit (6 assertions)');
}finally{await fs.rm(tmp,{force:true,recursive:true})}
