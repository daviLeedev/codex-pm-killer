#!/usr/bin/env node
/** Synthetic mutation tests: no claim of live Figma or application access. */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'codex-pm-killer-v5-'));
const pp=(p)=>path.join(temp,p);
const save=async(p,data)=>{await fs.mkdir(path.dirname(pp(p)),{recursive:true});await fs.writeFile(pp(p),typeof data==='string'?data:JSON.stringify(data,null,2));};
const run=(command,opts)=>spawnSync(process.execPath,[path.join(root,'scripts/v5-audit.mjs'),command,...Object.entries(opts).flatMap(([k,v])=>['--'+k,pp(v)])],{encoding:'utf8'});
const success=(command,opts)=>{const r=run(command,opts);assert.equal(r.status,0,`Expected ${command} PASS: ${r.stdout} ${r.stderr}`);return r;};
const reject=(command,opts,label)=>{const r=run(command,opts);assert.notEqual(r.status,0,`Expected ${label} to FAIL`);return r;};
const box=(x,y,w,h)=>({x,left:x,y,top:y,width:w,height:h,right:x+w,bottom:y+h});
const viewport={width:400,height:844,deviceScaleFactor:1};
const snapshot={schemaVersion:1,capturedAt:'2026-11-10T00:00:00Z',viewport,pageUrl:'http://localhost:5173/terms',elementLimit:600,candidateElementCount:3,truncated:false,elements:[
 {selector:'.modal',tag:'div',box:box(0,100,400,420),css:{paddingTop:'24px',paddingRight:'24px',paddingBottom:'24px',paddingLeft:'24px',borderWidth:'0px'}},
 {selector:'.modal > h2',tag:'h2',text:'약관',box:box(24,124,352,40),css:{fontSize:'20px',lineHeight:'40px',paddingTop:'0px',paddingRight:'0px',paddingBottom:'0px',paddingLeft:'0px',borderWidth:'0px'}},
 {selector:'.modal > button',tag:'button',text:'확인',box:box(24,180,352,40),css:{fontSize:'14px',lineHeight:'20px',paddingTop:'0px',paddingRight:'0px',paddingBottom:'0px',paddingLeft:'0px',borderWidth:'0px'}}
 ]};
const figma={schemaVersion:5,kind:'FIGMA',scope:{frame:'Terms modal',viewport},coverage:{status:'COMPLETE',expandedBranches:['Terms modal','Header','Button'],evidence:'evidence/layers.txt'},items:[
 {id:'F-MODAL',path:'Terms modal',role:'container',source:'FIGMA_UI_OBSERVED',evidence:'evidence/modal.txt',expectedBox:{width:400,height:420},expectedContent:{contentWidth:352},tolerancePx:1},
 {id:'F-TITLE',parentId:'F-MODAL',path:'Terms modal / title',role:'heading',text:'약관',source:'FIGMA_UI_OBSERVED',evidence:'evidence/title.txt',expectedBox:{width:352,height:40},expectedCss:{fontSize:'20px'},tolerancePx:1},
 {id:'F-BUTTON',parentId:'F-MODAL',path:'Terms modal / confirm',role:'button',text:'확인',source:'FIGMA_UI_OBSERVED',evidence:'evidence/button.txt',expectedBox:{height:40},tolerancePx:1}
 ],relations:[{id:'TITLE_BUTTON_GAP',from:'F-TITLE',to:'F-BUTTON',fromEdge:'bottom',toEdge:'top',expectedPx:16,source:'FIGMA_UI_MEASURED',evidence:'evidence/gap.txt',tolerancePx:1}]};
const approved={pairs:[
 {figmaId:'F-MODAL',domId:'DOM-00001',reviewStatus:'APPROVED',reviewSource:'REAL_FIGMA_AND_APP',reviewer:'reviewer-1',evidence:'evidence/map.txt'},
 {figmaId:'F-TITLE',domId:'DOM-00002',reviewStatus:'APPROVED',reviewSource:'REAL_FIGMA_AND_APP',reviewer:'reviewer-1',evidence:'evidence/map.txt'},
 {figmaId:'F-BUTTON',domId:'DOM-00003',reviewStatus:'APPROVED',reviewSource:'REAL_FIGMA_AND_APP',reviewer:'reviewer-1',evidence:'evidence/map.txt'}
 ]};
const review=(who)=>({schemaVersion:5,scope:{frame:'Terms modal',viewport},review:{reviewerId:who,figmaAccess:'DIRECT_VIEWER_UI',status:'COMPLETE',evidence:'evidence/review.txt'},items:figma.items.map(x=>({id:x.id}))});
const inv={snapshot:'render/layout.json',out:'dom.json'};
const map={figma:'figma.json',dom:'dom.json',approved:'approved.json',out:'mapping.json'};
const geo={figma:'figma.json',dom:'dom.json',mapping:'mapping.json',out:'geometry.json'};
const independence={first:'first.json',second:'second.json',out:'independent.json'};
const gate={mapping:'mapping.json',geometry:'geometry.json',independent:'independent.json',out:'gate.json'};
try{
 for(const f of ['layers','modal','title','button','gap','map','review'])await save('evidence/'+f+'.txt','synthetic evidence — not actual Figma');
 await save('render/layout.json',snapshot);await save('figma.json',figma);await save('approved.json',approved);
 await save('first.json',review('agent-A'));await save('second.json',review('agent-B'));
 success('inventory',inv);success('match',map);success('geometry',geo);success('independent',independence);success('gate',gate);
 // Mutation 1: incorrect box width 400→388 and changed content width (Figma expected 400/352).
 const badWidth=structuredClone(snapshot);badWidth.elements[0].box=box(0,100,388,420);await save('render/layout.json',badWidth);
 success('inventory',inv);success('match',map);reject('geometry',geo,'width mutation');
 await save('render/layout.json',snapshot);success('inventory',inv);success('geometry',geo);
 // Mutation 2: wrong rendered edge gap +8px, even if CSS gap declarations appear correct.
 const badGap=structuredClone(snapshot);badGap.elements[2].box=box(24,188,352,40);await save('render/layout.json',badGap);
 success('inventory',inv);success('match',map);reject('geometry',geo,'rendered spacing mutation');
 await save('render/layout.json',snapshot);success('inventory',inv);success('geometry',geo);
 // Mutation 3: Figma button omitted from the proposed approved mapping.
 const missing=structuredClone(approved);missing.pairs.pop();await save('approved.json',missing);
 reject('match',map,'unmatched button');
 await save('approved.json',approved);success('match',map);
 // Mutation 4: incompletely captured DOM MUST NOT pass.
 const truncated=structuredClone(snapshot);truncated.truncated=true;truncated.candidateElementCount=1000;await save('render/layout.json',truncated);
 reject('inventory',inv,'truncated capture');reject('match',map,'incomplete DOM');
 await save('render/layout.json',snapshot);success('inventory',inv);success('match',map);
 // Mutation 5: one agent checking twice is not independently verified.
 await save('second.json',review('agent-A'));reject('independent',independence,'same reviewer');
 await save('second.json',review('agent-B'));success('independent',independence);
 // Mutation 6: second audit finds extra Figma element; gate must block.
 const unseen=review('agent-B');unseen.items.push({id:'F-UNKNOWN'});await save('second.json',unseen);
 reject('independent',independence,'missed layer');reject('gate',gate,'incomplete independent review');
 await save('second.json',review('agent-B'));success('independent',independence);success('gate',gate);
 console.log('PASS v5: 6 mutation cases rejected; complete synthetic fixture passes. No real Figma or Vue runtime tested.');
}finally{await fs.rm(temp,{recursive:true,force:true});}
