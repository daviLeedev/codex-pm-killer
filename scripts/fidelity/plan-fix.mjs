#!/usr/bin/env node
/** Turns evidence-backed issues and CDP matched rules into small, ranked FIX TASKS. No code edit. */
import {cliArg,load,fileHash,atomicWrite,required} from './core.mjs';
const issues=cliArg('issues'),trace=cliArg('trace'),out=cliArg('out'),max=Number(cliArg('max','3'));
if(!issues||!trace||!out)throw Error('Usage: plan-fix.mjs --issues DETECTED.json --trace CSS_RULES.json --out FIX_PLAN.json [--max 3]');
required(Number.isInteger(max)&&max>=1&&max<=10,'INVALID_TASK_COUNT');
const [d,t]=await Promise.all([load(issues),load(trace)]);
required(d.status==='ISSUES_RECORDED'&&Array.isArray(d.issues),'DETECTION_REPORT_REQUIRED');
required(t.inputIssuesSha256===await fileHash(issues),'CSS_TRACE_INPUT_MISMATCH');
const traced=new Map((t.issues??[]).map(x=>[x.issueId,x])),used=new Set(),plans=[];
const priority={P0:0,P1:1,P2:2};
const sorted=d.issues.filter(x=>['P0','P1'].includes(x.severity)&&x.status!=='VERIFIED').sort((a,b)=>{
 const pa=(priority[a.severity]??3)-(priority[b.severity]??3);
 if(pa!==0)return pa;
 return (b.impactRegionIds?.length??0)-(a.impactRegionIds?.length??0);
});
for(const issue of sorted){
 if(plans.length>=max)break;
 if(used.has(issue.issueId))continue;
 const related=t.issues?.find(x=>x.issueId===issue.issueId);
 const property=issue.comparison?.property||'UNKNOWN';
 const rules=(related?.rules??[]).filter(r=>(r.cssProperties??[]).some(p=>p.name===property||p.name==='margin'||p.name==='padding'||p.name==='gap'||p.name==='width'||p.name==='height'||p.name==='font-size'||p.name==='color'));
 const candidates=rules.map(r=>({selector:r.selector,properties:r.cssProperties.filter(x=>x.name===property||x.name.includes('margin')||x.name.includes('padding')||x.name.includes('gap')),
  sourceFile:r.source?.localFile??null,sourceGrade:r.source?.grade??'SOURCE_UNVERIFIED',styleSheetUrl:r.source?.styleSheetUrl??null})).slice(0,8);
 const parent=d.rootCauseCandidates?.find(x=>x.affectedRegionIds?.includes(issue.regionId));
 const hypothesis=parent?{cause:'SHARED_PARENT_OFFSET',parentId:parent.parentId,axis:parent.axis,commonDelta:parent.commonDelta,
  confidence:'MEASURED_CORRELATION_NOT_CSS_PROOF'}:{cause:'LOCAL_STYLE_OR_COMPONENT',confidence:candidates.length?'CDP_RULE_CANDIDATES':'UNVERIFIED'};
 const plan={issueId:issue.issueId,severity:issue.severity,category:issue.category,
  observedDelta:issue.comparison?.delta??null,property,domSelector:issue.domSelector,
  hypothesis,cssCandidates:candidates,fixPolicy:{
   maxFiles:1,maxProperties:1,keepArchitecture:true,requireActualBeforeCapture:true,
   verifyRegions:[...new Set([issue.regionId,...(issue.impactRegionIds??[]),...(parent?.affectedRegionIds??[])])],
   requireFullPageRegression:true,rollbackOnNewP0OrP1:true},
  acceptance:'Only fresh browser measured target improvement without new P0/P1 regressions counts as success'};
 plans.push(plan);used.add(issue.issueId);
}
const report={schemaVersion:1,status:plans.length?'FIX_PLANS_READY':'NO_BLOCKING_ISSUES',inputIssuesSha256:await fileHash(issues),
 inputTraceSha256:await fileHash(trace),plans,unplannedBlocking:sorted.length-plans.length,
 warning:'Plans are hypotheses; the actual source rule must be checked against live app before applying. No automatic code changes.'};
await atomicWrite(out,report);
console.log(JSON.stringify({status:report.status,planned:plans.length,remaining:report.unplannedBlocking}));
