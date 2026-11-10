#!/usr/bin/env node
import fs from 'node:fs';
const a=process.argv.slice(2),i=a.indexOf('--config');
if(i<0||!a[i+1]){console.error('Usage: node scripts/host-preflight.mjs --config <observed-capabilities.json>');process.exit(1)}
const doc=JSON.parse(fs.readFileSync(a[i+1],'utf8'));
if(doc.schemaVersion!==1||!doc.capabilities||typeof doc.capabilities!=='object')throw Error('Invalid host capabilities schema');
const c=doc.capabilities;
const keys=['filesystemRead','filesystemWrite','nodeProcess','terminal','appRuntimeBrowser','figmaViewerDirect','figmaViewerAuthenticated','subagents','secondDirectFigmaReviewer'];
for(const k of keys)if(typeof c[k]!=='boolean')throw Error('Invalid or missing boolean capability '+k);
const blockers=[],notes=[];
const need=(yes,code,message)=>{if(!yes)blockers.push({code,message})};
need(c.filesystemRead&&c.filesystemWrite&&c.nodeProcess&&c.terminal,'NO_EXECUTION','Cannot edit the app and run portable QA scripts without local workspace and Node shell access');
need(c.appRuntimeBrowser,'NO_RUNTIME_BROWSER','Cannot verify actual rendered app DOM without runtime browser access');
need(c.figmaViewerDirect&&c.figmaViewerAuthenticated,'FIGMA_ACCESS_BLOCKED','No confirmed authenticated, controllable Figma layer/Properties viewer');
if(!c.subagents)notes.push('Subagents unavailable: execute stages sequentially and do not claim multi-agent execution');
if(!c.secondDirectFigmaReviewer)notes.push('Independent live Figma reviewer unavailable: complete independent check stays PARTIAL');
const stages={main:true,figma:c.figmaViewerDirect&&c.figmaViewerAuthenticated,dom:c.appRuntimeBrowser&&c.nodeProcess,difference:c.filesystemRead&&c.nodeProcess,fixer:c.filesystemWrite&&c.terminal,review:c.secondDirectFigmaReviewer&&c.figmaViewerDirect&&c.figmaViewerAuthenticated,gate:c.nodeProcess};
const status=blockers.some(x=>x.code==='NO_EXECUTION')?'BLOCKED':blockers.length||!stages.review?'PARTIAL':'READY_REPORTED_CAPABILITIES';
const result={schemaVersion:1,host:doc.host||'unspecified',status,stages,parallelFigmaAndDom:c.subagents&&stages.figma&&stages.dom,blockers,notes,warning:'Capabilities were self-reported and not proven by this script. It does not launch agents, read Figma, or validate actual login.'};
console.log(JSON.stringify(result,null,2));
if(status!=='READY_REPORTED_CAPABILITIES')process.exitCode=2;
