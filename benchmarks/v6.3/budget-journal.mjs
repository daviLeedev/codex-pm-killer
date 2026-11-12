#!/usr/bin/env node
/** Local prepaid API experiment ledger. No provider calls, price lookup or model switching. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
const a=process.argv.slice(2),action=a.shift(),arg=k=>{const i=a.indexOf('--'+k);return i<0?null:a[i+1]};
const dir=path.resolve(arg('dir')??'.design-qa/api-budget'),stateFile=path.join(dir,'ledger.json'),lock=path.join(dir,'.lock');
const requireArg=k=>{const v=arg(k);if(!v||v.startsWith('--'))throw Error('Missing --'+k);return v};
const micro=raw=>{if(typeof raw!=='string'||!/^\d+(?:\.\d{1,6})?$/.test(raw))throw Error('USD must be a nonnegative decimal <=6 places');const [a,b='']=raw.split('.');const v=BigInt(a)*1000000n+BigInt(b.padEnd(6,'0'));if(v>BigInt(Number.MAX_SAFE_INTEGER))throw Error('USD too large');return Number(v)};
const money=n=>(n/1e6).toFixed(6);
const hash=b=>createHash('sha256').update(b).digest('hex');
async function atomic(file,data){await fs.mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';const fd=await fs.open(temp,'wx',0o600);try{await fd.writeFile(data);await fd.sync()}finally{await fd.close()}await fs.rename(temp,file)}
async function tx(fn){await fs.mkdir(dir,{recursive:true});let got=false;for(let i=0;i<30;i++){try{await fs.mkdir(lock);got=true;break}catch(e){if(e.code!=='EEXIST')throw e;await new Promise(r=>setTimeout(r,30))}}if(!got)throw Error('Ledger busy: no stale-lock takeover');try{return await fn()}finally{await fs.rmdir(lock)}}
const read=async()=>JSON.parse(await fs.readFile(stateFile,'utf8'));
const write=async j=>atomic(stateFile,JSON.stringify(j,null,2)+'\n');
function totals(j){const actual=j.requests.filter(x=>x.state==='SETTLED').reduce((v,x)=>v+x.actualMicro,0);const reserved=j.requests.filter(x=>x.state!=='SETTLED'&&x.state!=='VOID').reduce((v,x)=>v+x.reservedMicro,0);return {cap:money(j.capMicro),settled:money(actual),reserved:money(reserved),available:money(j.capMicro-actual-reserved)}}
const output=o=>console.log(JSON.stringify(o,null,2));
try{
 if(action==='init')await tx(async()=>{
  try{await fs.access(stateFile);throw Error('Ledger exists: do not overwrite billing history')}catch(e){if(e.code!=='ENOENT')throw e}
  const cap=micro(arg('cap-usd')??'5.000000');if(cap>5000000)throw Error('Approved user ceiling is $5.00; do not override without a new explicit authorization workflow');
  const j={schemaVersion:1,capMicro:cap,requests:[],events:[],createdAt:new Date().toISOString(),warning:'Software reservation cap only. Cannot guarantee external provider bills or unknown tool charges.'};
  await write(j);output({status:'INITIALIZED',...totals(j)});
 });
 else if(action==='reserve')await tx(async()=>{
  const j=await read(),id=requireArg('request-id'),model=requireArg('model'),max=micro(requireArg('max-usd'));
  if(!max||max>j.capMicro)throw Error('Invalid request maximum');
  if(j.requests.some(x=>x.id===id))throw Error('Request ID already used; never silently retry a paid request');
  if(j.requests.some(x=>['IN_FLIGHT','RECEIVED','UNCERTAIN'].includes(x.state)))throw Error('Unsettled/uncertain request exists: recover/settle before new paid calls');
  const t=totals(j);if(micro(t.available)<max)throw Error('Approved budget ceiling reached; refuse reservation');
  j.requests.push({id,model,state:'IN_FLIGHT',reservedMicro:max,actualMicro:null,createdAt:new Date().toISOString(),rawSha256:null});j.events.push({type:'RESERVED',id,at:new Date().toISOString()});await write(j);
  output({status:'RESERVED',id,model,reservedUsd:money(max),totals:totals(j)});
 });
 else if(action==='record-response')await tx(async()=>{
  const j=await read(),id=requireArg('request-id'),ref=requireArg('response-file'),r=j.requests.find(x=>x.id===id);
  if(!r)throw Error('Unknown request');if(!['IN_FLIGHT','RECEIVED'].includes(r.state))throw Error('Request cannot accept response in '+r.state);
  const data=await fs.readFile(ref);if(!data.length)throw Error('Empty raw API response');
  const rawFile=path.join(dir,'raw',encodeURIComponent(id)+'.json');const sum=hash(data);
  try{const existing=await fs.readFile(rawFile);if(hash(existing)!==sum)throw Error('Conflicting raw response for same request ID')}catch(e){if(e.code==='ENOENT')await atomic(rawFile,data);else throw e}
  // Raw response is durable BEFORE updating the ledger or parsing model output.
  r.state='RECEIVED';r.rawSha256=sum;r.rawPath=path.relative(dir,rawFile);r.receivedAt=new Date().toISOString();j.events.push({type:'RAW_DURABLE',id,sha256:sum});await write(j);
  output({status:'RAW_DURABLE',id,sha256:sum,requiresSettlement:true});
 });
 else if(action==='settle')await tx(async()=>{
  const j=await read(),id=requireArg('request-id'),cost=micro(requireArg('actual-usd')),r=j.requests.find(x=>x.id===id);
  if(!r||r.state!=='RECEIVED'||!r.rawSha256)throw Error('Raw response must be durably stored before settlement');
  const raw=await fs.readFile(path.join(dir,r.rawPath));if(hash(raw)!==r.rawSha256)throw Error('Raw response hash mismatch');
  // Reject arbitrary unverified charging estimates; require explicit usage evidence file (may be redacted).
  const usagePath=requireArg('usage-file'),usage=await fs.readFile(usagePath);if(!usage.length)throw Error('Missing usage evidence');
  const others=j.requests.filter(x=>x.id!==id&&x.state==='SETTLED').reduce((sum,x)=>sum+x.actualMicro,0);
  if(others+cost>j.capMicro)throw Error('Actual cost exceeds approved budget; manual review required');
  r.state='SETTLED';r.actualMicro=cost;r.usageSha256=hash(usage);r.settledAt=new Date().toISOString();r.costExceededReservation=cost>r.reservedMicro;
  j.events.push({type:'SETTLED',id,actualUsd:money(cost),exceededReservation:r.costExceededReservation});await write(j);output({status:'SETTLED',id,estimatedChargeUsd:money(cost),totals:totals(j),warning:r.costExceededReservation?'Estimate was above reserved maximum; investigate':'Billing remains an estimate unless provider invoice confirms'});
 });
 else if(action==='uncertain')await tx(async()=>{
  const j=await read(),id=requireArg('request-id'),r=j.requests.find(x=>x.id===id);
  if(!r||!['IN_FLIGHT','RECEIVED'].includes(r.state))throw Error('Uncertain is only for in-flight/received requests');
  r.state='UNCERTAIN';r.reason=requireArg('reason');j.events.push({type:'UNCERTAIN',id,reason:r.reason});await write(j);
  output({status:'UNCERTAIN',id,totals:totals(j),warning:'New requests are blocked; do not replay blindly or delete the uncertain charge.'});
 });
 else if(action==='recover')await tx(async()=>{
  const j=await read(),all=[];
  for(const r of j.requests){let durable=false;
   try{const raw=await fs.readFile(path.join(dir,'raw',encodeURIComponent(r.id)+'.json'));durable=Boolean(raw.length);if(durable){const sum=hash(raw);if(r.rawSha256&&sum!==r.rawSha256)throw Error('Raw sha mismatch '+r.id);if(r.state==='IN_FLIGHT'){r.state='RECEIVED';r.rawSha256=sum;r.rawPath='raw/'+encodeURIComponent(r.id)+'.json';j.events.push({type:'RECOVERED_RAW',id:r.id})}}}catch(e){if(e.code!=='ENOENT')throw e}
   all.push({id:r.id,state:r.state,hasRaw:durable});
  }
  await write(j);output({status:'RECOVERY_INSPECTION',requests:all,totals:totals(j),warning:'Never automatically resend a potentially charged request.'});
 });
 else if(action==='status'){const j=await read();output({status:j.requests.some(x=>x.state!=='SETTLED')?'OPEN':'SETTLED',totals:totals(j),requests:j.requests.map(({id,model,state,rawSha256,costExceededReservation})=>({id,model,state,rawSha256,costExceededReservation}))});}
 else throw Error('Usage: budget-journal.mjs init|reserve|record-response|settle|uncertain|recover|status --dir DIR [options]');
}catch(err){console.error('BUDGET_JOURNAL_ERROR '+err.message);process.exitCode=1}
