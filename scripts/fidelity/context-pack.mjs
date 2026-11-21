#!/usr/bin/env node
/** Small evidence-bound fix task pack; model never needs full Figma dump / entire SKILL.md. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {cliArg,load,fileHash,atomicWrite,required} from './core.mjs';
const issuesPath=cliArg('issues'),plansPath=cliArg('plans'),projectRoot=cliArg('project-root'),out=cliArg('out');
const maxIssues=Number(cliArg('max-issues','3')),maxBytes=Number(cliArg('max-bytes','8000'));
if(!issuesPath||!plansPath||!projectRoot||!out)throw Error('Usage: context-pack.mjs --issues ISSUES.json --plans FIX_PLAN.json --project-root VUE_APP --out PRIVATE/context-pack.json [--max-issues 3 --max-bytes 8000]');
required(Number.isInteger(maxIssues)&&maxIssues>=1&&maxIssues<=5&&Number.isInteger(maxBytes)&&maxBytes>=1800&&maxBytes<=32000,
 'CONTEXT_PACK_LIMIT_INVALID');
const [diff,plans]=await Promise.all([load(issuesPath),load(plansPath)]);
required(diff.status==='ISSUES_RECORDED'&&plans.status==='FIX_PLANS_READY'&&
 plans.inputIssuesSha256===await fileHash(issuesPath),'FIX_PLAN_OR_INPUT_ISSUE_HASH_INVALID');
const root=await fs.realpath(projectRoot),issueMap=new Map(diff.issues.map(x=>[x.issueId,x]));
const tasks=[];
for(const plan of plans.plans.slice(0,maxIssues)){
 const issue=issueMap.get(plan.issueId);required(issue,'FIX_PLAN_UNKNOWN_ISSUE');
 const snippets=[];
 const sourceCandidates=[...new Set((plan.cssCandidates??[]).map(x=>x.sourceFile).filter(Boolean))].slice(0,2);
 for(const relative of sourceCandidates){
  if(typeof relative!=='string'||!/^src\/[\w./-]+\.(?:vue|css|scss)$/.test(relative)||relative.split('/').includes('..'))continue;
  try{
   const file=await fs.realpath(path.resolve(root,relative));
   if(!file.startsWith(root+path.sep))continue;
   const all=(await fs.readFile(file,'utf8')).split('\n');
   const needle=String(plan.property??'').replace(/([A-Z])/g,'-$1').toLowerCase();
   let index=all.findIndex(line=>line.includes(needle+':'));
   if(index<0)index=all.findIndex(line=>line.includes(needle));
   if(index<0)continue;
   const lower=Math.max(0,index-5),upper=Math.min(all.length,index+6);
   const excerpt=all.slice(lower,upper).join('\n');
   snippets.push({relativeFile:relative,startLine:lower+1,excerpt:excerpt.slice(0,1800),
    proof:'READ_ONLY_CURRENT_WORKSPACE_SOURCE_CANDIDATE'});
  }catch{}
 }
 tasks.push({issueId:issue.issueId,severity:issue.severity,category:issue.category,
  figmaLayer:issue.figmaLayer,domSelector:issue.domSelector,
  expected:issue.comparison?.expected,actual:issue.comparison?.actual,
  delta:issue.comparison?.delta,tolerance:issue.comparison?.tolerance,
  figmaEvidenceSha256:issue.evidence?.figmaSha256,runtimeEvidenceSha256:issue.evidence?.runtimeSha256,
  hypothesis:plan.hypothesis,fixPolicy:plan.fixPolicy,
  cssCandidateSummary:(plan.cssCandidates??[]).slice(0,4).map(x=>({selector:x.selector,sourceFile:x.sourceFile,sourceGrade:x.sourceGrade})),
  sourceSnippets:snippets});
}
const pack={schemaVersion:1,status:'SCOPED_FIX_CONTEXT',inputIssuesSha256:await fileHash(issuesPath),
 inputPlansSha256:await fileHash(plansPath),selectedIssueCount:tasks.length,
 tasks,contract:['Work only on the selected evidence-backed UI issues','Modify one scoped CSS property per patch',
 'Re-capture the actual app; compare target + parent/siblings + whole page','Use the independent verifier and roll back failed patches',
 'Do not read hidden benchmark Gold, prior A/B/C outputs or unrelated client secrets'],
 limitation:'Byte budget is not model token budget; source-map candidates are unverified until traced.'};
const bytes=()=>Buffer.byteLength(JSON.stringify(pack));
while(bytes()>maxBytes){
 const snippets=tasks.flatMap(t=>t.sourceSnippets.map(s=>({t,s}))).sort((a,b)=>b.s.excerpt.length-a.s.excerpt.length);
 if(!snippets.length){throw Error('CONTEXT_PACK_REQUIRED_EVIDENCE_EXCEEDS_LIMIT');}
 if(snippets[0].s.excerpt.length>350)snippets[0].s.excerpt=snippets[0].s.excerpt.slice(0,Math.floor(snippets[0].s.excerpt.length/2));
 else snippets[0].t.sourceSnippets.splice(snippets[0].t.sourceSnippets.indexOf(snippets[0].s),1);
}
await atomicWrite(out,pack);
console.log(JSON.stringify({status:pack.status,issues:tasks.length,bytes:bytes(),maxBytes}));
