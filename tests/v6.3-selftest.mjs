#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {evaluate,digest,evidenceHashes} from '../benchmarks/v6.3/evaluate.mjs';
let checks=0;
const root=await fs.mkdtemp(path.join(os.tmpdir(),'pmk-v63-eval-'));
try{
 const evPath='figma/synthetic.txt';await fs.mkdir(path.join(root,'figma'));await fs.writeFile(path.join(root,evPath),'synthetic test only');
 const evHash=digest(await fs.readFile(path.join(root,evPath)));
 const types=[
  ['width',100,100,120],['height',50,50,30],['x',0,0,8],['y',0,0,12],
  ['padding_top',8,8,16],['padding_bottom',8,8,2],['gap',12,[12,12],[20,20]],
  ['font','Inter','Inter','Arial'],['weight',600,'600','400'],['size',16,'16px','19px'],
  ['line_height',24,'24px','28px'],['letter_spacing',0,'0px','2px'],
  ['fill','#ffffff','rgb(255, 255, 255)','rgb(240,240,240)'],
  ['color','#121212','rgb(18, 18, 18)','rgb(0, 0, 0)'],
  ['radius',8,'8px','2px'],['text','Order now','Order now','Order later'],
  ['child_count',3,3,2],['icon_present',true,true,false],
  ['image_loaded',true,true,false],['horizontal_overflow',false,false,true]
 ];
 const regions=types.map(([prop,expected,good])=>({
  id:prop,width:100,height:50,x:0,y:0,visible:true,padding_top:8,padding_bottom:8,
  renderedGaps:undefined,childRects:prop==='gap'?[{left:0,right:40,top:0,bottom:20,inFlow:true,display:'block'},{left:40+good[0],right:80+good[0],top:0,bottom:20,inFlow:true,display:'block'},{left:80+good[0]+good[1],right:120+good[0]+good[1],top:0,bottom:20,inFlow:true,display:'block'}]:undefined,actualRenderedFont:prop==='font'?good:undefined,
  fontActualUseVerified:true,requestedFontLoaded:true,svgPathCount:prop==='icon_present'?1:undefined,
  imageLoaded:prop==='image_loaded'?true:undefined,childcount:prop==='child_count'?good:undefined,
  text:prop==='text'?good:'',computedstyle:{display:prop==='gap'?'flex':'block',flexDirection:'row',fontFamily:'Inter',fontWeight:prop==='weight'?good:'600',fontSize:prop==='size'?good:'16px',lineHeight:prop==='line_height'?good:'24px',letterSpacing:prop==='letter_spacing'?good:'0px',backgroundColor:prop==='fill'?good:'#fff',color:prop==='color'?good:'#121212',borderRadius:prop==='radius'?good:'8px'},
 }));
 const truth={status:'FROZEN_VERIFIED',viewport:{width:375,height:1069},layers:types.map(([property,expected])=>({id:property,source:'SYNTHETIC_TEST',evidence:evPath,evidenceSha256:evHash,checks:[{id:property,property,expected,tolerance:0,severity:['icon_present','image_loaded'].includes(property)?'P0':'P1'}]}))};
 const base={viewport:truth.viewport,coverageComplete:true,errors:[],blockedExternalRequests:[],regions,horizontalOverflow:false};
 const hashMap=await evidenceHashes(truth,root);
 const opts={root,hashes:hashMap,synthetic:true};
 const initial=evaluate(truth,base,opts);
 assert.equal(initial.checks.length,20);assert.equal(initial.counts.MATCH,20,JSON.stringify(initial.checks.filter(x=>x.status!=='MATCH')));checks++;
 let tp=0,fn=0,fp=0;
 for(const [property,,good,bad] of types){
  const modified=structuredClone(base);const region=modified.regions.find(x=>x.id===property);
  if(property==='width'||property==='height'||property==='x'||property==='y'||property.startsWith('padding_'))region[property]=bad;
  else if(property==='gap'){region.childRects[1].left=40+bad[0];region.childRects[1].right=80+bad[0];region.childRects[2].left=80+bad[0]+bad[1];region.childRects[2].right=120+bad[0]+bad[1];}
  else if(property==='font')region.actualRenderedFont=bad;
  else if(property==='weight')region.computedstyle.fontWeight=bad;
  else if(property==='size')region.computedstyle.fontSize=bad;
  else if(property==='line_height')region.computedstyle.lineHeight=bad;
  else if(property==='letter_spacing')region.computedstyle.letterSpacing=bad;
  else if(property==='fill')region.computedstyle.backgroundColor=bad;
  else if(property==='color')region.computedstyle.color=bad;
  else if(property==='radius')region.computedstyle.borderRadius=bad;
  else if(property==='text')region.text=bad;
  else if(property==='child_count')region.childcount=bad;
  else if(property==='icon_present')region.svgPathCount=bad?1:0;
  else if(property==='image_loaded')region.imageLoaded=bad;
  else if(property==='horizontal_overflow')modified.horizontalOverflow=bad;
  const result=evaluate(truth,modified,opts);
  const targeted=result.checks.find(x=>x.id===property);
  if(targeted.status==='MISMATCH')tp++;else fn++;
  fp+=result.checks.filter(x=>x.id!==property&&x.status==='MISMATCH').length;
  assert.equal(targeted.status,'MISMATCH',property+' should detect mutation');checks++;
 }
 assert.equal(tp,20);assert.equal(fn,0);assert.equal(fp,0);checks+=3;
 const missing=structuredClone(base);missing.regions.find(x=>x.id==='icon_present').svgPathCount=0;
 assert.equal(evaluate(truth,missing,opts).checks.find(x=>x.id==='icon_present').status,'MISMATCH');checks++;
 const unsupported=structuredClone(truth);unsupported.layers[0].checks[0].property='made_up';
 assert.equal(evaluate(unsupported,base,opts).checks[0].status,'NOT_EVALUABLE');checks++;
 const unknownProvenance=structuredClone(truth);delete unknownProvenance.layers[0].evidenceSha256;
 assert.equal(evaluate(unknownProvenance,base,opts).checks[0].status,'NOT_EVALUABLE');checks++;
 const untrusted=structuredClone(truth);untrusted.layers[0].source='AGENT_ESTIMATE';
 assert.equal(evaluate(untrusted,base,{...opts,synthetic:false}).checks[0].status,'NOT_EVALUABLE');checks++;
 const cached=structuredClone(base);cached.regions.find(x=>x.id==='font').actualRenderedFont=null;cached.regions.find(x=>x.id==='font').fontActualUseVerified=false;
 assert.equal(evaluate(truth,cached,opts).checks.find(x=>x.id==='font').status,'NOT_EVALUABLE');checks++;
 console.log('PASS v6.3 evaluator synthetic mutations '+JSON.stringify({totalChecks:checks,mutations:20,normalControls:20,tp,fn,fp,recall:tp/(tp+fn),precision:tp/(tp+fp)}));
}finally{await fs.rm(root,{recursive:true,force:true})}
