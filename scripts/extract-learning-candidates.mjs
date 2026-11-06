#!/usr/bin/env node
import fs from 'node:fs';import path from 'node:path';
const args=process.argv.slice(2),arg=(k,d='')=>{const i=args.indexOf(k);return i>=0?args[i+1]??d:d;};
const file=arg('--audit');if(!file){console.error('Usage: node extract-learning-candidates.mjs --audit <detail-audit.json> [--out <project-local-file>]');process.exit(2);}
const audit=JSON.parse(fs.readFileSync(file,'utf8'));
const out=arg('--out',path.join(path.dirname(file),'learning-candidates.json'));
const issues=Array.isArray(audit.issues)?audit.issues:[];
const candidates=issues.map((issue,i)=>({
  candidateId:`LEARN-${String(i+1).padStart(3,'0')}`,
  reviewStatus:'REVIEW_REQUIRED',evidenceGrade:'UNASSESSED',
  title:String(issue.title??issue.name??issue.id??`Issue ${i+1}`),
  symptoms:String(issue.symptom??issue.description??''),
  suspectedRootCause:String(issue.rootCause??issue.cause??''),
  resolution:String(issue.fix??issue.resolution??''),
  missedAssertion:String(issue.missedAssertion??issue.blindSpot??''),
  evidenceNote:'Derived from agent-authored audit only. Manually verify sources; strip all project-sensitive text before sharing.',
}));
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify({schemaVersion:1,scope:'PROJECT_PRIVATE',sourceAudit:path.basename(file),candidates},null,2)+'\n');
console.log(JSON.stringify({output:out,candidates:candidates.length,promoted:0,warning:'Not verified; requires privacy review and a manually prepared redacted case before shared ingestion.'}));
