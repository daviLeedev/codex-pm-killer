import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export const hashFile=async file=>sha256(await fs.readFile(file));
export const excluded=new Set(['.git','node_modules','dist','build','coverage','.nuxt','.next','.output','.design-qa','.env','.env.local','.env.production','.cache','.DS_Store']);
export async function treeHash(root){
 const rootPath=await fs.realpath(root);const rows=[];
 async function walk(dir,rel=''){
  for(const d of (await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
   if(excluded.has(d.name))continue;
   if(d.isSymbolicLink())throw Error('SYMLINK_NOT_ALLOWED: '+path.join(rel,d.name));
   const name=path.join(rel,d.name),full=path.join(dir,d.name);
   if(d.isDirectory())await walk(full,name);
   else if(d.isFile())rows.push(name.replaceAll(path.sep,'/')+' '+await hashFile(full));
   else throw Error('UNSUPPORTED_ENTRY: '+full);
  }
 }
 await walk(rootPath);
 if(!rows.length)throw Error('EMPTY_PROJECT: '+root);
 return sha256(Buffer.from(rows.join('\n')+'\n'));
}
export function within(root,p){
 const full=path.resolve(root,p),base=path.resolve(root);
 if(full!==base&&!full.startsWith(base+path.sep))throw Error('OUTSIDE_ALLOWED_ROOT');
 return full;
}
export async function copyClean(src,dest){
 await fs.cp(src,dest,{recursive:true,force:false,errorOnExist:true,filter:async filename=>{
  const l=await fs.lstat(filename);
  if(l.isSymbolicLink())throw Error('SYMLINK_NOT_ALLOWED: '+filename);
  return !excluded.has(path.basename(filename));
 }});
}
export const parse=async file=>JSON.parse(await fs.readFile(file,'utf8'));
export async function writeJSON(file,data){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600})}
export const onlyABC=obj=>['A','B','C'].every(k=>obj&&Object.hasOwn(obj,k));
export function validatePlan(p){
 if(p.schemaVersion!==1||p.scope!=='Algolia-Mobile-Home'||!p.runId||!(/^[a-z0-9][a-z0-9_-]{7,79}$/i.test(p.runId)))throw Error('PLAN_SCOPE_OR_ID_INVALID');
 if(!p.figmaUrl?.startsWith('https://www.figma.com/')||!p.task?.trim())throw Error('FIGMA_OR_TASK_MISSING');
 if(!p.inputs||Object.values(['implementationProject','qaFaultyProject','goldTruth','qaGold','assetManifest']).some(k=>typeof p.inputs[k]!=='string'||!p.inputs[k]))throw Error('PLAN_INPUTS_MISSING');
 if(!p.models||p.models.A!==p.models.B||!p.models.A||!p.models.C)throw Error('A_B_MODEL_PARITY_FAILED');
 if(!['low','medium','high'].includes(p.reasoning)||!Number.isInteger(p.viewport?.width)||!Number.isInteger(p.viewport?.height))throw Error('PLAN_RUNTIME_UNFIXED');
 if(typeof p.approvedCapUsd!=='number'||p.approvedCapUsd<=0||p.approvedCapUsd>10)throw Error('BUDGET_NOT_APPROVED');
 if(!p.skillCommit||!p.evaluatorCommit||!p.protocolVersion||!p.browserVersion)throw Error('VERSION_LOCK_MISSING');
}
export function overlap(a,b){return Math.max(0,Math.min(a.end,b.end)-Math.max(a.start,b.start))}
