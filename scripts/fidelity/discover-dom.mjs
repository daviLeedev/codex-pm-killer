#!/usr/bin/env node
/** Exhaustive scoped DOM discovery from an actual LOCAL browser; not a Figma reader. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {cliArg,atomicWrite,required,sha256} from './core.mjs';
const url=cliArg('url'),fixture=cliArg('fixture-html'),out=cliArg('out');
if((!url&&!fixture)||(url&&fixture)||!out)throw Error('Usage: discover-dom.mjs (--url http://localhost:5173 | --fixture-html PRIVATE.html) --out dom-inventory.json [--width 375 --height 800] [--max-nodes 8000]');
if(url){const u=new URL(url);required(['localhost','127.0.0.1','[::1]'].includes(u.hostname)&&['http:','https:'].includes(u.protocol),'LOCAL_APP_ONLY')}
const width=Number(cliArg('width','375')),height=Number(cliArg('height','800')),limit=Number(cliArg('max-nodes','8000'));
required(Number.isInteger(width)&&Number.isInteger(height)&&width>0&&height>0&&Number.isInteger(limit)&&limit>=10,'INVALID_VIEWPORT_OR_NODE_LIMIT');
const require=createRequire(path.resolve(process.cwd(),'package.json'));
let chromium;try{({chromium}=require('playwright'))}catch{({chromium}=require('@playwright/test'))}
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
const errors=[],blockedExternalRequests=[],warnings=[];let result;
try{
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 page.on('requestfailed',r=>{
  try{const u=new URL(r.url());if(!['localhost','127.0.0.1','[::1]'].includes(u.hostname))blockedExternalRequests.push({origin:u.origin,reason:r.failure()?.errorText})}catch{}
 });
 if(url)await page.goto(url,{waitUntil:'domcontentloaded'});
 else await page.goto('file://'+path.resolve(fixture),{waitUntil:'domcontentloaded'});
 await page.evaluate(async()=>{
  if(document.fonts?.ready)await document.fonts.ready;
  await Promise.all([...document.images].map(img=>img.complete?Promise.resolve():new Promise(resolve=>{
   const done=()=>resolve();img.addEventListener('load',done,{once:true});img.addEventListener('error',done,{once:true});setTimeout(done,5000)
  })));
 });
 const collect=()=>page.evaluate(limit=>{
  const result=[],els=[...document.body.querySelectorAll('*')];
  if(els.length>limit)return {truncated:true,observed:els.length,items:[]};
  const ids=new Map(),siblingOrder=new Map();
  const escape=s=>window.CSS?.escape?CSS.escape(s):String(s).replace(/[^a-zA-Z0-9_-]/g,'\\$&');
  const cssPath=el=>{
   if(el.id)return '#'+escape(el.id);
   const qa=el.getAttribute('data-design-qa');if(qa)return '[data-design-qa="'+qa.replaceAll('"','\\"')+'"]';
   const parts=[];let p=el;
   while(p&&p!==document.body){
    const parent=p.parentElement;if(!parent)break;
    const i=[...parent.children].filter(x=>x.tagName===p.tagName).indexOf(p)+1;
    parts.unshift(p.tagName.toLowerCase()+':nth-of-type('+i+')');p=parent;
   }
   return 'body > '+parts.join(' > ');
  };
  function rect(el){const r=el.getBoundingClientRect();return {x:r.x,y:r.y,left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}}
  const getRole=el=>{
   const explicit=el.getAttribute('role');if(explicit)return explicit;
   const tag=el.tagName.toLowerCase();
   if(tag==='button')return 'button';if(tag==='a')return 'link';if(tag==='img')return 'img';
   if(tag==='input'||tag==='textarea')return 'textbox';if(tag==='svg')return 'icon';
   if(/^h[1-6]$/.test(tag))return 'heading';if(tag==='nav')return 'navigation';
   if(tag==='main')return 'main';if(tag==='section')return 'region';
   if(tag==='li')return 'listitem';return tag==='p'||tag==='span'?'text':'generic';
  };
  const desired=new Set(els);
  for(const el of els){
   const sel=cssPath(el),style=getComputedStyle(el),box=rect(el);
   const visible=style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)!==0&&box.width>0&&box.height>0;
   const parent=el.parentElement,container=parent&&desired.has(parent)?cssPath(parent):null;
   const order=parent?[...parent.children].indexOf(el):0;
   const directText=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.nodeValue).join(' ').trim().replace(/\s+/g,' ').slice(0,400);
   const text=el.matches('input,textarea')?(el.value||el.placeholder||''):directText;
   const svg=el.matches('svg')?el:null;
   const images=el.matches('img')?[el]:[];
   let assetKind=images.length?'raster_or_svg_img':svg?'vector_svg':'none';
   if(images.length&&images.some(i=>i.getAttribute('data-placeholder')==='true'))assetKind='placeholder';
   const item={id:sel,selector:sel,parentId:container,order,tag:el.tagName.toLowerCase(),role:getRole(el),
    figmaHint:el.getAttribute('data-design-qa')||null,text,ariaLabel:el.getAttribute('aria-label')||null,
    visible,box,childCount:el.children.length,
    computed:{display:style.display,position:style.position,flexDirection:style.flexDirection,flexWrap:style.flexWrap,gap:style.gap,
     paddingTop:style.paddingTop,paddingBottom:style.paddingBottom,paddingLeft:style.paddingLeft,paddingRight:style.paddingRight,
     marginTop:style.marginTop,marginBottom:style.marginBottom,fontFamily:style.fontFamily,fontSize:style.fontSize,
     fontWeight:style.fontWeight,lineHeight:style.lineHeight,color:style.color,backgroundColor:style.backgroundColor,
     borderRadius:style.borderRadius,overflow:style.overflow,objectFit:style.objectFit},
    assetKind,imageLoaded:images.length?images.every(i=>i.complete&&i.naturalWidth>0):null,
    svgPathCount:svg?svg.querySelectorAll('path,circle,ellipse,polygon,polyline,line,rect').length:0,
    isInteractive:el.matches('a,button,input,select,textarea,[role="button"],[tabindex]')};
   result.push(item);
  }
  return {truncated:false,observed:els.length,items:result,overflow:document.documentElement.scrollWidth>window.innerWidth+1};
 },limit);
 const first=await collect();await page.waitForTimeout(250);const second=await collect();
 if(first.truncated||second.truncated)warnings.push('DOM_TRUNCATED_OR_EXCEEDS_LIMIT');
 if(!first.truncated&&!second.truncated){
  const stable=x=>sha256(Buffer.from(JSON.stringify((x.items??[]).map(y=>[y.id,y.visible,y.text,
   y.box?.x,y.box?.y,y.box?.width,y.box?.height]))));
  if(stable(first)!==stable(second))warnings.push('DOM_UNSTABLE_BETWEEN_CAPTURES');
 }
 const screenshotPath=path.join(path.dirname(path.resolve(out)),'dom-discovery.png');
 await fs.mkdir(path.dirname(screenshotPath),{recursive:true});
 await page.screenshot({path:screenshotPath,fullPage:true,animations:'disabled'});
 result={schemaVersion:1,status:warnings.length||errors.length?'PARTIAL':'DOM_DISCOVERED',
  captureEnvironment:url?'REAL_APP_RUNTIME':'ISOLATED_HTML_FIXTURE',route:url||'file-fixture',viewport:{width,height},
  elements:second.items,truncated:second.truncated,observedNodes:second.observed,
  horizontalOverflow:second.overflow,errors,warnings,blockedExternalRequests,
  screenshotPath:path.basename(screenshotPath),screenshotSha256:sha256(await fs.readFile(screenshotPath)),
  warning:'DOM discovery is a browser observation, not Figma truth or pixel-perfect visual attestation.'};
 await atomicWrite(out,result);
 console.log(JSON.stringify({status:result.status,nodes:result.elements?.length,warnings,errors:errors.length}));
 if(result.status!=='DOM_DISCOVERED')process.exitCode=2;
}finally{await browser.close()}
