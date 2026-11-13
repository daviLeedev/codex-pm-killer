#!/usr/bin/env node
/** Auto-propose source mutations; real Chromium proof is still mandatory. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {parse,hashFile,writeJSON} from './core.mjs';
const a=process.argv.slice(2),opt=k=>{const i=a.indexOf('--'+k);return i<0?null:a[i+1]};
const rootArg=opt('clean'),goldFile=opt('gold'),output=opt('out'),reportFile=opt('report');
if(!rootArg||!goldFile||!output||!reportFile)throw Error('Usage: qa-plan.mjs --clean CLEAN_VUE --gold FROZEN_GOLD.json --out PRIVATE_PLAN.json --report PRIVATE_REPORT.json');
const root=await fs.realpath(rootArg),gold=await parse(goldFile),goldSha256=await hashFile(goldFile);
const checks=(gold.layers??[]).flatMap(l=>(l.checks??[]).map(c=>({...c,layerId:l.id})));
if(gold.status!=='FROZEN_VERIFIED'||checks.length!==150||new Set(checks.map(c=>c.id)).size!==150)throw Error('FROZEN_150_GOLD_REQUIRED');
for(const dst of [output,reportFile]){const p=path.resolve(dst);if(p===root||p.startsWith(root+path.sep))throw Error('PRIVATE_PLAN_INSIDE_AGENT_SOURCE')}
const files=[];
async function walk(dir){
 for(const e of await fs.readdir(dir,{withFileTypes:true})){
  if(e.isSymbolicLink())throw Error('SOURCE_SYMLINK_NOT_ALLOWED');
  if(e.name.startsWith('.')||['node_modules','dist','coverage','build'].includes(e.name))continue;
  const full=path.join(dir,e.name);
  if(e.isDirectory())await walk(full);
  else if(e.isFile()&&full.startsWith(path.join(root,'src')+path.sep)&&/\.(?:vue|css|scss)$/.test(e.name))
   files.push({filename:path.relative(root,full).replaceAll(path.sep,'/'),text:await fs.readFile(full,'utf8')});
 }
}
await walk(root);
const types={
 width:['geometry','width',13],height:['geometry','height',13],radius:['geometry','border-radius',11],
 gap:['spacing','gap',9],padding_top:['spacing','padding-top',9],padding_bottom:['spacing','padding-bottom',9],
 padding_left:['spacing','padding-left',9],padding_right:['spacing','padding-right',9],
 font_size:['typography','font-size',7],size:['typography','font-size',7],line_height:['typography','line-height',7],
 letter_spacing:['typography','letter-spacing',3],font_weight:['typography','font-weight',0],weight:['typography','font-weight',0],
 color:['color','color',0],fill:['color','background-color',0],background_color:['color','background-color',0],
 element_present:['structure','display',0]
};
const candidates=[];
for(const layer of gold.layers??[]){
 const id=layer.id,occ=[];
 for(const f of files.filter(x=>x.filename.endsWith('.vue'))){
  const marker='data-bench-id="'+id+'"',marker2="data-bench-id='"+id+"'";
  for(const val of [marker,marker2]){
   const pos=f.text.indexOf(val);if(pos<0||f.text.indexOf(val,pos+1)>=0)continue;
   const l=f.text.lastIndexOf('<',pos),r=f.text.indexOf('>',pos);
   if(l<0||r<pos)continue;
   const tag=f.text.slice(l,r+1),name=tag.match(/\bclass\s*=\s*["']([a-zA-Z0-9_\s-]+)["']/)?.[1]?.split(/\s+/)[0];
   if(name&&/^[a-zA-Z_][\w-]*$/.test(name))occ.push(name);
  }
 }
 if(occ.length!==1)continue;
 const className=occ[0],matched=[];
 for(const f of files){
  let index=f.text.indexOf('.'+className+'{');
  if(index<0)index=f.text.indexOf('.'+className+' {');
  if(index<0)continue;
  const begin=f.text.indexOf('{',index),end=f.text.indexOf('}',begin);
  if(end<0||f.text.slice(begin+1,end).includes('{'))continue;
  const rule=f.text.slice(index,end+1);
  if(rule.length>2000||f.text.split(rule).length!==2)continue;
  matched.push({file:f.filename,from:rule,body:f.text.slice(begin+1,end)});
 }
 if(matched.length!==1)continue;
 const r=matched[0];
 for(const check of layer.checks??[]){
  const def=types[check.property];if(!def)continue;
  const [category,prop,delta]=def;
  const decl=r.body.split(';').map(x=>x.trim()).find(x=>x.toLowerCase().startsWith(prop+':'));
  if(!decl)continue;
  const colon=decl.indexOf(':'),old=decl.slice(colon+1).trim(),expect=check.expected;
  let next;
  if(category==='color'){
   if(typeof expect!=='string'||!/^#[0-9a-f]{3,8}$/i.test(expect)||old.toLowerCase()!==expect.toLowerCase())continue;
   next=expect.toLowerCase()==='#c82266'?'#22aacc':'#c82266';
  }else if(prop==='display'){
   if(expect!==true||!['block','flex','grid','inline-block'].includes(old))continue;
   next='none';
  }else if(prop==='font-weight'){
   if(String(expect).trim().toLowerCase()!==old.toLowerCase())continue;
   next=old==='700'||old==='bold'?'400':'700';
  }else{
   const n=Number.parseFloat(old),e=Number(expect);
   if(!Number.isFinite(e)||!Number.isFinite(n)||Math.abs(e-n)>.01||!old.endsWith('px'))continue;
   next=Number((e+delta).toFixed(2))+'px';
  }
  if(!next||next===old)continue;
  const replaced=r.from.replace(decl,prop+': '+next);
  if(replaced===r.from)continue;
  candidates.push({assertionId:check.id,category,file:r.file,from:r.from,to:replaced,layerId:id});
 }
}
const groups=['color','typography','spacing','geometry','structure'],counts=Object.fromEntries(groups.map(g=>[g,0]));
const selected=[],usedLayers=new Set();
while(selected.length<20){
 const categories=groups.filter(g=>candidates.some(c=>c.category===g&&!usedLayers.has(c.layerId))).sort((a,b)=>counts[a]-counts[b]);
 if(!categories.length)break;
 const pick=candidates.find(c=>c.category===categories[0]&&!usedLayers.has(c.layerId));
 selected.push(pick);usedLayers.add(pick.layerId);counts[pick.category]++;
}
const controlIds=checks.filter(c=>!usedLayers.has(c.layerId)).slice(0,20).map(c=>c.id);
const ready=selected.length===20&&controlIds.length===20&&Object.values(counts).filter(Boolean).length>=4;
const report={schemaVersion:1,status:ready?'AUTO_DRAFT_REQUIRES_REAL_BROWSER_PROOF':'QA_AUTOPLAN_BLOCKED',
 candidates:candidates.length,selected:selected.length,controls:controlIds.length,categoryCounts:counts,
 warning:'Static exact CSS source candidates only; not proof that Figma assertion changes. No A/B/C paid experiment until independent Chromium proof.'};
await writeJSON(reportFile,report);
if(ready){
 const plan={schemaVersion:1,goldSha256,mutations:selected.map(({layerId,...x})=>x),controlIds};
 await writeJSON(output,plan);
}
console.log(JSON.stringify(report));if(!ready)process.exitCode=2;
