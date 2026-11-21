#!/usr/bin/env node
/** Quantitative & structural differences across a complete Figma/DOM inventory. */
import {cliArg,load,fileHash,atomicWrite,required,isSha} from './core.mjs';
const design=cliArg('design'),runtime=cliArg('runtime'),mappingFile=cliArg('mapping'),out=cliArg('out');
if(!design||!runtime||!mappingFile||!out)throw Error('Usage: detect.mjs --design VERIFIED_INVENTORY.json --runtime DOM_INVENTORY.json --mapping MAPPINGS.json --out DIFFERENCES.json');
const [f,d,m]=await Promise.all([load(design),load(runtime),load(mappingFile)]);
required(f.status==='VERIFIED_EVIDENCE_FILES'&&d.captureEnvironment==='REAL_APP_RUNTIME','REAL_FIGMA_AND_DOM_EVIDENCE_REQUIRED');
required(d.status==='DOM_DISCOVERED'&&!d.truncated&&!(d.warnings?.length)&&!(d.errors?.length),'UNSTABLE_OR_TRUNCATED_DOM_NOT_ACCEPTED');
const [designSha256,runtimeSha256]=await Promise.all([fileHash(design),fileHash(runtime)]);
required(m.designSha256===designSha256&&m.runtimeSha256===runtimeSha256,'MAPPING_SOURCE_HASH_MISMATCH');
const gold=new Map(f.regions.map(x=>[x.id,x])),dom=new Map(d.elements.map(x=>[x.id,x])),links=new Map(m.mappings.map(x=>[x.regionId,x]));
const issues=[],unknown=[],parentOffsets=new Map(),compared=[];
const name=(id,property)=>id+'-'+property.replace(/[^a-z0-9]+/gi,'-').toUpperCase();
const n=v=>{if(typeof v==='number')return v;const s=String(v??'').trim();return /^-?\d+(?:\.\d+)?(?:px)?$/.test(s)?Number.parseFloat(s):NaN};
const norm=v=>String(v??'').trim().replace(/\s+/g,' ').normalize('NFC');
const color=x=>{
 const s=norm(x).toLowerCase().replace(/\s/g,'');
 if(/^#[0-9a-f]{3}$/.test(s))return '#'+[...s.slice(1)].map(c=>c+c).join('');
 if(/^#[0-9a-f]{6}$/.test(s))return s;
 const m=s.match(/^rgba?\((\d{1,3}),(\d{1,3}),(\d{1,3})(?:,([\d.]+))?\)$/);
 if(m&&m.slice(1,4).every(x=>+x<=255)&&(m[4]===undefined||+m[4]===1))
  return '#'+m.slice(1,4).map(v=>(+v).toString(16).padStart(2,'0')).join('');
 return null;
};
function add(region,property,expect,actual,category,tol=0,override=null){
 if(expect===undefined||expect===null)return;
 const source=region.source;
 if(!['FIGMA_UI_MEASURED','FIGMA_UI_OBSERVED'].includes(source)){unknown.push({regionId:region.id,property,reason:'FIGMA_SOURCE_NOT_DIRECT'});return}
 if(actual===undefined||actual===null||actual===''){unknown.push({regionId:region.id,property,reason:'ACTUAL_NOT_MEASURED'});return}
 let diff,match;
 if(category==='COLOR'){match=color(expect)&&color(actual)?color(expect)===color(actual):null;diff=null}
 else if(['TEXT','ASSET','STRUCTURE'].includes(category)){match=norm(expect)===norm(actual);diff=null}
 else{
  if(!Number.isFinite(n(expect))||!Number.isFinite(n(actual))){unknown.push({regionId:region.id,property,reason:'NON_NUMERIC_VALUE'});return}
  diff=n(actual)-n(expect);match=Math.abs(diff)<=tol;
 }
 if(match===null){unknown.push({regionId:region.id,property,reason:'UNSUPPORTED_COLOR'});return}
 compared.push({regionId:region.id,property,match});
 if(match)return;
 const issue={schemaVersion:1,issueId:name(region.id,property),figmaLayer:region.path,regionId:region.id,category,
  severity:category==='STRUCTURE'&&region.required?'P0':category==='ASSET'&&region.required?'P1':'P1',status:'DETECTED',
  domSelector:links.get(region.id)?.selector??null,comparison:{property,expected:{value:expect,source},actual:{value:actual,source:'APP_RUNTIME_MEASURED'},delta:diff,tolerance:tol},
  evidence:{figmaSha256:region.evidenceSha256,runtimeSha256},impactRegionIds:[region.id],attempts:[]};
 issues.push(issue);
 if(['x','y'].includes(property)&&Number.isFinite(diff)){
  const parent=region.parentId??'root';if(!parentOffsets.has(parent))parentOffsets.set(parent,[]);
  parentOffsets.get(parent).push({regionId:region.id,axis:property,delta:diff});
 }
}
for(const region of f.regions){
 const link=links.get(region.id),el=link?.nodeId?dom.get(link.nodeId):null;
 if(!link||link.status==='STRUCTURAL_MISSING'||!el||el.visible===false){
  issues.push({schemaVersion:1,issueId:name(region.id,'missing'),category:'STRUCTURE',severity:region.required?'P0':'P2',
   status:'DETECTED',regionId:region.id,figmaLayer:region.path,domSelector:null,
   comparison:{property:'element_present',expected:{value:true,source:region.source},actual:{value:false,source:'APP_RUNTIME_MEASURED'},delta:null,tolerance:0},
   evidence:{figmaSha256:region.evidenceSha256,runtimeSha256},impactRegionIds:[region.id],attempts:[]});
  continue;
 }
 if(link.status==='AMBIGUOUS_MAPPING'){unknown.push({regionId:region.id,property:'mapping',reason:'AMBIGUOUS_MAPPING'});continue}
 const tolerances={width:1,height:1,x:1,y:1};
 for(const [p,t] of Object.entries(tolerances))add(region,p,region.box?.[p],el.box?.[p],'GEOMETRY',t);
 const styles={paddingTop:'SPACING',paddingBottom:'SPACING',paddingLeft:'SPACING',paddingRight:'SPACING',gap:'SPACING',
  fontSize:'TYPOGRAPHY',fontWeight:'TYPOGRAPHY',lineHeight:'TYPOGRAPHY',
  color:'COLOR',backgroundColor:'COLOR',borderRadius:'GEOMETRY'};
 for(const [p,cat] of Object.entries(styles)){
  if(['fontWeight'].includes(p))add(region,p,region.style?.[p],el.computed?.[p],'TYPOGRAPHY',0);
  else if(cat==='COLOR')add(region,p,region.style?.[p],el.computed?.[p],cat,0);
  else add(region,p,region.style?.[p],el.computed?.[p],cat,1);
 }
 if(region.text!==null&&region.text!==undefined)add(region,'text',region.text,el.text,'TEXT');
 if(region.assetKind&&region.assetKind!=='ORIGINAL_ASSET_UNAVAILABLE'){
  add(region,'assetKind',region.assetKind,el.assetKind,'ASSET');
 }
 if(region.style?.fontFamily)unknown.push({regionId:region.id,property:'fontFamily',reason:'CSS_FAMILY_NOT_RENDERED_GLYPH_PROOF'});
}
for(const p of f.regions){
 if(!p.parentId)continue;
 const parent=links.get(p.parentId),self=links.get(p.id);
 if(!parent||!self||parent.status!=='MATCHED_CANDIDATE'||self.status!=='MATCHED_CANDIDATE')continue;
 const actualChild=dom.get(self.nodeId),actualParent=dom.get(parent.nodeId);
 if(actualChild?.parentId!==actualParent?.id){
  issues.push({schemaVersion:1,issueId:name(p.id,'parent'),category:'STRUCTURE',severity:'P1',status:'DETECTED',regionId:p.id,
   figmaLayer:p.path,domSelector:self.selector,comparison:{property:'parent',expected:{value:p.parentId,source:p.source},actual:{value:actualChild?.parentId??null,source:'APP_RUNTIME_MEASURED'},delta:null,tolerance:0},
   evidence:{figmaSha256:p.evidenceSha256,runtimeSha256},impactRegionIds:[p.id,p.parentId],attempts:[]});
 }
}
const rootCauseCandidates=[];
for(const [parent,offsets] of parentOffsets){
 for(const axis of ['x','y']){
  const relevant=offsets.filter(x=>x.axis===axis);
  if(relevant.length<2)continue;
  const baseline=relevant[0].delta;
  const coincident=relevant.filter(x=>Math.abs(x.delta-baseline)<=1);
  if(coincident.length>=2&&Math.abs(baseline)>1)rootCauseCandidates.push({
   parentId:parent,axis,commonDelta:baseline,affectedRegionIds:coincident.map(x=>x.regionId),
   hypothesis:'SHARED_PARENT_OFFSET_CANDIDATE',confidence:'MEASURED_CORRELATION_NOT_CSS_PROOF'});
 }
}
const total=compared.length+unknown.length+issues.filter(x=>x.comparison.property==='element_present').length;
const report={schemaVersion:1,status:'ISSUES_RECORDED',designSha256,runtimeSha256,mappingSha256:await fileHash(mappingFile),
 coverage:{total,evaluable:compared.length/Math.max(1,total),measured:compared.length,notEvaluable:unknown.length},
 issues,unknown,unmappedInteractiveNodes:m.unmappedInteractiveNodes??[],rootCauseCandidates,
 criticalOpen:issues.filter(x=>x.severity==='P0').length,majorOpen:issues.filter(x=>x.severity==='P1').length,
 warning:'Only direct recorded design values are numeric truth; CSS font family and source-image pixel equivalence need separate evidence.'};
await atomicWrite(out,report);console.log(JSON.stringify({issues:issues.length,P0:report.criticalOpen,P1:report.majorOpen,coverage:report.coverage.evaluable}));
