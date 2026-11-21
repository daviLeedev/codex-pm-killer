#!/usr/bin/env node
/** Candidate Figma-region ↔ full DOM matches; ambiguous matches never auto-PASS. */
import {cliArg,load,fileHash,atomicWrite,required} from './core.mjs';
const design=cliArg('design'),runtime=cliArg('runtime'),out=cliArg('out');
if(!design||!runtime||!out)throw Error('Usage: match-regions.mjs --design VERIFIED_INVENTORY.json --runtime DOM_INVENTORY.json --out MAPPINGS.json');
const [f,d]=await Promise.all([load(design),load(runtime)]);
required(f.status==='VERIFIED_EVIDENCE_FILES'&&Array.isArray(f.regions),'VERIFIED_FIGMA_REGIONS_REQUIRED');
required(d.status==='DOM_DISCOVERED'&&d.captureEnvironment==='REAL_APP_RUNTIME'&&!d.truncated&&Array.isArray(d.elements),'COMPLETE_REAL_DOM_DISCOVERY_REQUIRED');
required(f.frame.width===d.viewport.width&&f.frame.height===d.viewport.height,'FIGMA_DOM_VIEWPORT_MISMATCH');
const norm=v=>String(v??'').trim().replace(/\s+/g,' ').toLowerCase();
const roles={button:new Set(['button']),text:new Set(['text','heading','textbox']),image:new Set(['img','icon']),icon:new Set(['icon','img']),card:new Set(['region','generic','listitem']),container:new Set(['region','main','generic']),navigation:new Set(['navigation'])};
const roleScore=(f,d)=>{const role=norm(f),actual=norm(d);return role===actual?1:roles[role]?.has(actual)?0.8:0};
const textScore=(a,b)=>{
 const x=norm(a),y=norm(b);if(!x||!y)return null;if(x===y)return 1;if(x.length>4&&(x.includes(y)||y.includes(x)))return .72;
 const aSet=new Set(x.split(' ')),bSet=new Set(y.split(' '));
 const intersection=[...aSet].filter(v=>bSet.has(v)).length;
 return intersection?intersection/(aSet.size+bSet.size-intersection):0;
};
const boxScore=(expected,actual,width,height)=>{
 if(!expected||!actual||!Number.isFinite(expected.width)||!Number.isFinite(actual.width))return null;
 const spans=[['width',width],['height',height],['x',width],['y',height]];
 const comparable=spans.filter(([k])=>Number.isFinite(expected[k])&&Number.isFinite(actual[k]));
 if(!comparable.length)return null;
 return comparable.reduce((sum,[key,scale])=>sum+Math.exp(-Math.abs(expected[key]-actual[key])/Math.max(6,scale*.1)),0)/comparable.length;
};
const children=new Map(f.regions.map(r=>[r.id,r.parentId]));
const ordered=[],visited=new Set();
function visit(id){if(visited.has(id))return;const parent=children.get(id);if(parent)visit(parent);visited.add(id);const node=f.regions.find(r=>r.id===id);if(node)ordered.push(node)}
for(const region of f.regions)visit(region.id);
const mappings=[],used=new Set(),counts={MATCHED_CANDIDATE:0,AMBIGUOUS_MAPPING:0,STRUCTURAL_MISSING:0};
for(const region of ordered){
 const parent=mappings.find(m=>m.regionId===region.parentId&&m.status==='MATCHED_CANDIDATE')?.nodeId;
 const scored=[];
 for(const node of d.elements.filter(x=>x.visible===true&&!used.has(x.id))){
  // Figma groups and Vue DOM wrappers can differ: parent matching is evidence, not a hard filter.
  let parentDistance=null;
  if(parent){
   let current=node.parentId;
   for(let depth=0;depth<5&&current;depth++){
    if(current===parent){parentDistance=depth;break}
    current=d.elements.find(e=>e.id===current)?.parentId??null;
   }
  }
  const components=[],weights=[];
  const add=(score,weight)=>{if(score!==null){components.push(score*weight);weights.push(weight)}};
  add(node.figmaHint===region.id?1:null,.7);
  add(textScore(region.text,node.text||node.ariaLabel),.28);
  add(roleScore(region.role,node.role),.19);
  add(boxScore(region.box,node.box,d.viewport.width,d.viewport.height),.30);
  add(region.order===node.order?1:Math.exp(-Math.abs(region.order-node.order)),.08);
  if(parent)add(parentDistance===null?0:Math.max(.4,1-parentDistance*.15),.15);
  const score=components.reduce((a,b)=>a+b,0)/Math.max(.0001,weights.reduce((a,b)=>a+b,0));
  if(score>.40)scored.push({nodeId:node.id,selector:node.selector,score:Number(score.toFixed(5)),node});
 }
 scored.sort((a,b)=>b.score-a.score);
 const best=scored[0],second=scored[1],strongHint=best?.node?.figmaHint===region.id;
 const high=strongHint||(best?.score>=.85&&(!second||best.score-second.score>=.15));
 const status=!best||best.score<.60?'STRUCTURAL_MISSING':high?'MATCHED_CANDIDATE':'AMBIGUOUS_MAPPING';
 if(status==='MATCHED_CANDIDATE')used.add(best.nodeId);
 counts[status]++;
 mappings.push({regionId:region.id,figmaPath:region.path,parentId:region.parentId,required:region.required,
  status,nodeId:status==='MATCHED_CANDIDATE'?best.nodeId:null,
  selector:status==='MATCHED_CANDIDATE'?best.selector:null,
  confidence:best?.score??0,candidates:scored.slice(0,3).map(x=>({nodeId:x.nodeId,score:x.score})),
  reason:status==='STRUCTURAL_MISSING'?'No uniquely supported corresponding runtime node':status==='AMBIGUOUS_MAPPING'?'Multiple plausible or weak candidates':'Candidate, not independent source confirmation'});
}
const unmatched=d.elements.filter(x=>x.visible&&x.isInteractive&&!used.has(x.id)).map(x=>({nodeId:x.id,role:x.role,selector:x.selector}));
const status=mappings.some(x=>x.required&&x.status!=='MATCHED_CANDIDATE')?'PARTIAL_MAPPINGS':'MAPPING_RECORDED';
const report={schemaVersion:1,status,designSha256:await fileHash(design),runtimeSha256:await fileHash(runtime),
 counts,mappings,unmappedInteractiveNodes:unmatched,scope:{viewport:d.viewport,frameId:f.frame.id},
 warning:'Candidates are heuristics; only direct Figma and runtime evidence can certify numeric values. Ambiguities are never marked MATCH.'};
await atomicWrite(out,report);console.log(JSON.stringify({status,counts,unmappedInteractive:unmatched.length}));
if(status==='PARTIAL_MAPPINGS')process.exitCode=2;
