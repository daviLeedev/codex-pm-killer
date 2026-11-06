#!/usr/bin/env node
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const errors=[];const get=(p)=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const doc=get('knowledge/patterns.json'),fileNames=fs.readdirSync(path.join(root,'knowledge/cases')).filter(f=>f.endsWith('.json'));
const cases=new Map();for(const f of fileNames){try{const c=get('knowledge/cases/'+f);if(c.id+'.json'!==f)errors.push('case filename/id mismatch '+f);if(cases.has(c.id))errors.push('duplicate case '+c.id);if(c.redacted!==true)errors.push('not redacted '+f);if(c.reviewed!==true)errors.push('not reviewed '+f);if(!['REPORTED_ONLY','SOURCE_REVIEW','REAL_APP_AND_FIGMA','REAL_APP_REPRODUCED'].includes(c.evidenceGrade))errors.push('bad evidence grade '+f);if(!c.title||!c.rootCause||!c.resolution)errors.push('incomplete case '+f);cases.set(c.id,c);}catch(e){errors.push('invalid case '+f+': '+e.message);}}
const seen=new Set();for(const p of doc.patterns||[]){if(seen.has(p.id))errors.push('duplicate pattern '+p.id);seen.add(p.id);
 if(!/^QA-\d{4}$/.test(p.id))errors.push('invalid pattern id '+p.id);
 if(!['HEURISTIC','VERIFIED','DEPRECATED'].includes(p.status))errors.push('invalid status '+p.id);
 if(!p.title||!p.failureMode||!p.requiredEvidence||!(p.triggers?.length)||!(p.checks?.length))errors.push('incomplete pattern '+p.id);
 if(p.projectSpecificDesignValuesAllowed!==false)errors.push('new-project numeric copy risk '+p.id);
 for(const id of p.supportingCaseIds||[]){if(!cases.has(id))errors.push(`missing case ${id} for ${p.id}`);}
 if(p.status==='VERIFIED'&&!(p.supportingCaseIds||[]).some(id=>['REAL_APP_AND_FIGMA','REAL_APP_REPRODUCED'].includes(cases.get(id)?.evidenceGrade)))errors.push('VERIFIED without adequate reproduced supporting case '+p.id);
}
for(const c of cases.values())for(const id of c.patternIds||[])if(!seen.has(id))errors.push('case '+c.id+' references missing pattern '+id);
console.log(JSON.stringify({status:errors.length?'FAIL':'PASS',patterns:seen.size,cases:cases.size,errors},null,2));if(errors.length)process.exit(1);
