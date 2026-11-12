#!/usr/bin/env node
/** Provider-neutral frozen-truth evaluator. No Figma/API/network access; does not trust model PASS. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const finite = x => typeof x === 'number' && Number.isFinite(x);
const n = x => { if (finite(x)) return x; if(typeof x==='string' && /^-?\d+(?:\.\d+)?(?:px)?$/.test(x.trim())) return Number.parseFloat(x);return NaN; };
const norm = x => String(x ?? '').trim().replace(/\s+/g,' ').normalize('NFC');
function color(x) {
 const s=String(x??'').toLowerCase().replace(/\s+/g,'');
 if(/^#[0-9a-f]{3}$/.test(s)) return '#'+[...s.slice(1)].map(c=>c+c).join('');
 if(/^#[0-9a-f]{6}$/.test(s))return s;
 const m=s.match(/^rgba?\((\d{1,3}),(\d{1,3}),(\d{1,3})(?:,([\d.]+))?\)$/);
 if(m&&m.slice(1,4).every(v=>+v<=255) && (m[4]===undefined||Number(m[4])===1))return '#'+m.slice(1,4).map(v=>Number(v).toString(16).padStart(2,'0')).join('');
 return null;
}
const flat={width:'width',height:'height',x:'x',y:'y',left:'left',top:'top',right:'right',bottom:'bottom',padding_top:'padding_top',padding_right:'padding_right',padding_bottom:'padding_bottom',padding_left:'padding_left'};
function actualValue(property, region, runtime) {
 const css=region?.computedstyle??region?.css??{};
 if(property in flat){
  const suffix=property.startsWith('padding_') ? property.replace(/_([a-z])/g,(_,c)=>c.toUpperCase()):property;
  return region?.[property]??region?.box?.[property]??css[suffix];
 }
 if(property==='gap'){
  const rects=region?.childRects;
  if(Array.isArray(region?.renderedGaps)&&region.renderedGaps.length)return region.renderedGaps;
  if(!Array.isArray(rects)||rects.length<2)return undefined;
  // Boundaries, not CSS gap. The producer must include only participating in-flow siblings.
  const axis=css.flexDirection==='row'||css.flexDirection==='row-reverse'?'x':'y';
  const rows=rects.filter(r=>r.inFlow===true&&finite(r[axis==='y'?'top':'left'])&&finite(r[axis==='y'?'bottom':'right']));
  return rows.length>=2?rows.slice(1).map((r,i)=>r[axis==='y'?'top':'left']-rows[i][axis==='y'?'bottom':'right']):undefined;
 }
 if(property==='fill'||property==='background_color')return css.backgroundColor??region?.backgroundColor;
 if(property==='color')return css.color;
 if(property==='font')return region?.actualRenderedFont??(region?.fontActualUseVerified?css.fontFamily:undefined);
 if(property==='size'||property==='font_size')return css.fontSize;
 if(property==='weight'||property==='font_weight')return css.fontWeight;
 if(property==='line_height')return css.lineHeight;
 if(property==='letter_spacing')return css.letterSpacing;
 if(property==='radius')return css.borderRadius;
 if(property==='text')return region?.text;
 if(property==='child_count')return region?.childcount??region?.childElementCount;
 if(property==='padding')return ['top','right','bottom','left'].map(k=>region?.['padding_'+k]??css['padding'+k[0].toUpperCase()+k.slice(1)]);
 if(property==='line_count')return region?.lineCount;
 if(property==='element_present')return region?.visible===true;
 if(property==='icon_present')return region?.svgPathCount>0 && region?.svgOnlyPlaceholder!==true;
 if(property==='image_loaded')return region?.imageLoaded===true && region?.imagePlaceholder!==true;
 if(property==='horizontal_overflow')return runtime?.horizontalOverflow;
 return undefined;
}
function match(property,expected,value,tolerance=0){
 if(value===undefined||value===null) return null;
 if(['fill','background_color','color'].includes(property)){const a=color(expected),b=color(value);return a&&b?a===b:null;}
 if(property==='padding') { const expectedVals=Array.isArray(expected)?expected:Array(4).fill(expected);return Array.isArray(value)&&value.length===4&&value.every((v,i)=>finite(n(v))&&finite(n(expectedVals[i]))&&Math.abs(n(v)-n(expectedVals[i]))<=tolerance); }
 if(property==='gap')return Array.isArray(value)&&value.length>0&&value.every(v=>finite(n(v))&&Math.abs(n(v)-n(expected))<=tolerance);
 if(['element_present','icon_present','image_loaded','horizontal_overflow'].includes(property))return typeof expected==='boolean'&&typeof value==='boolean' ? expected===value:null;
 if(['font','text'].includes(property))return norm(expected)===norm(value);
 if(['weight','font_weight'].includes(property)){
  const normalizeWeight=x=>({normal:'400',bold:'700'}[String(x).toLowerCase()]||String(x));
  return normalizeWeight(expected)===normalizeWeight(value);
 }
 if(['radius','size','font_size','line_height','letter_spacing','line_count','child_count',...Object.keys(flat)].includes(property)){
  const a=n(expected),b=n(value);if(finite(a)&&finite(b))return Math.abs(a-b)<=tolerance;
  if(['line_height','letter_spacing'].includes(property)&&norm(expected)===norm(value))return true;
  return null;
 }
 return null;
}
function provenanceStatus(check,layer,root,files,synthetic){
 const source=check.source??layer.source;
 if(!synthetic&&!['FIGMA_UI_OBSERVED','FIGMA_UI_MEASURED'].includes(source))return 'UNVERIFIED_FIGMA_SOURCE';
 if(synthetic&&source!=='SYNTHETIC_TEST')return 'INVALID_TEST_SOURCE';
 const ev=check.evidence??layer.evidence;
 const hash=check.evidenceSha256??layer.evidenceSha256;
 if(!ev||!hash||!(/^[a-f\d]{64}$/i.test(hash)))return 'MISSING_FIGMA_HASH';
 const full=path.resolve(root,ev);
 if(!full.startsWith(root+path.sep))return 'EVIDENCE_OUTSIDE_ROOT';
 const real=files.get(ev);
 if(!real||real!==hash.toLowerCase())return 'MISSING_OR_CHANGED_FIGMA_EVIDENCE';
 return null;
}
export async function evidenceHashes(truth,root){
 const found=new Map(),paths=new Set();
 for(const l of truth.layers??[])for(const c of l.checks??[])paths.add(c.evidence??l.evidence);
 for(const e of paths){if(typeof e!=='string'||!e)continue;const full=path.resolve(root,e);if(!full.startsWith(root+path.sep))continue;try{const real=await fs.realpath(full);if(!real.startsWith(root+path.sep))continue;found.set(e,digest(await fs.readFile(real)))}catch{}}
 return found;
}
export function evaluate(truth,runtime,{root='.',hashes=new Map(),synthetic=false,minCoverage=.95}={}){
 const rows=[],runtimeRegions=runtime.regions??[],scopeErrors=[];
 if(!Array.isArray(truth.layers)||!truth.layers.length)scopeErrors.push('NO_GOLD_ASSERTIONS');
 if(!Array.isArray(runtimeRegions))scopeErrors.push('NO_RUNTIME_REGIONS');
 if(JSON.stringify(truth.viewport)!==JSON.stringify(runtime.viewport))scopeErrors.push('VIEWPORT_MISMATCH');
 if(runtime.errors?.length||runtime.blockedExternalRequests?.length)scopeErrors.push('RUNTIME_ERRORS_OR_BLOCKED_ASSETS');
 if(truth.status!=='FROZEN_VERIFIED'&&!synthetic)scopeErrors.push('GROUND_TRUTH_NOT_VERIFIED');
 const seen=new Set();
 for(const layer of truth.layers??[]){
  const regions=runtimeRegions.filter(r=>r.id===layer.id);
  for(let ix=0;ix<(layer.checks??[]).length;ix++){
   const c=layer.checks[ix],id=c.id??`${layer.id}.${c.property}.${ix}`;
   const row={id,layer:layer.id,property:c.property,expected:c.expected,actual:null,status:'NOT_EVALUABLE',reason:null,severity:c.severity??'P1'};
   if(seen.has(id)){row.reason='DUPLICATE_ASSERTION_ID';rows.push(row);continue}seen.add(id);
   const reason=provenanceStatus(c,layer,root,hashes,synthetic);
   if(reason){row.reason=reason;rows.push(row);continue}
   if(scopeErrors.some(e=>e!=='GROUND_TRUTH_NOT_VERIFIED')){row.reason='ENVIRONMENT_PRECONDITION';rows.push(row);continue}
   if(regions.length!==1){
    // Missing elements only become proven MISMATCH when complete DOM coverage is explicitly asserted.
    row.status=runtime.coverageComplete===true&&['element_present','icon_present','image_loaded'].includes(c.property)?'MISMATCH':'NOT_EVALUABLE';
    row.reason='UNMAPPED_OR_DUPLICATE';rows.push(row);continue;
   }
   const region=regions[0];
   if(!region.visible&&c.property!=='element_present'){row.status='MISMATCH';row.reason='HIDDEN_REGION';rows.push(row);continue}
   if(['font','size','font_size','weight','font_weight','line_height','letter_spacing'].includes(c.property)&&region.requestedFontLoaded===false){row.reason='FONT_NOT_LOADED';rows.push(row);continue}
   const actual=actualValue(c.property,region,runtime);row.actual=actual??null;
   const verdict=match(c.property,c.expected,actual,c.tolerance??c.tolerance_css_px??0);
   row.status=verdict===null?'NOT_EVALUABLE':verdict?'MATCH':'MISMATCH';row.reason=verdict===null?'UNSUPPORTED_OR_NOT_OBSERVED':null;
   rows.push(row);
  }
 }
 const counts=Object.fromEntries(['MATCH','MISMATCH','NOT_EVALUABLE'].map(s=>[s,rows.filter(r=>r.status===s).length]));
 const denom=rows.length,covered=counts.MATCH+counts.MISMATCH,criticalUnknown=rows.filter(r=>r.severity==='P0'&&r.status==='NOT_EVALUABLE').length;
 const coverage=denom?covered/denom:0;
 const status=synthetic?'SYNTHETIC_ONLY':scopeErrors.length?'BLOCKED':coverage<minCoverage||criticalUnknown?'PARTIAL':counts.MISMATCH?'MISMATCH':'VERIFIED_RECORDED_SCOPE';
 return {schemaVersion:1,status,scopeErrors,counts,metrics:{frozenAssertions:denom,evaluableCoverage:coverage,observedMatchRatio:covered?counts.MATCH/covered:null,totalVerifiedRatio:denom?counts.MATCH/denom:0,criticalUnknown},checks:rows,warning:'Evidence hashes only prove file consistency, not Figma authenticity. Screenshot/pixel fidelity and actual font face require independent direct proof.'};
}
function arg(name){const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1]}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const expected=arg('--expected'),facts=arg('--actual'),out=arg('--out'),root=path.resolve(arg('--evidence-root')??process.cwd()),synthetic=arg('--synthetic')==='true';
 if(!expected||!facts||!out)throw Error('Usage: evaluate.mjs --expected truth.json --actual dom-facts.json --out report.json --evidence-root ROOT [--synthetic true]');
 if(!arg('--expected-sha256')&&!synthetic)throw Error('Production evaluation requires --expected-sha256 to freeze the gold assertions');
 const expectedBytes=await fs.readFile(expected);if(arg('--expected-sha256')&&digest(expectedBytes)!==arg('--expected-sha256'))throw Error('Frozen ground truth SHA256 does not match');
 const truth=JSON.parse(expectedBytes),runtime=JSON.parse(await fs.readFile(facts));
 const report=evaluate(truth,runtime,{root,hashes:await evidenceHashes(truth,root),synthetic});
 report.expectedSha256=digest(expectedBytes);report.actualSha256=digest(await fs.readFile(facts));
 await fs.mkdir(path.dirname(path.resolve(out)),{recursive:true});await fs.writeFile(out,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:report.status,counts:report.counts,coverage:report.metrics.evaluableCoverage}));
 if(report.status==='BLOCKED'||report.status==='PARTIAL')process.exitCode=2;
}
