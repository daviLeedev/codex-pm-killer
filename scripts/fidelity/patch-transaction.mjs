#!/usr/bin/env node
/** Single-property patch transaction with durable original bytes and automatic rollback on REJECT.
 * Never edits a second file or runs untrusted scripts; the host performs real browser recapture.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {cliArg,load,sha256,fileHash,atomicWrite,required,withLock,safePath} from './core.mjs';
const op=process.argv[2],appRoot=cliArg('app-root'),dir=cliArg('tx-dir');
if(!['apply','finalize','recover','status'].includes(op)||!appRoot||!dir)
 throw Error('Usage: patch-transaction.mjs apply|finalize|recover|status --app-root VUE_PROJECT --tx-dir PRIVATE_DIR [--plan PATCH.json] [--verification VERIFY_INPUTS.json] [--out FINAL_VERDICT.json]');
const app=await fs.realpath(appRoot),root=path.resolve(dir),txPath=path.join(root,'transaction.json');
const allowed=/^src\/(?:[\w.-]+\/)*[\w.-]+\.(?:vue|css|scss)$/;
const cssProperty=/^(?:--[\w-]+|[a-z][a-z0-9-]*)$/i;
const decl=x=>{
 const m=String(x).trim().match(/^([a-z-]+|--[\w-]+)\s*:\s*([^;{}\r\n]+);?$/i);
 if(!m||!cssProperty.test(m[1])||/url\s*\(|expression\s*\(|javascript:|@import/i.test(m[2]))return null;
 return {property:m[1].toLowerCase(),value:m[2].trim()};
};
const output=cliArg('out');
async function act(){
 if(op==='apply'){
  const planPath=cliArg('plan');
  if(!planPath)throw Error('PATCH_PLAN_REQUIRED');
  const p=await load(planPath);
  required(p.schemaVersion===1&&/^[a-z0-9_-]{3,100}$/i.test(p.patchId??'')&&
   Array.isArray(p.issueIds)&&p.issueIds.length>0&&p.issueIds.every(x=>typeof x==='string'&&x)&&
   Array.isArray(p.changes)&&p.changes.length===1,'SINGLE_FILE_ONE_PROPERTY_PATCH_REQUIRED');
  const c=p.changes[0];
  required(typeof c.file==='string'&&allowed.test(c.file),'EDIT_MUST_BE_SCOPED_VUE_STYLE_SOURCE');
  const before=decl(c.find),after=decl(c.replace);
  required(before&&after&&before.property===after.property&&before.value!==after.value,'PATCH_MUST_CHANGE_ONE_CSS_DECLARATION');
  if(p.allowedProperty)required(before.property===p.allowedProperty,'PATCH_PROPERTY_NOT_APPROVED');
  try{await fs.access(txPath);throw Error('OPEN_TRANSACTION_EXISTS')}catch(e){if(e.code!=='ENOENT')throw e}
  const file=safePath(app,c.file),real=await fs.realpath(file);
  required(real.startsWith(app+path.sep),'SOURCE_SYMLINK_OUTSIDE_PROJECT');
  const contents=await fs.readFile(real,'utf8');
  required(contents.split(c.find).length===2,'PATCH_TARGET_MUST_APPEAR_EXACTLY_ONCE');
  const next=contents.replace(c.find,c.replace);
  required(next!==contents,'NO_SOURCE_CHANGE');
  await fs.mkdir(root,{recursive:true});
  const backupFile=path.join(root,'original-'+randomUUID()+'.bytes');
  const fd=await fs.open(backupFile,'wx',0o600);
  try{await fd.writeFile(Buffer.from(contents));await fd.sync()}finally{await fd.close()}
  const beforeSha=sha256(Buffer.from(contents)),afterSha=sha256(Buffer.from(next));
  const state={schemaVersion:1,patchId:p.patchId,status:'OPEN',file:c.file,backupFile:path.basename(backupFile),
   beforeSourceSha256:beforeSha,afterSourceSha256:afterSha,issueIds:p.issueIds,appliedProperty:before.property,
   patchPlanSha256:await fileHash(planPath),startedAt:new Date().toISOString()};
  await atomicWrite(txPath,state);
  const temp=real+'.fidelity-'+randomUUID()+'.tmp';
  const fileMode=(await fs.stat(real)).mode&0o777;
  await fs.writeFile(temp,next,{mode:fileMode});
  await fs.rename(temp,real);
  required(await fileHash(real)===afterSha,'POST_APPLY_SOURCE_HASH_MISMATCH');
  const receipt={schemaVersion:1,patchId:p.patchId,issueIds:p.issueIds,file:c.file,
   beforeSourceSha256:beforeSha,afterSourceSha256:afterSha,transactionStatus:'PATCH_APPLIED_NEEDS_REAL_APP_RECAPTURE'};
  if(output)await atomicWrite(output,receipt);
  console.log(JSON.stringify(receipt));return;
 }
 const state=await load(txPath);
 if(op==='status'){console.log(JSON.stringify(state));return}
 const current=safePath(app,state.file),real=await fs.realpath(current);
 required(real.startsWith(app+path.sep),'SOURCE_MOVED_OUTSIDE_PROJECT');
 if(op==='recover'){
  required(state.status==='OPEN','ONLY_OPEN_TRANSACTION_CAN_RECOVER');
  await rollback(state,real,'RECOVERED_ROLLBACK');
  console.log(JSON.stringify({status:'REJECT',rollbackCompleted:true,restoredSourceSha256:state.beforeSourceSha256,reason:'INTERRUPTED_PATCH_RECOVERY'}));return;
 }
 if(op==='finalize'){
  required(state.status==='OPEN','TRANSACTION_ALREADY_FINISHED');
  // The controller runs its own verifier. A model-authored verdict JSON is not trusted.
  const evidencePath=cliArg('verification');required(evidencePath,'INDEPENDENT_VERIFICATION_INPUTS_REQUIRED');
  const evidence=await load(evidencePath);
  const keys=['beforeDiff','afterDiff','beforeRuntime','afterRuntime','scope','patchReceipt'];
  required(keys.every(k=>typeof evidence[k]==='string'&&evidence[k]),'VERIFICATION_INPUTS_INCOMPLETE');
  const verifyScript=path.join(path.dirname(fileURLToPath(import.meta.url)),'verify-patch.mjs');
  const verified=path.join(root,'independent-verified-verdict.json');
  const params=keys.flatMap((key,i)=>['--'+['before-diff','after-diff','before-runtime','after-runtime','scope','patch'][i],evidence[key]]);
  const run=spawnSync(process.execPath,[verifyScript,...params,'--out',verified],{encoding:'utf8',timeout:60000});
  required([0,2].includes(run.status),'INDEPENDENT_VERIFIER_EXECUTION_FAILED: '+(run.stderr||run.stdout));
  const verdict=await load(verified);
  required(verdict.schemaVersion===1&&verdict.patchId===state.patchId&&verdict.verifiedBy==='scripts/fidelity/verify-patch.mjs'&&['ACCEPT','REJECT'].includes(verdict.status),
   'VERDICT_PATCH_BINDING_INVALID');
  required(await fileHash(real)===state.afterSourceSha256,'SOURCE_CHANGED_AFTER_PATCH_ISSUED');
  const final={...verdict,schemaVersion:1,transactionFile:state.file,
    patchId:state.patchId,sourceBeforeSha256:state.beforeSourceSha256,sourceAfterSha256:state.afterSourceSha256};
  if(verdict.status==='ACCEPT'){
   required(verdict.targetImproved===true&&verdict.regressionCount===0&&verdict.newP0===0&&verdict.scopeEqual===true&&
    Array.isArray(verdict.resolvedIssueIds)&&state.issueIds.every(x=>verdict.resolvedIssueIds.includes(x)),
    'INVALID_ACCEPT_VERDICT');
   state.status='ACCEPTED';state.finishedAt=new Date().toISOString();
   final.rollbackCompleted=false;final.restoredSourceSha256=null;
  }else{
   await rollback(state,real,'REVERTED');
   final.rollbackCompleted=true;final.restoredSourceSha256=state.beforeSourceSha256;
  }
  await atomicWrite(txPath,state);
  if(output)await atomicWrite(output,final);
  console.log(JSON.stringify({status:final.status,patchId:state.patchId,rollbackCompleted:final.rollbackCompleted}));
  return;
 }
}
async function rollback(state,real,status){
 const bytes=await fs.readFile(path.join(root,state.backupFile));
 required(sha256(bytes)===state.beforeSourceSha256,'BACKUP_BYTES_CHANGED');
 const sha=await fileHash(real);
 if(sha===state.beforeSourceSha256){
  state.status='RECOVERED_NO_CHANGE';state.finishedAt=new Date().toISOString();
  await atomicWrite(txPath,state);return;
 }
 required(sha===state.afterSourceSha256,'SOURCE_CHANGED_AFTER_PATCH_DONT_OVERWRITE');
 const temp=real+'.rollback-'+randomUUID();
 await fs.writeFile(temp,bytes,{mode:(await fs.stat(real)).mode&0o777});await fs.rename(temp,real);
 required(await fileHash(real)===state.beforeSourceSha256,'ROLLBACK_HASH_MISMATCH');
 state.status=status;state.finishedAt=new Date().toISOString();
 await atomicWrite(txPath,state);
}
await withLock(root,act);
