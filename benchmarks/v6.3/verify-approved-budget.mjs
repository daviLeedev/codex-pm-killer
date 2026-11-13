#!/usr/bin/env node
/** Verify explicit A/B/C user-approved cap (up to $10) against run ledger. No API calls. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const arg=k=>{const i=process.argv.indexOf('--'+k);return i<0?null:process.argv[i+1]};
const approval=arg('approval'),ledger=arg('ledger'),out=arg('out');
if(!approval||!ledger)throw Error('Usage: verify-approved-budget.mjs --approval approved.json --ledger ledger.json [--out report.json]');
const [approvalBytes,ledgerBytes]=await Promise.all([approval,ledger].map(f=>fs.readFile(f)));
const a=JSON.parse(approvalBytes.toString('utf8')),j=JSON.parse(ledgerBytes.toString('utf8'));
const issues=[];
const approvedCap=typeof a.approvedMaxUsd==='number'?Math.round(a.approvedMaxUsd*1e6):NaN;
if(a.schemaVersion!==1||a.currency!=='USD'||a.scope!=='ALL_AB_C'||!Number.isSafeInteger(approvedCap)||approvedCap<=0||approvedCap>10000000)issues.push('USER_APPROVAL_CAP_MISMATCH');
if(j.schemaVersion!==1||!Number.isSafeInteger(j.capMicro)||j.capMicro<=0||j.capMicro>10000000||j.capMicro!==approvedCap)issues.push('LEDGER_CAP_MISMATCH');
if(a.approvedBy!=='USER_EXPLICIT'||typeof a.evidenceId!=='string'||!a.evidenceId.trim())issues.push('EXPLICIT_APPROVAL_EVIDENCE_MISSING');
if(j.capMicro>5000000&&j.approvalSha256!==createHash('sha256').update(approvalBytes).digest('hex'))issues.push('APPROVAL_RECORD_HASH_MISMATCH');
const settled=(j.requests||[]).filter(r=>r.state==='SETTLED').reduce((v,r)=>v+(r.actualMicro||0),0);
const reserved=(j.requests||[]).filter(r=>r.state!=='SETTLED'&&r.state!=='VOID').reduce((v,r)=>v+(r.reservedMicro||0),0);
if(settled+reserved>j.capMicro)issues.push('BUDGET_OVERSPENT_OR_OVERRESERVED');
if((j.requests||[]).some(r=>r.state==='UNCERTAIN'||r.costExceededReservation))issues.push('UNCERTAIN_CHARGES');
const result={schemaVersion:1,status:issues.length?'PARTIAL':'RECORDED_BUDGET_POLICY_CONSISTENT',issues,approvedMaxUsd:a.approvedMaxUsd,ledgerCapUsd:j.capMicro/1e6,settledUsd:settled/1e6,reservedUsd:reserved/1e6,warning:'Operator-supplied approval evidence is not independently authenticated, nor is provider billing verified'};
if(out){await fs.mkdir(path.dirname(path.resolve(out)),{recursive:true});await fs.writeFile(out,JSON.stringify(result,null,2)+'\n')}
console.log(JSON.stringify(result));if(issues.length)process.exitCode=2;
