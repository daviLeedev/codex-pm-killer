#!/usr/bin/env node
/** Generate Codex project-scoped agent TOML from explicitly supplied model IDs. */
import fs from 'node:fs/promises';import path from 'node:path';
const a=process.argv.slice(2),arg=k=>{const i=a.indexOf('--'+k);return i<0?null:a[i+1]};
function fail(m){throw Error(m)}
function quote(s){return JSON.stringify(s)}
const mapFile=arg('model-map'),out=arg('out');if(!mapFile||!out)fail('Usage --model-map verified-models.json --out <project>/.codex/agents');
const models=JSON.parse(await fs.readFile(mapFile,'utf8'));
const defs={
 'pm-figma-inspector':{role:'figma',effort:'medium',desc:'Direct, read-only Figma viewer observation. Only one browser owner. No guesses.'},
 'pm-dom-inspector':{role:'dom',effort:'medium',desc:'Read-only real web runtime DOM measurement. Never infer Figma geometry.'},
 'pm-difference-analyst':{role:'difference',effort:'high',desc:'Compare two independent evidence sets; generate mismatch report. No code edits.'},
 'pm-ui-fixer':{role:'fixer',effort:'medium',desc:'Only source-writing role, fixes reviewed differences and runs regressions.'},
 'pm-independent-reviewer':{role:'review',effort:'medium',desc:'Fresh direct Figma inspection; different actor from initial inspector.'}
};
const instructions={
 figma:'Read references/v6-multi-agent.md. Access the current Figma viewer only with a browser lease. Record original visible Properties panel evidence, exact strings and coverage. No API, MCP, plugin, inferred pixels, source editing or borrowed snapshots. Submit the v6 evidence contract.',
 dom:'Read references/v6-multi-agent.md. Capture the actual running app via Playwright; preserve viewport/text/state and take real computed CSS and bounds. Do not read or alter Figma inventory. Submit runtime DOM evidence.',
 difference:'Read references/v6-multi-agent.md. Use only completed Figma and DOM evidence. Compare matching region hierarchy, text, geometry, padding and visual states. Mark ambiguous matches PARTIAL. Never edit implementation or invent design expectations.',
 fixer:'Read references/v6-multi-agent.md. Modify only the app code targeted by approved discrepancies, preserve routing and business logic. After edits rerun runtime capture and regressions. Never modify design expectations, verification scripts, or approval record to pass the gate.',
 review:'Read references/v6-multi-agent.md. Independently inspect Figma from its viewer as a different actor; do not use first inspector mapping as source of truth. Hold browser lease; produce new inventory, report extra/missing regions. If access unavailable, return BLOCKED rather than claim independent review.'
};
const dest=path.resolve(out);await fs.mkdir(dest,{recursive:true});
for(const [name,d] of Object.entries(defs)){
 const model=models[d.role]; if(model!==undefined&&(!/^[a-zA-Z0-9_.-]+$/.test(model)||model.length>128))fail('Invalid model ID for '+d.role);
 const lines=[`name = ${quote(name)}`,`description = ${quote(d.desc)}`,`developer_instructions = ${quote(instructions[d.role])}`];
 if(model)lines.push(`model = ${quote(model)}`);lines.push(`model_reasoning_effort = ${quote(d.effort)}`);
 // Never put a sandbox override here: it inherits from host permissions and remains bounded by them.
 await fs.writeFile(path.join(dest,name+'.toml'),lines.join('\n')+'\n');
}
console.log('Generated 5 Codex role configurations at '+dest+'; IDs supplied:'+Object.keys(models).length+' (not verified against account entitlements)');
