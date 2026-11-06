#!/usr/bin/env node
import fs from 'node:fs/promises';import path from 'node:path';
const args=process.argv.slice(2), get=k=>{let i=args.indexOf(k);return i<0?null:args[i+1]};
const specPath=get('--spec'),actualPath=get('--actual'),out=get('--out');if(!specPath||!actualPath||!out)throw new Error('Usage: --spec FILE --actual FILE --out FILE');
const [spec,actual]=await Promise.all([specPath,actualPath].map(p=>fs.readFile(p,'utf8').then(JSON.parse)));
if(!Array.isArray(spec.checks)||!Array.isArray(actual.elements))throw new Error('Invalid checks/elements');
const pix=x=>typeof x==='number'?x:typeof x==='string'&&/^-?\d+(?:\.\d+)?px$/.test(x.trim())?parseFloat(x):null;
const color=x=>{x=String(x).trim().toLowerCase();if(/^#[a-f0-9]{3}$/.test(x))return 'rgb('+[x[1],x[2],x[3]].map(c=>parseInt(c+c,16)).join(', ')+')';if(/^#[a-f0-9]{6}$/.test(x))return 'rgb('+[1,3,5].map(i=>parseInt(x.slice(i,i+2),16)).join(', ')+')';return x.replace(/\s+/g,' ')};
let report={schemaVersion:1,checks:[],counts:{PASS:0,FAIL:0,SKIPPED:0}};
for(const check of spec.checks){
 let status='PASS',assertions=[],reason='';
 if(!check.name||!check.selector){status='SKIPPED';reason='Missing name/selector'}
 else if(!['OBSERVED','MEASURED'].includes(String(check.source||'').toUpperCase())){status='SKIPPED';reason='Figma source not observed/measured'}
 else {let e=actual.elements.find(e=>e.selector===check.selector);if(!e){status='FAIL';reason='DOM selector not captured'}
 else for(const [group,expected] of Object.entries(check.expected||{}))if(['box','css'].includes(group)&&expected&&typeof expected==='object'){
  for(const [prop,val] of Object.entries(expected)){let actualVal=e[group]?.[prop],a=pix(actualVal),b=pix(val),delta=a!==null&&b!==null?+(a-b).toFixed(2):null;let ok=actualVal!==undefined&&(delta!==null?Math.abs(delta)<=(check.tolerancePx??2):color(actualVal)===color(val));assertions.push({field:group+'.'+prop,expected:val,actual:actualVal??null,delta,result:ok?'PASS':'FAIL'});if(!ok)status='FAIL'}
 }if(!assertions.length&&status==='PASS'){status='SKIPPED';reason='No expected properties'}}
 report.counts[status]++;report.checks.push({name:check.name,selector:check.selector,status,reason,assertions});
}
await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify(report,null,2)+'\n');
console.log(report.counts);if(report.counts.FAIL)process.exitCode=1;
