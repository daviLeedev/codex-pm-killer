#!/usr/bin/env node
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=mkdtempSync(path.join(tmpdir(),'release-notes-test-'));
const cli=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../scripts/check-release-notes.mjs');
const versionFile=path.join(root,'VERSION'),readmeFile=path.join(root,'README.md');
function run(version,readme){
 writeFileSync(versionFile,version+'\n');writeFileSync(readmeFile,readme);
 return spawnSync(process.execPath,[cli,'--version-file',versionFile,'--readme-file',readmeFile],{encoding:'utf8'});
}
const latest=`## Version history / 패치노트
### v6.0.0 — Test
**Added**
- new functionality
**Changed**
- old behavior
**Validation**
- test passed
**Limitations**
- no live E2E
### v5.0.0 — Previous
**Added**
- earlier feature
`;
try{
 const cases=[
 ['valid',run('6.0.0',latest),true],
 ['mismatch',run('6.0.1',latest),false],
 ['missing section',run('6.0.0',latest.replace('**Validation**','**Other**')),false],
 ['empty bullet',run('6.0.0',latest.replace('- no live E2E','none')),false],
 ['duplicate',run('6.0.0',latest+'\n### v6.0.0 — duplicate\n'),false],
 ['wrong order',run('5.0.0',latest.replace('### v6.0.0','### v5.0.0').replace('### v5.0.0 — Previous','### v6.0.0 — Previous')),false]
 ];
 for(const [name,result,expect] of cases){
  const ok=result.status===0;if(ok!==expect)throw Error(name+' unexpected status '+result.status+': '+result.stdout+' '+result.stderr)
 }
 console.log('PASS release-notes-selftest: '+cases.length+' scenarios');
}finally{rmSync(root,{recursive:true,force:true})}
