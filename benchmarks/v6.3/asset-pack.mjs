#!/usr/bin/env node
/** Immutable private substitute-asset manifest validation. No downloads or external calls. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const hash=b=>createHash('sha256').update(b).digest('hex');
const allowedSources=new Set(['BENCHMARK_SUBSTITUTE','ORIGINAL_FIGMA']);
const allowedExt=new Set(['.png','.jpg','.jpeg','.webp','.svg']);
const formatByExt={'.png':'PNG','.jpg':'JPEG','.jpeg':'JPEG','.webp':'WEBP','.svg':'SVG'};
const validHash=s=>typeof s==='string'&&/^[0-9a-f]{64}$/i.test(s);
function dimensions(bytes,ext){
 if(ext==='.png' && bytes.length>=24 && bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))
  return {type:'PNG',width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
 if(ext==='.jpg'||ext==='.jpeg'){
  if(bytes[0]!==0xff||bytes[1]!==0xd8)return null;
  for(let i=2;i+9<bytes.length;){
   if(bytes[i]!==0xff){i++;continue}
   const marker=bytes[i+1];if(marker===0xd8||marker===0xd9){i+=2;continue}
   if(marker===0xda)break;
   const len=bytes.readUInt16BE(i+2);if(len<2||i+2+len>bytes.length)break;
   if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))
    return {type:'JPEG',height:bytes.readUInt16BE(i+5),width:bytes.readUInt16BE(i+7)};
   i+=2+len;
  }
  return null;
 }
 if(ext==='.webp'&&bytes.length>=30 && bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'){
  const chunk=bytes.toString('ascii',12,16);
  if(chunk==='VP8X'&&bytes.length>=30)return {type:'WEBP',width:1+bytes.readUIntLE(24,3),height:1+bytes.readUIntLE(27,3)};
  if(chunk==='VP8 '&&bytes.length>=30&&bytes[23]===0x9d&&bytes[24]===0x01&&bytes[25]===0x2a)
   return {type:'WEBP',width:bytes.readUInt16LE(26)&0x3fff,height:bytes.readUInt16LE(28)&0x3fff};
  if(chunk==='VP8L'&&bytes.length>=25&&bytes[20]===0x2f){const bits=bytes.readUInt32LE(21);return {type:'WEBP',width:(bits&0x3fff)+1,height:((bits>>14)&0x3fff)+1}}
  return null;
 }
 if(ext==='.svg'){
  const text=bytes.toString('utf8');if(!/^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(text)||/<script\b|onload\s*=|<foreignObject\b/i.test(text))return null;
  const opening=text.match(/<svg\b[^>]*>/i)?.[0]||'';
  const val=(name)=>{const match=opening.match(new RegExp('\\b'+name+'\\s*=\\s*["\\\']([0-9.]+)(?:px)?["\\\']','i'));return match?Number(match[1]):null};
  let width=val('width'),height=val('height');const box=opening.match(/\bviewBox\s*=\s*["']([\d.\s-]+)["']/i);
  if((!width||!height)&&box){const a=box[1].trim().split(/[\s,]+/).map(Number);if(a.length===4&&a.every(Number.isFinite)){width||=a[2];height||=a[3]}}
  if(width&&height)return {type:'SVG',width,height};return null;
 }
 return null;
}
export async function validateAssetPack(manifestPath,{root,expectedPackId}={}){
 const warnings=[],issues=[],assets=[],ids=new Set();const base=await fs.realpath(path.resolve(root||path.dirname(manifestPath)));
 const manifestFile=await fs.realpath(path.resolve(manifestPath));
 if(!(manifestFile===base||manifestFile.startsWith(base+path.sep)))throw Error('Manifest outside asset root');
 const bytes=await fs.readFile(manifestFile),manifest=JSON.parse(bytes);
 if(manifest.schemaVersion!==1||!Array.isArray(manifest.assets)||!manifest.assets.length)issues.push('INVALID_MANIFEST');
 if(typeof manifest.packId!=='string'||!/^[a-z0-9][a-z0-9._-]{2,80}$/i.test(manifest.packId||''))issues.push('INVALID_PACK_ID');
 if(expectedPackId&&manifest.packId!==expectedPackId)issues.push('PACK_ID_MISMATCH');
 for(const asset of manifest.assets||[]){
  const id=asset.id||'(missing)';const errors=[];
  if(!/^[a-z0-9][a-z0-9._-]{1,80}$/i.test(id)||ids.has(id))errors.push('INVALID_OR_DUPLICATE_ID');ids.add(id);
  if(!allowedSources.has(asset.source))errors.push('INVALID_SOURCE');
  if(typeof asset.license!=='string'||!asset.license.trim())errors.push('LICENSE_MISSING');
  if(!Number.isInteger(asset.width)||asset.width<1||!Number.isInteger(asset.height)||asset.height<1)errors.push('DIMENSIONS_MISSING');
  if(asset.source==='BENCHMARK_SUBSTITUTE'&&asset.originalAvailable!==false)errors.push('SUBSTITUTE_MUST_NOT_CLAIM_ORIGINAL');
  if(asset.source==='ORIGINAL_FIGMA'&&(!asset.originalAvailable||!asset.figmaEvidenceId))errors.push('ORIGINAL_EVIDENCE_REQUIRED');
  if(!validHash(asset.sha256))errors.push('HASH_MISSING');
  let bytesCount=0,actualHash=null,observed=null;
  const p=asset.path;
  if(typeof p!=='string'||path.isAbsolute(p)||p.split(/[\\/]/).some(s=>!s||s==='..')||p.includes('\\'))errors.push('UNSAFE_PATH');
  else{
   const full=path.resolve(base,p);const ext=path.extname(p).toLowerCase();
   if(!allowedExt.has(ext))errors.push('UNSUPPORTED_TYPE');
   try{
    const actualPath=await fs.realpath(full);if(!actualPath.startsWith(base+path.sep))throw Error('ESCAPES_ASSET_ROOT');
    const content=await fs.readFile(actualPath);bytesCount=content.length;actualHash=hash(content);
    if(actualHash!==asset.sha256?.toLowerCase())errors.push('HASH_MISMATCH');
    observed=dimensions(content,ext);
    if(!observed)errors.push('FILE_FORMAT_OR_SIZE_UNVERIFIED');
    else if(observed.type!==formatByExt[ext]||observed.width!==asset.width||observed.height!==asset.height)errors.push('IMAGE_DIMENSIONS_MISMATCH');
   }catch(err){errors.push('FILE_MISSING_OR_UNSAFE:'+err.message)}
  }
  if(errors.length)issues.push(...errors.map(e=>id+':'+e));
  assets.push({id,source:asset.source,originalAvailable:asset.originalAvailable===true,path:p,sha256:actualHash,bytes:bytesCount,width:observed?.width??null,height:observed?.height??null,status:errors.length?'FAIL':'PASS',errors});
 }
 const status=issues.length?'PARTIAL':'READY';
 return {schemaVersion:1,status,packId:manifest.packId??null,manifestSha256:hash(bytes),count:assets.length,assets,issues,warnings,originalVisualFidelity:assets.every(x=>x.originalAvailable&&x.status==='PASS')?'SOURCE_CLAIM_RECORDED':'ORIGINAL_NOT_EVALUABLE',warning:'Substitutes are suitable for shared asset integration tests, not original Figma image/pixel fidelity.'};
}
const opt=k=>{const i=process.argv.indexOf('--'+k);return i<0?null:process.argv[i+1]};
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const input=opt('--manifest'),out=opt('--out');if(!input||!out)throw Error('Usage: asset-pack.mjs --manifest pack.json --root directory --out asset-lock.json');
 const result=await validateAssetPack(input,{root:opt('--root')||path.dirname(input),expectedPackId:opt('--pack-id')||undefined});
 await fs.mkdir(path.dirname(path.resolve(out)),{recursive:true});await fs.writeFile(out,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({status:result.status,assets:result.count,issues:result.issues,assetLock:out}));if(result.status!=='READY')process.exitCode=2;
}
