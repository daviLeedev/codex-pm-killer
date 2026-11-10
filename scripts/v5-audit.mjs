#!/usr/bin/env node
/** Codex PM Killer v5: evidence-bound inventory, candidate mapping, box-model audit, independent review, fail-closed gate.
 * No Figma API, MCP or plugin. Figma inventory must be collected from the visible viewer UI by the agent.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const args = process.argv.slice(2);
const command = args.shift();
const options = {};
for(let i=0;i<args.length;i+=2){
 if(!args[i]?.startsWith('--')||!args[i+1])throw Error('Expected --key value pairs');
 options[args[i].slice(2)]=args[i+1];
}
const required = key => { if(!options[key])throw Error('Missing --'+key); return options[key]; };
const read = p => fs.readFile(p,'utf8').then(JSON.parse);
const write = async(p,obj)=>{await fs.mkdir(path.dirname(path.resolve(p)),{recursive:true});await fs.writeFile(p,JSON.stringify(obj,null,2)+'\n');};
const normalize = s=>String(s??'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
const number=v=>typeof v==='number'?v:typeof v==='string'&&/^-?\d+(?:\.\d+)?(?:px)?$/.test(v.trim())?Number.parseFloat(v):NaN;
const validBox = b => b && ['left','right','top','bottom','width','height'].every(k=>Number.isFinite(Number(b[k])));
const verifiedSource = s=>['FIGMA_UI_OBSERVED','FIGMA_UI_MEASURED'].includes(s);
const round = n=>Number(n.toFixed(3));
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const fail = (reason,extra={})=>({status:'FAIL',reason,...extra});

async function evidence(file,rel){
 if(typeof rel!=='string'||!rel.trim())return false;
 const base=path.dirname(path.resolve(file)),abs=path.resolve(base,rel);
 if(!abs.startsWith(base+path.sep))return false;
 try {return (await fs.stat(abs)).isFile()&&(await fs.stat(abs)).size>0;}catch{return false;}
}
function figmaValid(figma,file){
 const problems=[];
 if(figma.schemaVersion!==5||figma.kind!=='FIGMA')problems.push('Figma inventory schema/kind invalid');
 if(!Array.isArray(figma.items)||!figma.items.length)problems.push('Figma inventory empty');
 if(figma.coverage?.status!=='COMPLETE')problems.push('Figma traversal not COMPLETE');
 if(!Array.isArray(figma.coverage?.expandedBranches)||!figma.coverage.expandedBranches.length)problems.push('Expanded Figma layer branches not documented');
 if(!figma.scope?.frame||!figma.scope?.viewport)problems.push('Frame/viewport missing');
 const ids=new Set();
 for(const el of figma.items||[]){
  if(!el.id||ids.has(el.id))problems.push('Duplicate/missing Figma item id: '+el.id);
  ids.add(el.id);
  if(!el.path)problems.push('Missing Figma layer path: '+el.id);
  if(!verifiedSource(el.source))problems.push('Figma item not directly observed: '+el.id);
  if(!el.evidence)problems.push('Missing Figma evidence reference: '+el.id);
 }
 for(const el of figma.items||[])if(el.parentId&&!ids.has(el.parentId))problems.push('Missing Figma parent '+el.parentId);
 return problems;
}
function domValid(dom){
 const problems=[];
 if(dom.schemaVersion!==5||dom.kind!=='DOM')problems.push('DOM inventory schema/kind invalid');
 if(!Array.isArray(dom.items)||!dom.items.length)problems.push('DOM inventory empty');
 if(dom.coverage?.status!=='COMPLETE')problems.push('DOM capture incomplete or truncated');
 const ids=new Set();
 for(const el of dom.items||[]){if(!el.id||ids.has(el.id))problems.push('Duplicate/missing DOM id '+el.id);ids.add(el.id);if(!validBox(el.box))problems.push('Invalid DOM box '+el.id);}
 return problems;
}
function scorePair(f,d){
 let score=0;const why=[];
 if(f.role&&d.role&&normalize(f.role)===normalize(d.role)){score+=35;why.push('role');}
 const ft=normalize(f.text),dt=normalize(d.text);
 if(ft&&dt&&ft===dt){score+=45;why.push('exact-text');}
 else if(ft.length>3&&dt.length>3&&(ft.includes(dt)||dt.includes(ft))){score+=20;why.push('partial-text');}
 const fa=normalize(f.name||f.path?.split('/').at(-1)),da=normalize(d.name||d.selector||d.tag);
 if(fa&&da&&(da.includes(fa)||fa.includes(da))){score+=10;why.push('name');}
 if(f.expectedBox?.width!==undefined&&Number.isFinite(number(f.expectedBox.width))&&Number.isFinite(number(d.box?.width))){
  if(Math.abs(number(f.expectedBox.width)-number(d.box.width))<=2){score+=10;why.push('width');}
 }
 return {score,why};
}

async function makeDomInventory(){
 const src=await read(required('snapshot'));
 if(!Array.isArray(src.elements))throw Error('Invalid layout.json: elements missing');
 const ids=new Set(),items=[];
 for(let i=0;i<src.elements.length;i++){
  const e=src.elements[i]; if(!e.selector||!validBox(e.box))continue;
  const id='DOM-'+String(i+1).padStart(5,'0');if(ids.has(e.selector))throw Error('Ambiguous repeated selector '+e.selector);
  ids.add(e.selector);
  const role=e.role||({button:'button',input:'input',a:'link',h1:'heading',h2:'heading',h3:'heading',p:'paragraph',img:'image',svg:'icon'}[e.tag]||'container');
  items.push({id,selector:e.selector,role,text:e.text||'',name:e.tag||'',tag:e.tag||'',box:e.box,css:e.css||{},inlineFragments:e.inlineFragments||null});
 }
 const complete=!src.truncated&&src.candidateElementCount<=src.elementLimit;
 const obj={schemaVersion:5,kind:'DOM',scope:{route:src.pageUrl,viewport:src.viewport},capture:{from:required('snapshot'),capturedAt:src.capturedAt||null,sha256:sha(JSON.stringify(src)),elementCount:src.candidateElementCount,capturedCount:items.length},coverage:{status:complete?'COMPLETE':'PARTIAL',reason:complete?null:'Source snapshot truncated; recapture by section or increase --limit'},items};
 await write(required('out'),obj);console.log(`DOM INVENTORY: ${obj.coverage.status} (${items.length} items)`);if(!complete)process.exitCode=2;
}

async function mapRegions(){
 const figmaFile=required('figma'),domFile=required('dom');
 const [f,d]=await Promise.all([read(figmaFile),read(domFile)]);
 const problems=[...figmaValid(f,figmaFile),...domValid(d)];
 for(const e of f.items||[])if(!(await evidence(figmaFile,e.evidence)))problems.push('Figma evidence file missing/empty: '+e.id);
 const candidates=[];
 for(const e of f.items||[]){
  const matches=(d.items||[]).map(item=>({domId:item.id,selector:item.selector,...scorePair(e,item)})).filter(x=>x.score>=30).sort((a,b)=>b.score-a.score).slice(0,5);
  candidates.push({figmaId:e.id,figmaPath:e.path,reviewStatus:'REVIEW_REQUIRED',suggestions:matches});
 }
 const approved=options.approved?await read(options.approved):{pairs:[]};
 const pairs=[],mappedDom=new Set(),mappedFigma=new Set();
 for(const p of approved.pairs||[]){
  const fi=f.items?.find(x=>x.id===p.figmaId),di=d.items?.find(x=>x.id===p.domId);
  if(!fi||!di){problems.push('Approved mapping references nonexistent element '+p.figmaId+' / '+p.domId);continue;}
  if(mappedFigma.has(p.figmaId)||mappedDom.has(p.domId)){problems.push('Duplicate approved mapping '+p.figmaId+'/'+p.domId);continue;}
  if(p.reviewStatus!=='APPROVED'||p.reviewSource!=='REAL_FIGMA_AND_APP'||!p.reviewer||!p.evidence){problems.push('Mapping not directly reviewed '+p.figmaId);continue;}
  if(!await evidence(options.approved,p.evidence)){problems.push('Mapping approval evidence missing '+p.figmaId);continue;}
  mappedFigma.add(p.figmaId);mappedDom.add(p.domId);pairs.push({...p,figmaPath:fi.path,domSelector:di.selector});
 }
 const unmatchedFigma=f.items.filter(x=>!mappedFigma.has(x.id)).map(x=>x.id);
 // DOM may contain many layout wrappers: do not treat every unpaired DOM as a design defect.
 const unmatchedDOM=d.items.filter(x=>!mappedDom.has(x.id)&&['button','input','link','heading','image','icon'].includes(x.role)).map(x=>x.id);
 const status=problems.length||unmatchedFigma.length||unmatchedDOM.length?'PARTIAL':'REVIEWED_SCOPE';
 const out={schemaVersion:5,status,figmaFile,domFile,problems,candidates,pairs,unmatchedFigma,unmatchedDOM,warning:'Automated matches are suggestions only. Cannot prove undiscovered Figma layers do not exist.'};
 await write(required('out'),out);console.log(`MAPPING: ${status} approved=${pairs.length} unmatchedFigma=${unmatchedFigma.length} interactiveDOM=${unmatchedDOM.length}`);
 if(status!=='REVIEWED_SCOPE')process.exitCode=2;
}

function cssBox(d){
 const c=d.css||{},b=d.box;
 const p=Object.fromEntries(['Top','Right','Bottom','Left'].map(k=>[k,number(c['padding'+k])]));
 const border=Object.fromEntries(['Top','Right','Bottom','Left'].map(k=>[k,number(c['border'+k+'Width']??c.borderWidth)]));
 if(Object.values({...p,...border}).some(v=>!Number.isFinite(v)))return null;
 return {contentWidth:round(b.width-p.Left-p.Right-border.Left-border.Right),contentHeight:round(b.height-p.Top-p.Bottom-border.Top-border.Bottom),paddingTop:p.Top,paddingRight:p.Right,paddingBottom:p.Bottom,paddingLeft:p.Left};
}
async function geometry(){
 const fPath=required('figma'),dPath=required('dom'),mPath=required('mapping');
 const [f,d,m]=await Promise.all([read(fPath),read(dPath),read(mPath)]);
 const problems=[...figmaValid(f,fPath),...domValid(d)];
 for(const item of f.items||[])if(!await evidence(fPath,item.evidence))problems.push('Figma item evidence missing: '+item.id);
 if(m.status!=='REVIEWED_SCOPE')problems.push('Mapping is not fully reviewed');
 const checks=[],geom=new Map();
 for(const pair of m.pairs||[]){
  const fi=f.items.find(x=>x.id===pair.figmaId),di=d.items.find(x=>x.id===pair.domId);
  if(!fi||!di){checks.push({status:'FAIL',reason:'Element missing',pair});continue;}
  geom.set(fi.id,di.box);
  const cb=cssBox(di);
  let propCount=0;
  for(const [key,expected] of Object.entries({...fi.expectedBox,...fi.expectedCss,...fi.expectedContent})){
   propCount++;
   const actual=key in di.box?di.box[key]:key in (cb||{})?cb[key]:di.css?.[key];
   const tol=fi.tolerancePx??1,ex=number(expected),ac=number(actual);
   const numeric=Number.isFinite(ex)&&Number.isFinite(ac);
   const delta=numeric?round(ac-ex):null;
   const pass=verifiedSource(fi.source)&&actual!==undefined&&(numeric?Math.abs(delta)<=tol:normalize(actual)===normalize(expected));
   checks.push({type:'property',id:fi.id,field:key,status:pass?'PASS':'FAIL',expected,actual:actual??null,delta,tolerance:tol,reason:pass?null:(!verifiedSource(fi.source)?'No direct Figma observation':'Rendered property mismatch/unavailable')});
  }
  if(propCount===0)checks.push(fail('No directly observed property assertions',{id:fi.id,type:'coverage'}));
 }
 for(const r of f.relations||[]){
  const a=geom.get(r.from),b=geom.get(r.to);
  if(!a||!b||!verifiedSource(r.source)||!await evidence(fPath,r.evidence)||!['left','right','top','bottom'].includes(r.fromEdge)||!['left','right','top','bottom'].includes(r.toEdge)||!Number.isFinite(number(r.expectedPx))){
   checks.push({type:'relation',id:r.id||r.from+'->'+r.to,...fail('Unmapped relation, missing evidence, invalid edge or value')});continue;
  }
  const got=round(number(b[r.toEdge])-number(a[r.fromEdge])),delta=round(got-number(r.expectedPx)),tol=r.tolerancePx??1;
  checks.push({type:'relation',id:r.id||r.from+'->'+r.to,status:Math.abs(delta)<=tol?'PASS':'FAIL',expected:r.expectedPx,actual:got,delta,tolerance:tol});
 }
 if(!(f.relations||[]).length)problems.push('No Figma spatial relations tested');
 const status=problems.length||checks.some(c=>c.status!=='PASS')?'PARTIAL':'VERIFIED_RECORDED_PROPERTIES';
 const result={schemaVersion:5,status,problems,checks,counts:{pass:checks.filter(x=>x.status==='PASS').length,fail:checks.filter(x=>x.status==='FAIL').length},warning:'Figma source values are agent observed, not independently authenticated by this script.'};
 await write(required('out'),result);console.log(`GEOMETRY: ${status} PASS ${result.counts.pass} FAIL ${result.counts.fail}`);if(status!=='VERIFIED_RECORDED_PROPERTIES')process.exitCode=2;
}

async function compareIndependent(){
 const a=await read(required('first')),b=await read(required('second'));
 const problems=[];
 for(const v of [a,b]){
  if(v.schemaVersion!==5||v.review?.figmaAccess!=='DIRECT_VIEWER_UI'||v.review?.status!=='COMPLETE')problems.push('Reviewer lacks direct viewer access/complete review');
  if(!Array.isArray(v.items)||!v.items.length)problems.push('Empty independent inventory');
  if(!v.review?.evidence||!await evidence(v===a?options.first:options.second,v.review.evidence))problems.push('Missing review evidence');
 }
 if(a.review?.reviewerId===b.review?.reviewerId)problems.push('Same reviewer; second sweep cannot be certified independent');
 if(a.scope?.frame!==b.scope?.frame||JSON.stringify(a.scope?.viewport)!==JSON.stringify(b.scope?.viewport))problems.push('Different frame or viewport');
 const first=new Set((a.items||[]).map(x=>x.id)),second=new Set((b.items||[]).map(x=>x.id));
 const onlyFirst=[...first].filter(x=>!second.has(x)),onlySecond=[...second].filter(x=>!first.has(x));
 const status=problems.length||onlyFirst.length||onlySecond.length?'PARTIAL':'INDEPENDENT_AGREEMENT';
 const result={schemaVersion:5,status,problems,onlyFirst,onlySecond,warning:'Two independent viewer observations reduce but do not eliminate undiscovered omissions.'};
 await write(required('out'),result);console.log(`INDEPENDENCE: ${status} differences=${onlyFirst.length+onlySecond.length}`);if(status!=='INDEPENDENT_AGREEMENT')process.exitCode=2;
}

async function gate(){
 const mapping=await read(required('mapping')),geometryReport=await read(required('geometry')),independence=await read(required('independent'));
 const errors=[];
 if(mapping.status!=='REVIEWED_SCOPE'||mapping.unmatchedFigma?.length||mapping.unmatchedDOM?.length||mapping.problems?.length)errors.push('Mapping coverage is incomplete');
 if(geometryReport.status!=='VERIFIED_RECORDED_PROPERTIES'||!geometryReport.checks?.length||geometryReport.checks.some(x=>x.status!=='PASS'))errors.push('Measured properties/relations did not all pass');
 if(options.v4){const v4=await read(options.v4);if(v4.status!=='VERIFIED_RECORDED_SCOPE'||v4.errors?.length)errors.push('v4 detail-audit gate is not verified');}
 if(independence.status!=='INDEPENDENT_AGREEMENT'||independence.onlyFirst?.length||independence.onlySecond?.length)errors.push('Independent Figma review is not proven');
 const status=errors.length?'PARTIAL':'VERIFIED_RECORDED_SCOPE';
 const report={schemaVersion:5,status,errors,warning:'A PASS proves checks over submitted evidence only, not absolute pixel fidelity or complete Figma coverage.'};
 await write(required('out'),report);console.log('V5 GATE: '+status+(errors.length?' — '+errors.join('; '):''));if(errors.length)process.exitCode=2;
}

try{
 const actions={inventory:makeDomInventory,match:mapRegions,geometry,independent:compareIndependent,gate};
 if(!actions[command])throw Error('Usage: node scripts/v5-audit.mjs inventory|match|geometry|independent|gate [--arg value]');
 await actions[command]();
}catch(e){console.error('V5 AUDIT ERROR: '+e.message);process.exitCode=1;}
