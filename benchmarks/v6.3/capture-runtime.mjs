#!/usr/bin/env node
/** Real local Chromium DOM capture; CDP records fonts actually used to draw glyphs. Never opens Figma. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const args=process.argv.slice(2),opt=k=>{const i=args.indexOf(k.startsWith('--')?k:'--'+k);return i<0?null:args[i+1]};
const url=opt('--url'),fixture=opt('--fixture-html'),mapping=opt('--mapping'),out=opt('--out');
if((!url&&!fixture)||(url&&fixture)||!mapping||!out)throw Error('Usage: capture-runtime.mjs (--url http://localhost:5173 | --fixture-html local.html) --mapping regions.json --out dom-facts.json');
if(url){const dest=new URL(url);if(!['localhost','127.0.0.1','[::1]'].includes(dest.hostname)||!['http:','https:'].includes(dest.protocol))throw Error('Only localhost runtime URLs permitted')}
const entries=JSON.parse(await fs.readFile(mapping,'utf8'));
if(!Array.isArray(entries.regions)||!entries.regions.length)throw Error('Mapping requires regions [{id,selector}]');
const seen=new Set();for(const e of entries.regions){if(!e.id||typeof e.selector!=='string'||seen.has(e.id))throw Error('Invalid or duplicate mapping id');seen.add(e.id)}
const require=createRequire(path.resolve(process.cwd(),'package.json'));let chromium;
try{({chromium}=require('playwright'))}catch{try{({chromium}=require('@playwright/test'))}catch{throw Error('Playwright must be installed in the target app workspace')}}
const width=Number(opt('--width')||375),height=Number(opt('--height')||1069),imageTimeout=Number(opt('--image-timeout-ms')||6500),waitMs=Number(opt('--wait-ms')||200);
if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||imageTimeout<0||waitMs<0)throw Error('Invalid viewport or wait limits');
await fs.mkdir(path.dirname(path.resolve(out)),{recursive:true});
const launchOptions={headless:true};if(opt('--browser-executable')||process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)launchOptions.executablePath=opt('--browser-executable')||process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const browser=await chromium.launch(launchOptions);const errors=[],blockedExternalRequests=[],captureWarnings=[];let result;
try{
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(String(e.message)));
 page.on('requestfailed',r=>{try{const u=new URL(r.url());if(!['localhost','127.0.0.1','[::1]'].includes(u.hostname))blockedExternalRequests.push({urlOrigin:u.origin,reason:r.failure()?.errorText||'failed'})}catch{}});
 if(fixture)await page.setContent(await fs.readFile(fixture,'utf8'),{waitUntil:'domcontentloaded'});else await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>document.fonts?.ready);
 try{await page.waitForFunction(()=>[...document.images].every(img=>img.complete),undefined,{timeout:imageTimeout})}catch{captureWarnings.push('IMAGE_LOAD_TIMEOUT')}
 await page.waitForTimeout(waitMs);
 const capture=async()=>page.evaluate((regions)=>{
  const rect=el=>{const b=el.getBoundingClientRect();return {x:b.x,y:b.y,left:b.left,top:b.top,right:b.right,bottom:b.bottom,width:b.width,height:b.height}};
  const numericCSS=(css,name)=>{const n=Number.parseFloat(css[name]);return Number.isFinite(n)?n:0};
  const mapped=[];
  for(const entry of regions){
   const nodes=[...document.querySelectorAll(entry.selector)];
   if(nodes.length!==1){mapped.push({id:entry.id,visible:false,matchCount:nodes.length,required:entry.required!==false});continue}
   const el=nodes[0],computed=getComputedStyle(el),box=rect(el);
   const childRects=[...el.children].map(child=>{const cs=getComputedStyle(child);return {...rect(child),inFlow:!['absolute','fixed'].includes(cs.position)&&cs.display!=='none',display:cs.display}});
   const svgs=el.matches('svg')?[el]:[...el.querySelectorAll('svg')];
   const pathCount=svgs.reduce((n,svg)=>n+svg.querySelectorAll('path,polygon,circle,ellipse,line,polyline').length,0);
   const imgs=el.matches('img')?[el]:[...el.querySelectorAll('img')];
   const images=imgs.map(i=>({loaded:i.complete&&i.naturalWidth>0,complete:i.complete,naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight,assetId:i.dataset.benchmarkAssetId||null,src:i.currentSrc||i.src,alt:i.alt||null}));
   const imageLoaded=imgs.length?images.every(i=>i.loaded):null;
   const imagePlaceholder=imgs.some(i=>i.dataset.placeholder==='true'||/placeholder|fallback/i.test(i.currentSrc||i.src));
   const sources=images.map(i=>i.src);
   const raster=sources.some(src=>/\.(?:png|jpe?g|webp|avif)(?:[?#]|$)/i.test(src)||/^data:image\/(?:png|jpe?g|webp|avif);/i.test(src));
   const cssBg=computed.backgroundImage||'',bgRaster=/\.(?:png|jpe?g|webp|avif)(?:[?#]|$)/i.test(cssBg);
   const assetKind=imagePlaceholder?'placeholder':raster||bgRaster?'raster_photo':(svgs.length?'vector':imgs.length?'other_image':'none');
   const declaredAssetIds=[...new Set([el.dataset.benchmarkAssetId,...images.map(i=>i.assetId)].filter(Boolean))];
   const assetPackId=declaredAssetIds.length===1?declaredAssetIds[0]:null;
   const isInput=el.matches('input,textarea'),inputValue=isInput?(el.value||''):null;
   const placeholderText=isInput?(el.placeholder||''):null;
   const placeholderColor=isInput&&placeholderText?getComputedStyle(el,'::placeholder').color:null;
   const displayedText=isInput?(inputValue||placeholderText):el.textContent||'';
   let lineCount;
   if(el.textContent?.trim()){
    const range=document.createRange();range.selectNodeContents(el);
    const tops=[...range.getClientRects()].filter(x=>x.width>0&&x.height>0).map(x=>Math.round(x.top*2)/2);
    lineCount=new Set(tops).size;
   }
   const keys=['gridTemplateColumns','gridTemplateRows','flexWrap','fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','backgroundColor','color','borderRadius','flexDirection','display','gap','position','opacity','boxShadow','borderColor','objectFit','overflow'];
   const computedstyle=Object.fromEntries(keys.map(k=>[k,computed[k]]));
   for(const side of ['Top','Right','Bottom','Left'])computedstyle['padding'+side]=computed['padding'+side];
   mapped.push({id:entry.id,selector:entry.selector,role:entry.role||null,required:entry.required!==false,...box,width:box.width,height:box.height,matchCount:nodes.length,
    visible:computed.visibility!=='hidden'&&computed.display!=='none'&&box.width>0&&box.height>0,
    text:(displayedText||'').trim().replace(/\s+/g,' '),isInput,placeholderVisible:!!(isInput&&!inputValue&&placeholderText),inputValue,placeholderText,placeholderColor,
    assetKind,assetPackId,declaredAssetIds,images,childcount:el.children.length,computedstyle,
    padding_top:numericCSS(computed,'paddingTop'),padding_right:numericCSS(computed,'paddingRight'),padding_bottom:numericCSS(computed,'paddingBottom'),padding_left:numericCSS(computed,'paddingLeft'),
    childRects,lineCount,svgPathCount:pathCount,svgOnlyPlaceholder:svgs.length>0&&pathCount===0,imageLoaded,imagePlaceholder,
    requestedFontLoaded:document.fonts.check(computed.font),actualRenderedFont:null,fontActualUseVerified:false,fontEvidence:{source:'UNAVAILABLE',status:'UNVERIFIED',faces:[]}});
  }
  return {regions:mapped,horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1};
 },entries.regions);
 result=await capture();
 if(args.includes('--assert-stable')){
  await page.waitForTimeout(300);
  const second=await capture();
  const comparable=r=>JSON.stringify({regions:r.regions.map(v=>({id:v.id,visible:v.visible,box:[v.x,v.y,v.width,v.height],text:v.text,childRects:v.childRects,assetKind:v.assetKind,images:v.images?.map(x=>({loaded:x.loaded,naturalWidth:x.naturalWidth,naturalHeight:x.naturalHeight}))})),horizontalOverflow:r.horizontalOverflow});
  if(comparable(second)!==comparable(result))captureWarnings.push('UNSTABLE_RUNTIME_SNAPSHOT');
 }
 try{
  const cdp=await context.newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');
  const {root}=await cdp.send('DOM.getDocument');
  for(const reg of result.regions){
   if(reg.matchCount!==1)continue;
   try{
    const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector:reg.selector});if(!nodeId)continue;
    const response=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});
    const faces=(response.fonts||[]).filter(f=>f.glyphCount>0).map(f=>({familyName:f.familyName,postScriptName:f.postScriptName,isCustomFont:f.isCustomFont,glyphCount:f.glyphCount}));
    const distinct=[...new Set(faces.map(f=>f.familyName).filter(Boolean))];
    const confirmed=distinct.length===1;
    reg.fontEvidence={source:'CDP_PLATFORM_FONTS',status:confirmed?'CONFIRMED_SINGLE_FACE':faces.length?'MIXED_FACES':'NO_TEXT_GLYPHS',faces};
    reg.actualRenderedFont=confirmed?distinct[0]:null;
    reg.fontActualUseVerified=confirmed;
   }catch(err){reg.fontEvidence={source:'CDP_PLATFORM_FONTS',status:'UNAVAILABLE',faces:[],reason:String(err.message).slice(0,220)}}
  }
 }catch(err){captureWarnings.push('FONT_CDP_UNAVAILABLE: '+String(err.message).slice(0,160))}
 await page.screenshot({path:path.join(path.dirname(path.resolve(out)),'runtime.png'),fullPage:true,animations:'disabled'});
}finally{await browser.close()}
result.captureEnvironment=fixture?'ISOLATED_HTML_FIXTURE':'REAL_APP_RUNTIME';result.viewport={width,height};result.errors=errors;result.blockedExternalRequests=blockedExternalRequests;result.captureWarnings=captureWarnings;
result.coverageComplete=result.regions.every(x=>x.matchCount===1)&&!captureWarnings.length;
await fs.mkdir(path.dirname(path.resolve(out)),{recursive:true});await fs.writeFile(out,JSON.stringify(result,null,2)+'\n');
console.log('Captured local runtime: '+result.regions.length+' scoped regions; '+errors.length+' page errors; '+captureWarnings.length+' warnings');
