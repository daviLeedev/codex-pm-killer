#!/usr/bin/env node
/** Validate host-captured Figma read-only browser evidence. Does not call Figma API. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {sha256,cliArg,load,atomicWrite,required,verifiedFile,isSha} from './core.mjs';
const input=cliArg('input'),evidenceRoot=cliArg('evidence-root'),output=cliArg('out');
if(!input||!evidenceRoot||!output)throw Error('Usage: inventory.mjs --input PRIVATE_INVENTORY.json --evidence-root PRIVATE_ROOT --out VERIFIED.json');
const b=await fs.readFile(input),d=JSON.parse(b);
required(d.schemaVersion===1&&typeof d.frame?.id==='string'&&d.frame.id.trim(),'DESIGN_FRAME_UNDEFINED');
required(Number.isFinite(d.frame.width)&&Number.isFinite(d.frame.height)&&d.frame.width>0&&d.frame.height>0,'INVALID_FRAME_DIMENSIONS');
required(d.method==='AUTHENTICATED_VIEW_ONLY_BROWSER','FIGMA_BROWSER_EVIDENCE_REQUIRED');
required(typeof d.inspectorActor==='string'&&d.inspectorActor,'FIGMA_ACTOR_REQUIRED');
required(Array.isArray(d.regions)&&d.regions.length>0,'FIGMA_REGION_INVENTORY_EMPTY');
required(d.completeInventory===true,'FULL_INVENTORY_NOT_CLAIMED');
const ids=new Set(),parentKeys=new Set(),evidence=[],unknown=[],errors=[],regions=[];
for(const x of d.regions){
 if(!x.id||ids.has(x.id)){errors.push('REGION_ID_DUPLICATE_OR_EMPTY');continue}ids.add(x.id);
 if(typeof x.path!=='string'||!x.path||typeof x.role!=='string'||!x.role||!Number.isInteger(x.order)||x.order<0)
  errors.push('REGION_METADATA_INVALID: '+x.id);
 if(!['FIGMA_UI_OBSERVED','FIGMA_UI_MEASURED'].includes(x.source))unknown.push(x.id);
 if(!isSha(x.evidenceSha256)||!x.evidencePath){unknown.push(x.id);continue}
 try{evidence.push({...await verifiedFile(evidenceRoot,x.evidencePath,x.evidenceSha256),regionId:x.id})}
 catch(e){errors.push('REGION_EVIDENCE_INVALID: '+x.id+' '+e.message)}
 regions.push({id:x.id,path:x.path,role:x.role,parentId:x.parentId??null,order:x.order,required:x.required!==false,source:x.source,
  text:x.text??null,box:x.box??null,style:x.style??{},assetKind:x.assetKind??null,children:x.children??null,
  evidenceSha256:x.evidenceSha256});
}
for(const x of d.regions){
 if(x.parentId&&!ids.has(x.parentId))errors.push('MISSING_FIGMA_PARENT: '+x.id);
 const key=(x.parentId??'root')+'|'+x.order;
 if(parentKeys.has(key))errors.push('DUPLICATE_SIBLING_ORDER: '+key);
 parentKeys.add(key);
}
for(const x of d.regions){let p=x.parentId,seen=new Set([x.id]);while(p){if(seen.has(p)){errors.push('FIGMA_TREE_CYCLE: '+x.id);break}seen.add(p);p=d.regions.find(r=>r.id===p)?.parentId??null}}
const requiredIds=regions.filter(x=>x.required).map(x=>x.id);
const result={schemaVersion:1,status:errors.length||unknown.length?'PARTIAL':'VERIFIED_EVIDENCE_FILES',
 frame:d.frame,inspectorActor:d.inspectorActor,method:d.method,claimedInventoryComplete:true,
 originalVisualAssetAvailable:d.originalVisualAssetAvailable===true,requiredRegionIds:requiredIds,
 regions,evidenceFiles:evidence,unknown,errors,inventorySha256:sha256(b),
 warning:'Evidence file hashes and claimed browser observations do not independently prove Figma authenticity or exhaustive inventory.'};
await atomicWrite(output,result);console.log(JSON.stringify({status:result.status,regions:regions.length,required:requiredIds.length,unknown:unknown.length,errors}));
if(result.status!=='VERIFIED_EVIDENCE_FILES')process.exitCode=2;
