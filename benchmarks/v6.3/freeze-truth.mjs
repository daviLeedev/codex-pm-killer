#!/usr/bin/env node
/** Pre-registration snapshot. Cannot assert Figma data is true; pins bytes, count and evidence availability. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const a=process.argv.slice(2),arg=k=>{let i=a.indexOf('--'+k);return i<0?null:a[i+1]};
const expected=arg('expected'),out=arg('out'),root=path.resolve(arg('evidence-root')??process.cwd());
if(!expected||!out)throw Error('Usage: freeze-truth.mjs --expected frozen.json --out manifest.json --evidence-root ROOT [--legacy-count 150]');
const bytes=await fs.readFile(expected),sha=b=>createHash('sha256').update(b).digest('hex');
const truth=JSON.parse(bytes),ids=new Set(),problems=[],unknown=[],properties={};
const realRoot=await fs.realpath(root);
for(const layer of truth.layers??[])for(let i=0;i<(layer.checks||[]).length;i++){
 const c=layer.checks[i],id=c.id??`${layer.id}.${c.property}.${i}`;if(ids.has(id))problems.push('DUPLICATE_ID '+id);ids.add(id);
 properties[c.property]=(properties[c.property]||0)+1;
 const p=c.evidence??layer.evidence,hash=c.evidenceSha256??layer.evidenceSha256;
 if(!['FIGMA_UI_OBSERVED','FIGMA_UI_MEASURED'].includes(c.source??layer.source)){unknown.push({id,reason:'FIGMA_NOT_DIRECTLY_OBSERVED'});continue}
 if(!p||!hash){unknown.push({id,reason:'MISSING_EVIDENCE_HASH'});continue}
 try{
  const f=await fs.realpath(path.resolve(realRoot,p));if(!f.startsWith(realRoot+path.sep))throw Error('outside root');
  if(sha(await fs.readFile(f))!==hash)throw Error('SHA mismatch');
 }catch(e){unknown.push({id,reason:'EVIDENCE_MISSING_OR_CHANGED'})}
}
const legacy=arg('legacy-count');if(legacy&&ids.size!==Number(legacy))problems.push('LEGACY_COUNT_CHANGED wanted '+legacy+' actual '+ids.size);
if(!ids.size)problems.push('NO_ASSERTIONS');
const status=problems.length||unknown.length||truth.status!=='FROZEN_VERIFIED'?'PARTIAL':'FROZEN_RECORDED_EVIDENCE';
const result={schemaVersion:1,status,truthSha256:sha(bytes),truthPath:expected,assertions:ids.size,properties,unknown,problems,warning:'A file hash verifies bytes and scope, not whether the Figma values were accurately measured.'};
await fs.mkdir(path.dirname(path.resolve(out)),{recursive:true});await fs.writeFile(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status,assertions:ids.size,unknown:unknown.length,problems}));if(status!=='FROZEN_RECORDED_EVIDENCE')process.exitCode=2;
