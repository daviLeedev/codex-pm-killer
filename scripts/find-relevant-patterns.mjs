#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);const arg=(k,d='')=>{const i=args.indexOf(k);return i>=0?args[i+1]??d:d;};
const query=arg('--query');if(!query){console.error('Usage: node find-relevant-patterns.mjs --query "screen and symptoms" [--top 6] [--category layout]');process.exit(2);}
const category=arg('--category');const top=Math.max(1,Math.min(100,Number(arg('--top','8'))||8));
const doc=JSON.parse(fs.readFileSync(path.join(root,'knowledge/patterns.json'),'utf8'));
const tokens=[...new Set(query.toLowerCase().split(/[\s,.;:!?()[\]{}]+/u).filter(w=>w.length>=2))];
const results=doc.patterns.filter(p=>p.status!=='DEPRECATED'&&(!category||p.category===category)).map(p=>{
  const tags=(p.triggers||[]).map(t=>t.toLowerCase());let score=0;const matched=[];
  for(const tok of tokens){const hit=tags.find(t=>t===tok||t.includes(tok)||tok.includes(t));if(hit){score+=hit===tok?4:2;matched.push(tok);}}
  const body=[p.title,p.failureMode,...p.checks].join(' ').toLowerCase();for(const tok of tokens){if(!matched.includes(tok)&&body.includes(tok)){score+=1;matched.push(tok);}}
  return {id:p.id,title:p.title,category:p.category,status:p.status,score,matched,checks:p.checks,requiredEvidence:p.requiredEvidence};
}).filter(p=>p.score>0).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).slice(0,top);
console.log(JSON.stringify({query,matchedCount:results.length,results},null,2));
