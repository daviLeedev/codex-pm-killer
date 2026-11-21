#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const entry=fs.readFileSync(path.join(root,'SKILL.md'),'utf8');
const legacy=fs.readFileSync(path.join(root,'references/legacy-skill-v6.4.2.md'),'utf8');
assert(Buffer.byteLength(entry)>2000&&Buffer.byteLength(entry)<7000);
for(const name of ['run.mjs','inventory.mjs','discover-dom.mjs','match-regions.mjs','detect.mjs','trace-css.mjs','plan-fix.mjs','patch-transaction.mjs','verify-patch.mjs','context-pack.mjs'])
 assert(entry.includes(name),'missing mandatory executable reference '+name);
assert(entry.includes('no Figma MCP')||entry.includes('No Figma MCP')||entry.includes('no Figma MCP,'));
assert(legacy.length>20000,'legacy procedures must be preserved');
console.log('PASS compact skill entry and preserved detail protocol ('+Buffer.byteLength(entry)+' bytes)');
