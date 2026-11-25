#!/usr/bin/env node
/** Browser-only anonymous Figma Community UI probe. No Figma API/MCP/plugin, no login, no secrets. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(path.resolve(process.cwd(),'package.json'));
const {chromium}=require('playwright');
const url='https://www.figma.com/community/file/981543186947734892';
const output=path.resolve(process.env.FIDELITY_PILOT_REPORT_DIR||'fidelity-cloud-pilot-results','figma-viewer-probe.json');
const result={schemaVersion:1,probe:'PUBLIC_ANONYMOUS_READONLY_FIGMA_VIEWER',status:'NOT_RUN',urlHost:'www.figma.com',
  authenticated:false,actualLayersPanelVisible:false,actualPropertiesPanelVisible:false,canvasFound:false,serviceCalls:{figmaApi:0,figmaMcp:0,figmaPlugin:0},
  cannotReplaceAuthenticatedDirectFigmaObservation:true};
let browser;
try{
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:1});
 const page=await context.newPage();
 let response=null;
 try{response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:20000})}
 catch(e){result.navigationError=String(e.message).slice(0,280)}
 result.httpStatus=response?.status()??null;
 await page.waitForTimeout(2500);
 result.title=(await page.title().catch(()=>'' )).slice(0,130);
 result.canvasFound=(await page.locator('canvas').count().catch(()=>0))>0;
 result.actualLayersPanelVisible=(await page.getByText('Layers',{exact:true}).count().catch(()=>0))>0;
 result.actualPropertiesPanelVisible=(await page.getByText('Properties',{exact:true}).count().catch(()=>0))>0;
 const text=(await page.locator('body').innerText({timeout:6000}).catch(()=>'' )).slice(0,15000);
 result.signInPromptLikely=/sign in|log in|로그인|create a free account/i.test(text);
 result.status=result.actualLayersPanelVisible&&result.actualPropertiesPanelVisible&&result.canvasFound&&!result.signInPromptLikely?
  'PUBLIC_VIEWER_READY_CANDIDATE_NEEDS_AUTH_VALIDATION':
  result.httpStatus?'DESIGN_PROPERTIES_NOT_AVAILABLE_ANONYMOUSLY':'VIEWER_NAVIGATION_BLOCKED';
}catch(e){result.status='VIEWER_PROBE_ERROR';result.error=String(e.message).slice(0,280)}
finally{if(browser)await browser.close()}
await fs.mkdir(path.dirname(output),{recursive:true});
await fs.writeFile(output,JSON.stringify(result,null,2)+'\n');
console.log('FIGMA_VIEWER_PROBE '+JSON.stringify(result));
