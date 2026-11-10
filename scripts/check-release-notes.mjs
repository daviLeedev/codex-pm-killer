#!/usr/bin/env node
// Verify the published VERSION matches the latest README release note.
// This checks documentation, not runtime behavior or merge completeness.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
function option(name,fallback){const i=args.indexOf('--'+name);return i<0?fallback:args[i+1]}
function fail(message){console.error('Release notes FAIL: '+message);process.exit(1)}
const versionFile=option('version-file',path.join(base,'VERSION'));
const readmeFile=option('readme-file',path.join(base,'README.md'));
if(!versionFile||!readmeFile)fail('Missing file path');
const version=fs.readFileSync(versionFile,'utf8').trim();
const readme=fs.readFileSync(readmeFile,'utf8');
if(!/^\d+\.\d+\.\d+$/.test(version))fail('VERSION must use MAJOR.MINOR.PATCH');
const marker='## Version history / 패치노트';
const start=readme.indexOf(marker);
if(start<0)fail('README has no version history section');
const remainder=readme.slice(start+marker.length);
const nextSection=remainder.search(/^## /m);
const history=nextSection<0?remainder:remainder.slice(0,nextSection);
const matches=[...history.matchAll(/^### v(\d+\.\d+\.\d+)\b[^\n]*$/gm)];
if(!matches.length)fail('No version entries found');
if(matches[0][1]!==version)fail('Latest README version v'+matches[0][1]+' differs from VERSION '+version);
const seen=new Set();
function numberParts(s){return s.split('.').map(Number)}
function newer(a,b){const x=numberParts(a),y=numberParts(b);for(let k=0;k<3;k++){if(x[k]!==y[k])return x[k]>y[k]}return false}
for(let i=0;i<matches.length;i++){
 const v=matches[i][1];
 if(seen.has(v))fail('Duplicate release note v'+v);
 seen.add(v);
 if(i>0&&!newer(matches[i-1][1],v))fail('Release notes must be newest-first');
}
const top=history.slice(matches[0].index,matches.length>1?matches[1].index:undefined);
for(const label of ['Added','Changed','Validation','Limitations']){
 const flag='**'+label+'**';
 const index=top.indexOf(flag);
 if(index<0)fail('Latest note missing '+label);
 const tail=top.slice(index+flag.length).split(/\n\*\*(?:Added|Changed|Validation|Limitations)\*\*/)[0];
 if(!tail.split('\n').some(s=>s.trim().startsWith('- ')))fail(label+' needs at least one bullet');
}
console.log('PASS README release notes: v'+version+' ('+matches.length+' versions)');
