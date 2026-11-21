import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';

export const sha256=b=>createHash('sha256').update(b).digest('hex');
export const isSha=s=>typeof s==='string'&&/^[a-f0-9]{64}$/i.test(s);
export const required=(condition,message)=>{if(!condition)throw Error(message)};
export const cliArg=(key,defaultValue=null)=>{
 const args=process.argv.slice(2),flag=key.startsWith('--')?key:'--'+key,i=args.indexOf(flag);
 return i<0?defaultValue:args[i+1];
};
export async function load(file){return JSON.parse(await fs.readFile(file,'utf8'))}
export async function fileHash(file){return sha256(await fs.readFile(file))}
export function safePath(root,relative){
 required(typeof relative==='string'&&relative&&!path.isAbsolute(relative),'UNSAFE_EVIDENCE_PATH');
 const r=path.resolve(root),p=path.resolve(r,relative);
 required(p.startsWith(r+path.sep),'EVIDENCE_OUTSIDE_ROOT');
 return p;
}
export async function verifiedFile(root,relative,expected){
 const full=safePath(root,relative),real=await fs.realpath(full),r=await fs.realpath(root);
 required(real.startsWith(r+path.sep),'EVIDENCE_SYMLINK_OUTSIDE_ROOT');
 const h=await fileHash(real);
 if(expected)required(h===expected,'EVIDENCE_HASH_CHANGED: '+relative);
 return {path:relative,sha256:h,bytes:(await fs.stat(real)).size};
}
export async function atomicWrite(file,obj){
 const abs=path.resolve(file);await fs.mkdir(path.dirname(abs),{recursive:true});
 const tmp=abs+'.'+randomUUID()+'.tmp';
 const fd=await fs.open(tmp,'wx',0o600);
 try{await fd.writeFile(JSON.stringify(obj,null,2)+'\n');await fd.sync()}finally{await fd.close()}
 await fs.rename(tmp,abs);
}
export async function withLock(dir,fn){
 await fs.mkdir(dir,{recursive:true});
 const lock=path.join(dir,'.fidelity-lock');
 await fs.mkdir(lock).catch(e=>{if(e.code==='EEXIST')throw Error('RUN_LOCKED_DO_NOT_TAKE_OVER');throw e});
 try{return await fn()}finally{await fs.rmdir(lock)}
}
export function compareScope(a,b){
 return JSON.stringify(a?.viewport)===JSON.stringify(b?.viewport) &&
        (!a?.route||!b?.route||a.route===b.route);
}
export const statusOfIssue=x=>['DETECTED','EVIDENCED','ROOT_CAUSE','PATCHED','VERIFIED','REVERTED','UNRESOLVED'].includes(x?.status);
export function assertHex(x,name){required(isSha(x),name+'_SHA256_MISSING')}
export function isBlocking(i){return ['P0','P1'].includes(i.severity)&&!['VERIFIED','CLOSED'].includes(i.status)}
