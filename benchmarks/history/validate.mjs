#!/usr/bin/env node
import fs from 'node:fs';
const file=process.argv[2];if(!file)throw Error('Usage: validate.mjs PUBLIC_SUMMARY.json');
const x=JSON.parse(fs.readFileSync(file,'utf8'));
const check=(ok,msg)=>{if(!ok)throw Error('Unsafe/invalid benchmark history: '+msg)};
check(x.schemaVersion===1,'schema');
check(typeof x.runId==='string'&&/^[a-z0-9-]{8,80}$/.test(x.runId),'runId');
check(/^\d{4}-\d{2}-\d{2}$/.test(x.date||''),'date');
check(/^\d+\.\d+\.\d+$/.test(x.skillVersion||''),'version');
check(['EXPLORATORY','PARTIAL','VERIFIED_RECORDED_SCOPE'].includes(x.resultStatus),'status');
check(Number.isInteger(x.assertions)&&x.assertions>0,'assertions');
check(x.results&&typeof x.results==='object','results');
for(const [group,r] of Object.entries(x.results)){
 check(['A','B','C'].includes(group),'invalid group');
 for(const p of ['match','mismatch','notEvaluable'])check(Number.isInteger(r[p])&&r[p]>=0,p);
 check(r.match+r.mismatch+r.notEvaluable===x.assertions,'assertion count mismatch: '+group);
 check(r.estimatedUsd===null||(typeof r.estimatedUsd==='number'&&r.estimatedUsd>=0),'cost');
}
const sensitive=/(?:api[_-]?key|secret|cookie|access[_-]?token|authorization|private[_-]?url|prompt[_-]?body|raw[_-]?response|user[_-]?id|customer[_-]?name|screenshot|file[_-]?path|figma[_-]?url)/i;
function scan(v){
 if(Array.isArray(v))return v.forEach(scan);
 if(v&&typeof v==='object'){for(const [k,x] of Object.entries(v)){check(!sensitive.test(k),'forbidden key: '+k);scan(x)}}
 else if(typeof v==='string')check(!/https?:\/\/|sk-(?:proj-)?[a-z0-9]{12,}|BEGIN (?:PRIVATE|RSA) KEY/i.test(v),'private URL/key string');
}
scan(x);
console.log('PASS sanitized benchmark history '+x.runId);
