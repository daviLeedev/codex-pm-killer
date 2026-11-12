#!/usr/bin/env node
/** Captures actual local app runtime measurements for a frozen Figma-to-DOM mapping. Never opens Figma. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const args=process.argv.slice(2),opt=k=>{const i=args.indexOf('--'+k);return i<0?null:args[i+1]};
const url=opt('url'),mapping=opt('mapping'),out=opt('out');
if(!url||!mapping||!out)throw Error('Usage: capture-runtime.mjs --url http://localhost:5173 --mapping regions.json --out dom-facts.json [--width 375 --height 1069]');
const dest=new URL(url);if(!['localhost','127.0.0.1','[::1]'].includes(dest.hostname)||!['http:','https:'].includes(dest.protocol))throw Error('Only local app URL permitted');
const entries=JSON.parse(await fs.readFile(mapping,'utf8'));if(!Array.isArray(entries.regions)||!entries.regions.length)throw Error('Mapping requires regions [{id,selector}]');
const seen=new Set();for(const e of entries.regions){if(!e.id||typeof e.selector!=='string'||seen.has(e.id))throw Error('Invalid or duplicate mapping id');seen.add(e.id)}
const require=createRequire(path.resolve(process.cwd(),'package.json'));let chromium;
try{({chromium}=require('playwright'))}catch{({chromium}=require('@playwright/test'))}
const width=Number(opt('width')||375),height=Number(opt('height')||1069);
await fs.mkdir(path.dirname(path.resolve(out)),{recursive:true});
const browser=await chromium.launch({headless:true});const errors=[],blockedExternalRequests=[];let result;
try{
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(String(e.message)));page.on('requestfailed',r=>{const u=new URL(r.url());if(!['localhost','127.0.0.1','[::1]'].includes(u.hostname))blockedExternalRequests.push({urlOrigin:u.origin,reason:r.failure()?.errorText||'failed'})});
 await page.goto(url,{waitUntil:'domcontentloaded'});await page.evaluate(()=>document.fonts?.ready);await page.waitForTimeout(300);
 result=await page.evaluate((regions)=>{
  const r=el=>{const b=el.getBoundingClientRect();return {x:b.x,y:b.y,left:b.left,top:b.top,right:b.right,bottom:b.bottom,width:b.width,height:b.height}};
  const numericCSS=(css,name)=>Number.parseFloat(css[name])||0;
  const mapped=[];
  for(const entry of regions){
   const nodes=[...document.querySelectorAll(entry.selector)];
   if(nodes.length!==1){mapped.push({id:entry.id,visible:false,matchCount:nodes.length});continue}
   const el=nodes[0],computed=getComputedStyle(el),box=r(el);
   const childRects=[...el.children].map(child=>({ ...r(child),inFlow:!['absolute','fixed'].includes(getComputedStyle(child).position)}));
   const svg=el.matches('svg')?el:el.querySelector('svg');
   const pathCount=svg?svg.querySelectorAll('path,polygon,circle,ellipse,line,polyline').length:0;
   const imgs=el.matches('img')?[el]:[...el.querySelectorAll('img')];
   const imageLoaded=imgs.length>0&&imgs.every(x=>x.complete&&x.naturalWidth>0);
   const imagePlaceholder=imgs.some(x=>(x.getAttribute('data-placeholder')==='true'||/placeholder|fallback/i.test(x.src)));
   let lineCount;
   if(el.textContent?.trim()){
    const range=document.createRange();range.selectNodeContents(el);
    const tops=[...range.getClientRects()].filter(x=>x.width>0&&x.height>0).map(x=>Math.round(x.top*2)/2);
    lineCount=new Set(tops).size;
   }
   const keys=['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','backgroundColor','color','borderRadius','flexDirection','display','gap','position','opacity','boxShadow','borderColor'];
   const computedstyle=Object.fromEntries(keys.map(k=>[k,computed[k]]));
   for(const side of ['Top','Right','Bottom','Left'])computedstyle['padding'+side]=computed['padding'+side];
   mapped.push({id:entry.id,selector:entry.selector,...box,width:box.width,height:box.height,visible:computed.visibility!=='hidden'&&computed.display!=='none'&&box.width>0&&box.height>0,
    text:(el.textContent||'').trim().replace(/\s+/g,' '),childcount:el.children.length,computedstyle,
    padding_top:numericCSS(computed,'paddingTop'),padding_right:numericCSS(computed,'paddingRight'),padding_bottom:numericCSS(computed,'paddingBottom'),padding_left:numericCSS(computed,'paddingLeft'),
    childRects,lineCount,svgPathCount:pathCount,svgOnlyPlaceholder:svg&&pathCount===0,imageLoaded,imagePlaceholder,
    requestedFontLoaded:document.fonts.check(computed.font),actualRenderedFont:null,fontActualUseVerified:false});
  }
  return {regions:mapped,fontActualUseVerified:false,errors:[],blockedExternalRequests:[],horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1};
 },entries.regions);
 await page.screenshot({path:path.join(path.dirname(path.resolve(out)),'runtime.png'),fullPage:true,animations:'disabled'});
}finally{await browser.close()}
result.viewport={width,height};result.errors=errors;result.blockedExternalRequests=blockedExternalRequests;result.coverageComplete=result.regions.every(x=>x.matchCount===undefined||x.matchCount===1);
await fs.mkdir(path.dirname(path.resolve(out)),{recursive:true});await fs.writeFile(out,JSON.stringify(result,null,2)+'\n');
console.log('Captured local runtime: '+result.regions.length+' scoped regions; '+errors.length+' page errors');
