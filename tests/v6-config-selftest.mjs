#!/usr/bin/env node
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const dir=await mkdtemp(path.join(tmpdir(),'pmv6-model-'));
try{
 const src=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../scripts/v6-generate-agents.mjs');
 const config=path.join(dir,'models.json'),out=path.join(dir,'.codex/agents');
 await writeFile(config,JSON.stringify({dom:'gpt-6-luna',figma:'gpt-6.1-sol',difference:'gpt-6.1-sol',fixer:'gpt-6.1-sol',review:'gpt-6.1-sol'}));
 const test=(...args)=>spawnSync(process.execPath,[src,'--model-map',config,'--out',out,...args],{encoding:'utf8'});
 assert.equal(test().status,0,'Generator should succeed');
 assert.equal((await readdir(out)).length,5);
 const d=await readFile(path.join(out,'pm-dom-inspector.toml'),'utf8');assert.match(d,/model = "gpt-6-luna"/);assert.match(d,/name = "pm-dom-inspector"/);
 assert.match(d,/developer_instructions = /);assert.doesNotMatch(d,/mcp_servers|sandbox_mode/);
 await writeFile(config,JSON.stringify({dom:'bad model\nunsafe'}));assert.notEqual(test().status,0,'Reject non-ID/escaped model injection');
 console.log('PASS v6 model config: 5 Codex TOMLs and invalid model injection rejection');
}finally{await rm(dir,{recursive:true,force:true})}
