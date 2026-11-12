#!/usr/bin/env node
import assert from 'node:assert/strict';
import {evaluate} from '../benchmarks/v6.3/evaluate.mjs';
const hash='a'.repeat(64),evidence='synthetic/evidence.txt';
const v={width:375,height:1069},ref={root:process.cwd(),synthetic:true,hashes:new Map([[evidence,hash]])};
function check(property,expected,region,expectedStatus,extra={}){
 const l={id:'case',source:'SYNTHETIC_TEST',evidence,evidenceSha256:hash,checks:[{id:'test',property,expected,tolerance:1,...extra}]};
 const r=evaluate({viewport:v,status:'FROZEN_VERIFIED',layers:[l]},{viewport:v,regions:[{id:'case',visible:true,...region}]},ref).checks[0];
 assert.equal(r.status,expectedStatus,JSON.stringify(r));return true;
}
const y=[{top:0,bottom:40,left:0,right:20,inFlow:true,display:'block'},{top:48,bottom:88,left:0,right:20,inFlow:true,display:'block'}];
const x=[{left:0,right:40,top:0,bottom:20,inFlow:true,display:'block'},{left:50,right:90,top:0,bottom:20,inFlow:true,display:'block'}];
let n=0;
n+=check('gap',8,{computedstyle:{display:'block',flexDirection:'row'},childRects:y},'MATCH');
n+=check('gap',10,{computedstyle:{display:'block',flexDirection:'row'},childRects:y},'MISMATCH');
n+=check('gap',10,{computedstyle:{display:'flex',flexDirection:'row'},childRects:x},'MATCH');
n+=check('gap',8,{computedstyle:{display:'flex',flexDirection:'column'},childRects:y},'MATCH');
n+=check('gap',10,{computedstyle:{display:'grid'},childRects:x},'NOT_EVALUABLE');
n+=check('gap',10,{computedstyle:{display:'grid'},childRects:x},'MATCH',{axis:'column'});
n+=check('gap',8,{computedstyle:{display:'grid'},childRects:y},'MATCH',{axis:'row'});
n+=check('gap',8,{computedstyle:{display:'block'},childRects:y.map(z=>({...z,display:'inline'}))},'NOT_EVALUABLE');
n+=check('gap',8,{computedstyle:{display:'table'},childRects:y},'NOT_EVALUABLE');
n+=check('placeholder_text','Search products',{placeholderText:'Search products'},'MATCH');
n+=check('placeholder_text','Search products',{placeholderText:'Different'},'MISMATCH');
n+=check('placeholder_color','#888888',{placeholderColor:'rgb(136, 136, 136)'},'MATCH');
n+=check('color','#888888',{placeholderVisible:true,placeholderColor:'rgb(136, 136, 136)',computedstyle:{color:'black'}},'MATCH');
n+=check('placeholder_color','#888888',{placeholderColor:'rgb(0, 0, 0)'},'MISMATCH');
n+=check('placeholder_color','#888888',{},'NOT_EVALUABLE');
n+=check('asset_kind','raster_photo',{assetKind:'vector'},'MISMATCH');
n+=check('asset_kind','raster_photo',{assetKind:'raster_photo'},'MATCH');
console.log('PASS v6.3.1 layout/placeholder/asset synthetic regressions: '+n);
