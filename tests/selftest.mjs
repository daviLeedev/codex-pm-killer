#!/usr/bin/env node
/** Synthetic fixtures only — cannot authenticate Figma or prove real-world completeness. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'pm-killer-test-'));
const put=async(p,s='evidence')=>{const f=path.join(dir,p);await fs.mkdir(path.dirname(f),{recursive:true});await fs.writeFile(f,s)};
const json=(p,v)=>put(p,JSON.stringify(v,null,2));
const run=(script,...args)=>spawnSync(process.execPath,[path.join(root,'scripts',script),...args],{encoding:'utf8'});
const box=(x,y,w,h)=>({x,y,left:x,top:y,right:x+w,bottom:y+h,width:w,height:h});
try{
 const evidence=['figma-sheet.png','figma-notice.png','figma-list.png','figma-gap.png','figma-frame.png','local-before.png','local-after.png','overlay.png','figma-inventory.png','figma-revisited.png','local-region.png','impact.png','before.txt','after.txt'];
 for(const f of evidence)await put(f);
 const snap={schemaVersion:1,viewport:{width:400,height:844,deviceScaleFactor:1},pageUrl:'http://localhost:5173/terms',elements:[{selector:'.sheet',box:box(0,300,400,420)},{selector:'.notice',box:box(24,355,352,40)},{selector:'.list',box:box(24,411,352,180)}]};
 await json('render/layout.json',snap);
 const map={schemaVersion:1,scope:{route:snap.pageUrl,viewport:snap.viewport},regions:[
  {id:'SHEET',figmaPath:'Frame/Sheet',domSelectors:['.sheet'],matchMode:'visual-region',source:'FIGMA_UI_OBSERVED',figmaEvidence:'figma-sheet.png',expectedBox:{width:400,height:420}},
  {id:'NOTICE',figmaPath:'Frame/Sheet/Notice',domSelectors:['.notice'],matchMode:'visual-region',source:'FIGMA_UI_OBSERVED',figmaEvidence:'figma-notice.png',expectedBox:{height:40}},
  {id:'LIST',figmaPath:'Frame/Sheet/List',domSelectors:['.list'],matchMode:'visual-region',source:'FIGMA_UI_OBSERVED',figmaEvidence:'figma-list.png',expectedBox:{height:180}},
 ],relations:[{id:'GAP',from:'NOTICE',fromEdge:'bottom',to:'LIST',toEdge:'top',expectedPx:16,tolerancePx:1,source:'FIGMA_UI_MEASURED',figmaEvidence:'figma-gap.png'}]};
 await json('region-map.json',map);
 let r=run('compare-region-geometry.mjs','--map',path.join(dir,'region-map.json'),'--actual',path.join(dir,'render/layout.json'),'--out',path.join(dir,'region-report.json'));
 assert.equal(r.status,0,r.stdout+' '+r.stderr);
 const repro={schemaVersion:1,cases:[{id:'WRAP',category:'RESPONSIVE',reportedDefect:true,steps:'Test real app before/at/after breakpoint',widthsPx:[399,400,401],environment:'REAL_APP',before:'REPRODUCED',beforeEvidence:'before.txt',after:'PASS',afterEvidence:'after.txt'}]};
 await json('repro-matrix.json',repro);
 r=run('verify-repro-matrix.mjs','--matrix',path.join(dir,'repro-matrix.json'));assert.equal(r.status,0,r.stdout+' '+r.stderr);
 const regions=map.regions.map(x=>({id:x.id,firstPass:'INSPECTED',secondPass:'PASS',figmaEvidence:x.figmaEvidence,localEvidence:'local-region.png',appEvidenceGrade:'APP_RUNTIME_MEASURED',propertyChecks:[{name:'height',source:'OBSERVED',expected:'100px',actual:'100px',delta:0,tolerance:'1px',status:'PASS',appEvidenceGrade:'APP_RUNTIME_MEASURED'}]}));
 const audit={schemaVersion:1,scope:{figmaFrame:'Frame',appRoute:snap.pageUrl,viewport:'400x844 @ DPR 1'},artifacts:{figmaBaseline:'figma-frame.png',localBefore:'local-before.png',localAfter:'local-after.png',visualComparison:'overlay.png',layoutReport:'layout-report.json',figmaLayerInventory:'figma-inventory.png',localDomInventory:'render/layout.json',regionMap:'region-map.json',regionReport:'region-report.json',reproMatrix:'repro-matrix.json',reproGateReport:'repro-gate-report.json'},regions,issues:[],regression:{finalVisualSweep:'PASS',functionalSmoke:'PASS',typecheckOrBuild:'PASS',impactReview:'PASS',independentSourceRecheck:'PASS',impactEvidence:'impact.png',figmaRevisitedEvidence:'figma-revisited.png'}};
 await json('layout-report.json',{counts:{PASS:3,FAIL:0,SKIPPED:0}});
 await json('detail-audit.json',audit);
 r=run('verify-detail-audit.mjs','--audit',path.join(dir,'detail-audit.json'));assert.equal(r.status,0,r.stdout+' '+r.stderr);
 snap.elements[2].box=box(24,419,352,180);await json('render/layout.json',snap);
 r=run('compare-region-geometry.mjs','--map',path.join(dir,'region-map.json'),'--actual',path.join(dir,'render/layout.json'),'--out',path.join(dir,'region-report.json'));assert.notEqual(r.status,0,'+8px gap should fail');
 r=run('verify-detail-audit.mjs','--audit',path.join(dir,'detail-audit.json'));assert.notEqual(r.status,0,'failed region check must fail gate');
 snap.elements[2].box=box(24,411,352,180);await json('render/layout.json',snap);
 r=run('compare-region-geometry.mjs','--map',path.join(dir,'region-map.json'),'--actual',path.join(dir,'render/layout.json'),'--out',path.join(dir,'region-report.json'));assert.equal(r.status,0);
 audit.regions.pop();await json('detail-audit.json',audit);
 r=run('verify-detail-audit.mjs','--audit',path.join(dir,'detail-audit.json'));assert.notEqual(r.status,0,'unmapped region should fail');
 repro.cases[0].before='NOT_REPRODUCED';await json('repro-matrix.json',repro);
 r=run('verify-repro-matrix.mjs','--matrix',path.join(dir,'repro-matrix.json'));assert.notEqual(r.status,0,'original symptom not reproduced should fail');
 console.log('PASS: synthetic coverage checks, 8px gap failure, missing region failure, missing reproduction failure');
}finally{await fs.rm(dir,{recursive:true,force:true})}
