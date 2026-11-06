#!/usr/bin/env node
/** Capture a local app's actual rendered DOM, not Figma. Requires Playwright in app project. */
import fs from 'node:fs/promises';import path from 'node:path';import {createRequire} from 'node:module';
const argv=process.argv.slice(2),arg=(k,d)=>{const i=argv.indexOf(k);return i<0?d:argv[i+1]};
const url=arg('--url'),out=arg('--out'),width=+arg('--width',1440),height=+arg('--height',900),dpr=+arg('--deviceScaleFactor',1),limit=+arg('--limit',600),selector=arg('--selector','body'),wait=+arg('--wait',400);
if(!url||!out)throw Error('Usage: --url http://localhost:5173/ --out .design-qa/page/render [--width 1440 --height 900]');
const u=new URL(url);if(!['localhost','127.0.0.1','[::1]'].includes(u.hostname)||!['http:','https:'].includes(u.protocol))throw Error('Localhost apps only; never remote Figma URL');
const require=createRequire(path.join(process.cwd(),'package.json'));let chromium;
try{({chromium}=require('playwright'))}catch{try{({chromium}=require('@playwright/test'))}catch{throw Error('Playwright is not installed in the app workspace')}}
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,reducedMotion:'reduce'});
 const page=await context.newPage();await page.goto(url,{waitUntil:'domcontentloaded'});await page.evaluate(()=>document.fonts?.ready);await page.waitForTimeout(wait);
 await page.screenshot({path:path.join(out,'screenshot.png'),fullPage:true,animations:'disabled'});
 const capture=await page.evaluate(({selector,limit})=>{
  const root=document.querySelector(selector);if(!root)throw Error('Root selector not found: '+selector);
  const cssKeys=['display','position','flexDirection','flexWrap','alignItems','justifyContent','gap','rowGap','columnGap','paddingTop','paddingRight','paddingBottom','paddingLeft','marginTop','marginRight','marginBottom','marginLeft','width','height','minWidth','minHeight','fontFamily','fontWeight','fontSize','lineHeight','letterSpacing','color','backgroundColor','borderRadius','borderWidth','borderColor','boxShadow','opacity','overflow','boxSizing'];
  const getSelector=el=>{if(el.id)return '#'+CSS.escape(el.id);const qa=el.getAttribute('data-design-qa');if(qa)return '[data-design-qa="'+qa.replaceAll('"','\\"')+'"]';const tid=el.getAttribute('data-testid');if(tid)return '[data-testid="'+tid.replaceAll('"','\\"')+'"]';let parts=[];for(let p=el;p&&parts.length<12;p=p.parentElement){if(p.id){parts.unshift('#'+CSS.escape(p.id));break;}let siblings=p.parentElement?[...p.parentElement.children].filter(x=>x.tagName===p.tagName):[];parts.unshift(p.tagName.toLowerCase()+(siblings.length>1?':nth-of-type('+(siblings.indexOf(p)+1)+')':''))}return parts.join(' > ')};
  const all=[root,...root.querySelectorAll('*')],elements=[];let truncated=false;
  for(const el of all){if(elements.length>=limit){truncated=true;break}const r=el.getBoundingClientRect(),s=getComputedStyle(el);if(s.display==='none'||s.visibility==='hidden'||r.width<=0||r.height<=0)continue;
   const box=Object.fromEntries(['x','y','width','height','top','right','bottom','left'].map(k=>[k,+r[k].toFixed(2)]));
   const css=Object.fromEntries(cssKeys.map(k=>[k,s[k]]));
   let inlineFragments=null;if(/^(P|H[1-6]|SPAN|STRONG|U|A|BUTTON|LABEL)$/.test(el.tagName)&&(el.textContent||'').trim()){let range=document.createRange();range.selectNodeContents(el);inlineFragments=[...range.getClientRects()].filter(x=>x.width>0&&x.height>0).slice(0,80).map(x=>({left:+x.left.toFixed(2),top:+x.top.toFixed(2),right:+x.right.toFixed(2),bottom:+x.bottom.toFixed(2)}))}
   elements.push({selector:getSelector(el),tag:el.tagName.toLowerCase(),text:(el.textContent||'').trim().replace(/\s+/g,' ').slice(0,100),box,css,inlineFragments});
  }
  return {title:document.title,pageUrl:location.href,elementLimit:limit,candidateElementCount:all.length,truncated,elements};
 },{selector,limit});
 await fs.writeFile(path.join(out,'layout.json'),JSON.stringify({schemaVersion:1,capturedAt:new Date().toISOString(),viewport:{width,height,deviceScaleFactor:dpr},...capture},null,2)+'\n');
 console.log('Saved screenshot.png and layout.json, elements: '+capture.elements.length);
}finally{await browser.close()}
