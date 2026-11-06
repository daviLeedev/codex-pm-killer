#!/usr/bin/env node
import fs from 'node:fs/promises';import path from 'node:path';
const i=process.argv.indexOf('--matrix');if(i<0||!process.argv[i+1])throw Error('Usage: --matrix repro-matrix.json');
const file=path.resolve(process.argv[i+1]),base=path.dirname(file),data=JSON.parse(await fs.readFile(file,'utf8'));const errors=[],notes=[];
const exists=async p=>{if(typeof p!=='string'||!p.trim())return false;const full=path.resolve(base,p);if(!full.startsWith(base+path.sep))return false;try{let s=await fs.stat(full);return s.isFile()&&s.size>0}catch{return false}};
if(data.schemaVersion!==1||!Array.isArray(data.cases)||!data.cases.length)errors.push('No real-app cases');
for(const c of data.cases||[]){
 const id=c.id||'(unnamed)';
 if(!c.id||!c.steps)errors.push(id+': missing id/steps');
 if(c.environment!=='REAL_APP')errors.push(id+': source-only evidence is not real-app evidence');
 if(c.after!=='PASS'||!await exists(c.afterEvidence))errors.push(id+': missing real-app after evidence');
 if(c.reportedDefect===true){if(c.before!=='REPRODUCED'||!await exists(c.beforeEvidence))errors.push(id+': original symptom not reproduced/evidenced')}
 else if(!['REPRODUCED','NOT_REPRODUCED','NOT_APPLICABLE'].includes(c.before))errors.push(id+': invalid baseline');
 if(c.category==='NAVIGATION'&&!c.eventTimeline)errors.push(id+': missing event timeline');
 if(c.category==='RESPONSIVE'&&(!Array.isArray(c.widthsPx)||c.widthsPx.length<3))errors.push(id+': missing width-boundary matrix');
 notes.push({id,category:c.category,before:c.before,after:c.after,environment:c.environment});
}
const report={status:errors.length?'PARTIAL':'VERIFIED_RECORDED_CASES',errors,cases:notes,warning:'Metadata and evidence file presence only, not independent proof.'};
await fs.writeFile(path.join(base,'repro-gate-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(report.status,errors);if(errors.length)process.exitCode=1;
