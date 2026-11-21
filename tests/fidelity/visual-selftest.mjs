#!/usr/bin/env node
/** Pixel diagnostic regression, not an independent Figma quality certification. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'pmk-visual-'));
try{
 const py=process.env.FIDELITY_PYTHON||'python3';
 const create=spawnSync(py,['-c',
  'from PIL import Image; import sys; a=Image.new("RGB",(80,50),"white"); b=a.copy();b.paste((220,40,40),(10,10,30,40));a.save(sys.argv[1]);b.save(sys.argv[2])',
  path.join(dir,'a.png'),path.join(dir,'b.png')],{encoding:'utf8'});
 assert.equal(create.status,0,create.stderr);
 await fs.writeFile(path.join(dir,'regions.json'),JSON.stringify({schemaVersion:1,regions:[{id:'CTA',x:0,y:0,width:40,height:50},{id:'Hero',x:40,y:0,width:40,height:50}]}));
 await fs.writeFile(path.join(dir,'masks.json'),JSON.stringify({masks:[{id:'Hero',x:40,y:0,width:40,height:50,reason:'ORIGINAL_ASSET_UNAVAILABLE'}]}));
 const run=spawnSync(process.execPath,[path.join(repo,'scripts/fidelity/visual-diff.mjs'),'--reference',path.join(dir,'a.png'),
  '--actual',path.join(dir,'b.png'),'--regions',path.join(dir,'regions.json'),'--masks',path.join(dir,'masks.json'),'--out',path.join(dir,'output')],{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr+' '+run.stdout);
 const d=JSON.parse(await fs.readFile(path.join(dir,'output','visual-report.json'),'utf8'));
 assert.equal(d.status,'VISUAL_DIAGNOSTIC_ONLY');assert.equal(d.regions.length,2);assert(d.regions[0].meanAbsRGB>0);
 await fs.access(path.join(dir,'output','heatmap.png'));await fs.access(path.join(dir,'output','overlay.png'));
 console.log('PASS v6.4.2 region visual diagnostic, mask and output evidence (5 checks)');
}finally{await fs.rm(dir,{recursive:true,force:true})}
