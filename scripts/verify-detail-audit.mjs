#!/usr/bin/env node
/** Fail-closed completeness gate for a scoped Figma-to-DOM audit. Not proof that a screenshot is authentic. */
import fs from 'node:fs/promises';import path from 'node:path';
const args=process.argv.slice(2),i=args.indexOf('--audit');if(i<0||!args[i+1])throw Error('Usage: --audit detail-audit.json');
const file=path.resolve(args[i+1]),base=path.dirname(file),audit=JSON.parse(await fs.readFile(file,'utf8')),errors=[];
const find=async p=>{if(typeof p!=='string'||!p)return false;const full=path.resolve(base,p);if(!full.startsWith(base+path.sep))return false;try{return (await fs.stat(full)).size>0}catch{return false}};
const read=async p=>JSON.parse(await fs.readFile(path.resolve(base,p),'utf8'));
if(audit.schemaVersion!==1)errors.push('Invalid schema version');
if(!audit.scope?.figmaFrame||!audit.scope?.appRoute||!audit.scope?.viewport)errors.push('Missing frame, route or viewport');
const mandatory=['figmaBaseline','localBefore','localAfter','visualComparison','layoutReport','figmaLayerInventory','localDomInventory','regionMap','regionReport','reproMatrix','reproGateReport'];
for(const key of mandatory)if(!await find(audit.artifacts?.[key]))errors.push('Missing artifact: '+key);
let regionMap=null,regionReport=null,layoutReport=null,reproReport=null;
try{if(await find(audit.artifacts?.regionMap))regionMap=await read(audit.artifacts.regionMap)}catch{errors.push('Invalid region map')}
try{if(await find(audit.artifacts?.regionReport))regionReport=await read(audit.artifacts.regionReport)}catch{errors.push('Invalid region report')}
try{if(await find(audit.artifacts?.layoutReport))layoutReport=await read(audit.artifacts.layoutReport)}catch{errors.push('Invalid layout report')}
try{if(await find(audit.artifacts?.reproGateReport))reproReport=await read(audit.artifacts.reproGateReport)}catch{errors.push('Invalid reproduction report')}
const mapped=new Set((regionMap?.regions||[]).map(x=>x.id)),checked=new Set((audit.regions||[]).map(x=>x.id));
if(!mapped.size)errors.push('No mapped regions');
if(mapped.size!==checked.size||[...mapped].some(x=>!checked.has(x)))errors.push('Region inventory does not match audited region IDs');
if(!audit.regions?.length)errors.push('No audited regions');
for(const r of audit.regions||[]){
 if(!r.id||!mapped.has(r.id))errors.push('Unmapped audited region: '+r.id);
 if(r.firstPass!=='INSPECTED'||r.secondPass!=='PASS')errors.push('Missing second-pass inspection: '+r.id);
 if(!await find(r.figmaEvidence)||!await find(r.localEvidence))errors.push('Missing Figma/app evidence: '+r.id);
 if(r.appEvidenceGrade!=='APP_RUNTIME_MEASURED')errors.push('Missing real app measurement: '+r.id);
 if(!r.propertyChecks?.length)errors.push('Missing properties: '+r.id);
 for(const c of r.propertyChecks||[])if(!['OBSERVED','MEASURED'].includes(c.source)||c.status!=='PASS'||c.appEvidenceGrade!=='APP_RUNTIME_MEASURED'||!Number.isFinite(c.delta)||Math.abs(c.delta)>parseFloat(c.tolerance))errors.push('Unverified property '+r.id+'.'+c.name);
}
if(regionReport&&(regionReport.counts?.FAIL||regionReport.counts?.SKIPPED||!['VERIFIED_RECORDED_RELATIONS','PASS'].includes(regionReport.status)))errors.push('Region report not verified');
if(layoutReport&&(layoutReport.counts?.FAIL||layoutReport.counts?.SKIPPED))errors.push('Layout report failures/skips');
if(reproReport&&reproReport.status!=='VERIFIED_RECORDED_CASES')errors.push('Reproduction matrix not verified');
const reg=audit.regression||{};
for(const k of ['finalVisualSweep','functionalSmoke','typecheckOrBuild','impactReview','independentSourceRecheck'])if(reg[k]!=='PASS')errors.push('Regression incomplete: '+k);
for(const k of ['impactEvidence','figmaRevisitedEvidence'])if(!await find(reg[k]))errors.push('Regression evidence missing: '+k);
for(const issue of audit.issues||[])if(!['RESOLVED','CLOSED'].includes(issue.status))errors.push('Unresolved issue '+(issue.id||'unknown'));
const result={status:errors.length?'PARTIAL':'VERIFIED_RECORDED_SCOPE',errors,warning:'Structured evidence consistency is not independent proof of actual Figma completeness'};
await fs.writeFile(path.join(base,'audit-gate-report.json'),JSON.stringify(result,null,2)+'\n');console.log(result.status,errors);if(errors.length)process.exitCode=1;
