#!/usr/bin/env node
/** Portable adapter to existing Python/Pillow image comparison tooling. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {cliArg,required} from './core.mjs';
const args=['reference','actual','regions','out'],values=Object.fromEntries(args.map(k=>[k,cliArg(k)]));
if(Object.values(values).some(x=>!x))throw Error('Usage: visual-diff.mjs --reference FIGMA.png --actual APP.png --regions REGIONS.json --out DIFF_DIR [--masks PHOTO_MASKS.json]');
for(const key of ['reference','actual','regions'])await fs.access(values[key]);
const script=path.join(path.dirname(fileURLToPath(import.meta.url)),'visual_diff.py');
const p=process.env.FIDELITY_PYTHON||'python3';
const argv=[script,...args.flatMap(k=>['--'+k,values[k]]),...(cliArg('masks')?['--masks',cliArg('masks')]:[])];
const r=spawnSync(p,argv,{encoding:'utf8',timeout:60000});
if(r.status!==0)throw Error('Visual diff failed; Pillow may be missing: '+(r.stderr||r.stdout||r.error));
console.log(r.stdout.trim());
