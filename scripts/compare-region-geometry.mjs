#!/usr/bin/env node
/** Check declared Figma regions vs actual app DOM geometry. Does not discover unseen Figma layers. */
import fs from 'node:fs/promises';import path from 'node:path';
const argv=process.argv.slice(2),arg=k=>{let i=argv.indexOf(k);return i<0?null:argv[i+1]};
const p=arg('--map'),a=arg('--actual'),out=arg('--out');if(!p||!a||!out)throw Error('Usage: --map FILE --actual FILE --out FILE');
const [m,actual]=await Promise.all([p,a].map(x=>fs.readFile(x,'utf8').then(JSON.parse)));
const base=path.dirname(path.resolve(p)),checks=[],boxes=new Map(),ids=new Set();
const report=(kind,id,status,info={})=>checks.push({kind,id,status,...info});
const exists=async f=>{if(typeof f!=='string'||!f)return false;const full=path.resolve(base,f);if(!full.startsWith(base+path.sep))return false;try{return (await fs.stat(full)).size>0}catch{return false}};
const exact=s=>['FIGMA_UI_OBSERVED','FIGMA_UI_MEASURED'].includes(s);
const union=parts=>{const left=Math.min(...parts.map(b=>b.left)),right=Math.max(...parts.map(b=>b.right)),top=Math.min(...parts.map(b=>b.top)),bottom=Math.max(...parts.map(b=>b.bottom));return {x:left,y:top,left,right,top,bottom,width:right-left,height:bottom-top,centerX:(left+right)/2,centerY:(top+bottom)/2}};
if(m.schemaVersion!==1||!m.regions?.length)report('schema','regions','FAIL',{reason:'No mappings'});
if(!m.relations?.length)report('schema','relations','FAIL',{reason:'No rendered edge relations'});
if(!actual.elements?.length||actual.truncated)report('schema','DOM','FAIL',{reason:'Missing/truncated DOM snapshot'});
const vp=m.scope?.viewport,localvp=actual.viewport;
report('environment','viewport',vp&&localvp&&['width','height','deviceScaleFactor'].every(k=>vp[k]===localvp[k])?'PASS':'FAIL',{expected:vp,actual:localvp});
try{const x=new URL(m.scope.route),y=new URL(actual.pageUrl);report('environment','route',x.pathname+x.search===y.pathname+y.search?'PASS':'FAIL')}catch{report('environment','route','FAIL')};
for(const r of m.regions||[]){
 const id=r.id||'(unknown)';if(ids.has(id))report('mapping',id,'FAIL',{reason:'Duplicate id'});ids.add(id);
 if(!r.figmaPath||!r.domSelectors?.length){report('mapping',id,'FAIL',{reason:'figmaPath/domSelectors missing'});continue}
 if(!await exists(r.figmaEvidence))report('evidence',id,'FAIL',{reason:'Missing direct Figma evidence'});
 const parts=[];for(const s of r.domSelectors){const found=actual.elements.filter(x=>x.selector===s);if(found.length!==1||!found[0].box)report('mapping',id,'FAIL',{reason:'Missing/ambiguous '+s});else parts.push(found[0].box)}
 if(parts.length!==r.domSelectors.length)continue;
 const b=union(parts);boxes.set(id,b);report('mapping',id,'PASS',{domSelectors:r.domSelectors});
 if(!Object.keys(r.expectedBox||{}).length)report('box',id,'SKIPPED',{reason:'No expectedBox'});
 else if(!exact(r.source))report('box',id,'SKIPPED',{reason:'Not directly observed'});
 else for(const [key,v] of Object.entries(r.expectedBox)){const got=b[key],delta=got-v,tol=r.tolerancePx??1;report('box',id+'.'+key,Number.isFinite(delta)&&Math.abs(delta)<=tol?'PASS':'FAIL',{expected:v,actual:got,delta,tolerance:tol})}
}
for(const rel of m.relations||[]){
 const from=boxes.get(rel.from),to=boxes.get(rel.to),id=rel.id||rel.from+'→'+rel.to;
 if(!from||!to){report('relation',id,'FAIL',{reason:'Unmapped endpoint'});continue}
 if(!exact(rel.source)||!await exists(rel.figmaEvidence)){report('relation',id,'FAIL',{reason:'Missing Figma measured evidence'});continue}
 if(!Number.isFinite(rel.expectedPx)||!from[rel.fromEdge]&&from[rel.fromEdge]!==0||!to[rel.toEdge]&&to[rel.toEdge]!==0){report('relation',id,'FAIL',{reason:'Invalid expected/edge'});continue}
 const got=to[rel.toEdge]-from[rel.fromEdge],delta=got-rel.expectedPx,tol=rel.tolerancePx??1;
 report('relation',id,Math.abs(delta)<=tol?'PASS':'FAIL',{actual:got,expected:rel.expectedPx,delta,tolerance:tol});
}
for(const x of m.containment||[]){const par=boxes.get(x.parent),child=boxes.get(x.child);if(!par||!child){report('containment',x.parent+'>'+x.child,'FAIL',{reason:'Unmapped region'});continue}const tol=x.tolerancePx??1,ok=child.left>=par.left-tol&&child.right<=par.right+tol&&child.top>=par.top-tol&&child.bottom<=par.bottom+tol;report('containment',x.parent+'>'+x.child,ok?'PASS':'FAIL',{parent:par,child})}
const counts={PASS:checks.filter(x=>x.status==='PASS').length,FAIL:checks.filter(x=>x.status==='FAIL').length,SKIPPED:checks.filter(x=>x.status==='SKIPPED').length};
const result={schemaVersion:1,status:counts.FAIL||counts.SKIPPED?'PARTIAL':'VERIFIED_RECORDED_RELATIONS',counts,checks,warning:'Only inventoried regions and declared relations were checked'};
await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify(result,null,2)+'\n');
console.log(result.status,counts);if(counts.FAIL||counts.SKIPPED)process.exitCode=1;
