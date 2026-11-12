#!/usr/bin/env node
/** Pre-paid-call readiness gate. Checks operator-supplied proofs and frozen invariants only. */
import fs from 'node:fs/promises';
import path from 'node:path';
const args=process.argv.slice(2),opt=k=>{const i=args.indexOf(k.startsWith('--')?k:'--'+k);return i<0?null:args[i+1]};
const paths={gold:opt('--gold-lock'),assets:opt('--asset-lock'),mapping:opt('--mapping'),approval:opt('--approval'),browser:opt('--browser-report')};
if(Object.values(paths).some(p=>!p)||!opt('--out'))throw Error('Usage: readiness-gate.mjs --gold-lock FILE --asset-lock FILE --mapping FILE --approval FILE --browser-report FILE --out FILE');
const docs=Object.fromEntries(await Promise.all(Object.entries(paths).map(async([k,p])=>[k,JSON.parse(await fs.readFile(p,'utf8'))])));
const blockers=[],notes=[];const b=(code,detail)=>blockers.push({code,detail});
const g=docs.gold,a=docs.assets,m=docs.mapping,u=docs.approval,r=docs.browser;
if(g.status!=='FROZEN_RECORDED_EVIDENCE'||g.unknown?.length||g.problems?.length) b('GOLD_NOT_VERIFIED','Need direct Figma Properties evidence with matching hashes');
if(g.assertions!==150)b('GOLD_COUNT_MISMATCH','Expected frozen 150 assertions for Algolia legacy benchmark');
if(a.status!=='READY'||!a.packId||!a.manifestSha256||a.issues?.length)b('ASSET_PACK_NOT_LOCKED','Verify all shared assets and hashes before task distribution');
if(!Array.isArray(m.regions)||m.regions.length===0)b('MAPPING_MISSING','Provide Figma-ID → DOM selector mappings');
if(!Array.isArray(g.requiredRegionIds)||!g.requiredRegionIds.length)b('REQUIRED_REGION_INVENTORY_MISSING','Gold lock must include complete required region IDs');
const ids=new Set((m.regions??[]).map(z=>z.id));
for(const id of g.requiredRegionIds??[])if(!ids.has(id))b('REQUIRED_REGION_NOT_MAPPED',id);
if(u.approvedMaxUsd!==5||u.currency!=='USD'||u.scope!=='ALL_AB_C'||u.approvedBy!=='USER_EXPLICIT'||!u.evidenceId)b('BUDGET_NOT_APPROVED','User-approved combined A/B/C cap must be $5 with private evidence');
if(r.status!=='PASS'||r.realBrowser!==true||r.stableTwoCaptures!==true)b('BROWSER_SMOKE_NOT_READY','Actual Playwright Chromium smoke test and repeat capture required');
if((r.fontEvidenceConfirmed??0)<1)b('FONT_BROWSER_PROOF_MISSING','Verify at least one glyph font from Chromium CDP');
if(a.originalVisualFidelity!=='SOURCE_CLAIM_RECORDED')notes.push('Substitute images do not demonstrate original Figma image/pixel fidelity; report separately as NOT_EVALUABLE');
const result={schemaVersion:1,status:blockers.length?'BLOCKED':notes.length?'READY_WITH_SUBSTITUTES':'READY',blockers,notes,packId:a.packId,packSha256:a.manifestSha256,truthSha256:g.truthSha256,approvedCapUsd:u.approvedMaxUsd,warning:'Readiness checks written records, not user intent, true Figma authorship, billed credits or remote browser access.'};
await fs.mkdir(path.dirname(path.resolve(opt('--out'))),{recursive:true});await fs.writeFile(opt('--out'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));if(blockers.length)process.exitCode=2;
