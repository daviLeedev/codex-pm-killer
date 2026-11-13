#!/usr/bin/env node
/** Pre-paid-call readiness gate. Checks operator-supplied proofs and frozen invariants only. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const args=process.argv.slice(2),opt=k=>{const i=args.indexOf(k.startsWith('--')?k:'--'+k);return i<0?null:args[i+1]};
const paths={gold:opt('--gold-lock'),assets:opt('--asset-lock'),mapping:opt('--mapping'),approval:opt('--approval'),browser:opt('--browser-report')};
const phase=opt('--phase')??'post-build';
if(!['pre-build','post-build'].includes(phase))throw Error('Invalid readiness phase');
if(Object.entries(paths).some(([k,p])=>!p&&(k!=='mapping'||phase==='post-build'))||!opt('--out'))throw Error('Usage: readiness-gate.mjs --phase pre-build|post-build --gold-lock FILE --asset-lock FILE --approval FILE --browser-report FILE [--mapping FILE (required post-build)] --out FILE');
const docs=Object.fromEntries(await Promise.all(Object.entries(paths).filter(([,p])=>Boolean(p)).map(async([k,p])=>[k,JSON.parse(await fs.readFile(p,'utf8'))])));
const blockers=[],notes=[];const b=(code,detail)=>blockers.push({code,detail});
const g=docs.gold,a=docs.assets,m=docs.mapping??{regions:[]},u=docs.approval,r=docs.browser;
if(g.status!=='FROZEN_RECORDED_EVIDENCE'||g.unknown?.length||g.problems?.length) b('GOLD_NOT_VERIFIED','Need direct Figma Properties evidence with matching hashes');
if(g.assertions!==150)b('GOLD_COUNT_MISMATCH','Expected frozen 150 assertions for Algolia legacy benchmark');
if(a.status!=='READY'||!a.packId||!a.manifestSha256||a.issues?.length)b('ASSET_PACK_NOT_LOCKED','Verify all shared assets and hashes before task distribution');
if(!Array.isArray(g.requiredRegionIds)||!g.requiredRegionIds.length)b('REQUIRED_REGION_INVENTORY_MISSING','Gold lock must include complete required region IDs');
if(phase==='post-build'){
 if(!Array.isArray(m.regions)||m.regions.length===0)b('MAPPING_MISSING','Provide actual finished app Figma-ID → DOM selector mappings');
 const ids=new Set((m.regions??[]).map(z=>z.id));
 for(const id of g.requiredRegionIds??[])if(!ids.has(id))b('REQUIRED_REGION_NOT_MAPPED',id);
}else{
 notes.push('PRE_BUILD: actual DOM does not exist yet. Every A/B/C implementation must be independently mapped and checked after construction; this is NOT a final DOM audit.');
}
const approvedCap=typeof u.approvedMaxUsd==='number'?Math.round(u.approvedMaxUsd*1e6):NaN;
if(!Number.isSafeInteger(approvedCap)||approvedCap<=0||approvedCap>10000000||u.currency!=='USD'||u.scope!=='ALL_AB_C'||u.approvedBy!=='USER_EXPLICIT'||typeof u.evidenceId!=='string'||!u.evidenceId.trim())
 b('BUDGET_NOT_APPROVED','Explicit user-approved aggregate A/B/C cap must be positive and <=$10');
if(approvedCap>5000000){
 const ledgerFile=opt('--ledger');
 if(!ledgerFile)b('BUDGET_LEDGER_REQUIRED','A $10 experiment requires a newly initialized ledger with the exact approval file');
 else {
  try{
   const ledger=JSON.parse(await fs.readFile(ledgerFile,'utf8'));
   const approvalSha=createHash('sha256').update(await fs.readFile(paths.approval)).digest('hex');
   if(ledger.capMicro!==approvedCap||ledger.approvalSha256!==approvalSha)b('LEDGER_APPROVAL_MISMATCH','Ledger cap or approval evidence hash differs from authorization');
   if(ledger.requests?.some(q=>q.state==='UNCERTAIN'||q.costExceededReservation))b('BUDGET_UNCERTAIN','Uncertain charges prevent further paid calls');
  }catch(e){b('BUDGET_LEDGER_UNREADABLE',String(e.message))}
 }
}
if(r.status!=='PASS'||r.realBrowser!==true||r.stableTwoCaptures!==true)b('BROWSER_SMOKE_NOT_READY','Actual Playwright Chromium smoke test and repeat capture required');
if((r.fontEvidenceConfirmed??0)<1)b('FONT_BROWSER_PROOF_MISSING','Verify at least one glyph font from Chromium CDP');
if(a.originalVisualFidelity!=='SOURCE_CLAIM_RECORDED')notes.push('Substitute images do not demonstrate original Figma image/pixel fidelity; report separately as NOT_EVALUABLE');
const result={schemaVersion:1,phase,postBuildMappingRequired:phase==='pre-build',status:blockers.length?'BLOCKED':phase==='pre-build'?(a.originalVisualFidelity==='SOURCE_CLAIM_RECORDED'?'READY_FOR_BUILD':'READY_FOR_BUILD_WITH_SUBSTITUTES'):notes.length?'READY_WITH_SUBSTITUTES':'READY',blockers,notes,packId:a.packId,packSha256:a.manifestSha256,truthSha256:g.truthSha256,approvedCapUsd:u.approvedMaxUsd,warning:'Readiness checks written records, not user intent, true Figma authorship, billed credits or remote browser access.'};
await fs.mkdir(path.dirname(path.resolve(opt('--out'))),{recursive:true});await fs.writeFile(opt('--out'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));if(blockers.length)process.exitCode=2;
