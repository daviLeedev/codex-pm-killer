#!/usr/bin/env node
/** Read matched runtime CSS rules with Chromium CDP; source files are *candidates*, not proven causes. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {cliArg,load,atomicWrite,required,fileHash} from './core.mjs';
const url=cliArg('url'),diff=cliArg('issues'),out=cliArg('out'),projectRoot=path.resolve(cliArg('project-root',process.cwd()));
if(!url||!diff||!out)throw Error('Usage: trace-css.mjs --url LOCAL_APP_URL --issues DIFF.json --out CSS_TRACE.json [--project-root APP_DIR]');
const urlObj=new URL(url);required(['localhost','127.0.0.1','[::1]'].includes(urlObj.hostname)&&['http:','https:'].includes(urlObj.protocol),'LOCAL_APP_ONLY');
const report=await load(diff);required(report.status==='ISSUES_RECORDED'&&Array.isArray(report.issues),'MEASURED_ISSUE_LIST_REQUIRED');
const require=createRequire(path.resolve(process.cwd(),'package.json'));
let chromium;try{({chromium}=require('playwright'))}catch{({chromium}=require('@playwright/test'))}
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
const findings=[],errors=[];
try{
 const context=await browser.newContext({viewport:{width:Number(cliArg('width','375')),height:Number(cliArg('height','800'))},deviceScaleFactor:1});
 const page=await context.newPage();
 await page.goto(url,{waitUntil:'domcontentloaded'});await page.evaluate(()=>document.fonts?.ready);
 const client=await context.newCDPSession(page);
 await client.send('DOM.enable');await client.send('CSS.enable');
 const root=await client.send('DOM.getDocument',{depth:-1,pierce:true});
 const sheets=new Map();
 client.on('CSS.styleSheetAdded',event=>sheets.set(event.header.styleSheetId,event.header));
 const getSource=async sheetId=>{
  const head=sheets.get(sheetId);
  const uri=head?.sourceURL??head?.ownerNode??null;
  if(typeof uri!=='string'||!uri.startsWith('http'))return {styleSheetUrl:typeof uri==='string'?uri:null,localFile:null,grade:'SOURCE_UNVERIFIED'};
  let file=null;
  try{
   const u=new URL(uri);
   if(['localhost','127.0.0.1','[::1]'].includes(u.hostname)){
    const candidate=path.resolve(projectRoot,decodeURIComponent(u.pathname).replace(/^\//,''));
    if(candidate.startsWith(projectRoot+path.sep)){
     const stat=await fs.stat(candidate).catch(()=>null);
     if(stat?.isFile())file=path.relative(projectRoot,candidate).replaceAll(path.sep,'/');
    }
   }
  }catch{}
  return {styleSheetUrl:uri,localFile:file,grade:file?'EXISTING_LOCAL_SOURCE_CANDIDATE':'SOURCE_UNVERIFIED'};
 };
 for(const issue of report.issues){
  const r={issueId:issue.issueId,regionId:issue.regionId,domSelector:issue.domSelector??null,property:issue.comparison?.property??null,rules:[],status:'UNTRACED',errors:[]};
  if(!issue.domSelector){r.errors.push('DOM_SELECTOR_MISSING');findings.push(r);continue}
  try{
   const count=await page.locator(issue.domSelector).count();
   if(count!==1)throw Error('RUNTIME_SELECTOR_NOT_UNIQUE_COUNT_'+count);
   const node=await client.send('DOM.querySelector',{nodeId:root.root.nodeId,selector:issue.domSelector});
   if(!node.nodeId)throw Error('NO_CDP_NODE');
   const response=await client.send('CSS.getMatchedStylesForNode',{nodeId:node.nodeId});
   const matches=[...(response.matchedCSSRules??[]).map(x=>x.rule),...(response.inherited??[]).flatMap(x=>(x.matchedCSSRules??[]).map(y=>y.rule))];
   for(const rule of matches){
    const style=rule.style??{},props=(style.cssProperties??[]).filter(p=>!p.disabled&&p.name).map(p=>({name:p.name,value:p.value,important:p.important??false}));
    const source=await getSource(rule.styleSheetId);
    r.rules.push({selector:(rule.selectorList?.selectors??[]).map(x=>x.text).join(', '),origin:rule.origin,
     cssProperties:props,source,range:style.range??null});
   }
   if(response.inlineStyle)r.rules.push({selector:'<inline-style>',origin:'inline',cssProperties:(response.inlineStyle.cssProperties??[]).map(x=>({name:x.name,value:x.value})),
    source:{styleSheetUrl:null,localFile:null,grade:'INLINE_STYLE'},range:null});
   r.status=r.rules.length?'MATCHED_RULE_CANDIDATES':'NO_MATCHED_CSS_RULES';
  }catch(e){r.errors.push(String(e.message));errors.push(issue.issueId+': '+e.message)}
  findings.push(r);
 }
}finally{await browser.close()}
const output={schemaVersion:1,status:errors.length?'PARTIAL':'CSS_RULES_RECORDED',runtimeUrlOrigin:urlObj.origin,
 inputIssuesSha256:await fileHash(diff),issues:findings,errors,
 warning:'Matched CDP rules indicate applied stylesheet candidates, not unique causal attribution. Source maps and Vue SFC dynamic styles may require explicit manual verification.'};
await atomicWrite(out,output);
console.log(JSON.stringify({status:output.status,issues:findings.length,errors:errors.length}));
if(errors.length)process.exitCode=2;
