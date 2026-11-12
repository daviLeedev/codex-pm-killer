#!/usr/bin/env node
/** Verify HOST budget configuration against user-approved $5 aggregate cap; no API calls. */
import fs from 'node:fs/promises';
import path from 'node:path';
const arg=k=>{const i=process.argv.indexOf('--'+k);return i<0?null:process.argv[i+1]};
const approval=arg('approval'),ledger=arg('ledger'),out=arg('out');
if(!approval||!ledger)throw Error('Usage: verify-approved-budget.mjs --approval approved.json --ledger ledger.json [--out report.json]');
const [a,j]=await Promise.all([approval,ledger].map(f=>fs.readFile(f,'utf8').then(JSON.parse)));
const issues=[];
if(a.schemaVersion!==1||a.currency!=='USD'||a.scope!=='ALL_AB_C'||a.approvedMaxUsd!==5)issues.push('USER_APPROVAL_CAP_MISMATCH');
if(j.schemaVersion!==1||!Number.isSafeInteger(j.capMicro)||j.capMicro>5e6||j.capMicro<0||j.capMicro!==Math.round(a.approvedMaxUsd*1e6))issues.push('LEDGER_CAP_MISMATCH');
if(a.approvedBy!=='USER_EXPLICIT'||!a.evidenceId)issues.push('EXPLICIT_APPROVAL_EVIDENCE_MISSING');
const settled=(j.requests||[]).filter(r=>r.state==='SETTLED').reduce((v,r)=>v+(r.actualMicro||0),0);
const reserved=(j.requests||[]).filter(r=>r.state!=='SETTLED'&&r.state!=='VOID').reduce((v,r)=>v+(r.reservedMicro||0),0);
if(settled+reserved>j.capMicro)issues.push('BUDGET_OVERSPENT_OR_OVERRESERVED');
if((j.requests||[]).some(r=>r.state==='UNCERTAIN'||r.costExceededReservation))issues.push('UNCERTAIN_CHARGES');
const result={schemaVersion:1,status:issues.length?'PARTIAL':'RECORDED_BUDGET_POLICY_CONSISTENT',issues,approvedMaxUsd:a.approvedMaxUsd,ledgerCapUsd:j.capMicro/1e6,settledUsd:settled/1e6,reservedUsd:reserved/1e6,warning:'Operator-supplied approval evidence is not independently authenticated, nor is provider billing verified'};
if(out){await fs.mkdir(path.dirname(path.resolve(out)),{recursive:true});await fs.writeFile(out,JSON.stringify(result,null,2)+'\n')}
console.log(JSON.stringify(result));if(issues.length)process.exitCode=2;
