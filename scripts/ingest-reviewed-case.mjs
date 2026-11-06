#!/usr/bin/env node
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2);
const i=args.indexOf('--input');if(i<0||!args[i+1]){console.error('Usage: node ingest-reviewed-case.mjs --input <explicitly-redacted-reviewed-case.json>');process.exit(2);}
const input=JSON.parse(fs.readFileSync(args[i+1],'utf8'));
if(!/^CASE-\d{4}$/.test(input.id)||input.redacted!==true||input.reviewed!==true||!input.rootCause||!input.resolution||!input.title){console.error('Invalid case: require id CASE-NNNN, reviewed=true, redacted=true, title/rootCause/resolution');process.exit(1);}
if(!['REPORTED_ONLY','SOURCE_REVIEW','REAL_APP_AND_FIGMA','REAL_APP_REPRODUCED'].includes(input.evidenceGrade)){console.error('Invalid evidenceGrade');process.exit(1);}
const safe=JSON.stringify(input);
const suspicious=/(?:https?:\/\/|(?:^|[^a-z])Bearer\s+[a-z0-9]|BEGIN (?:RSA )?PRIVATE KEY|gh[pousr]_[A-Za-z0-9]{20,})/i;
if(suspicious.test(safe)){console.error('Found possible URLs/secrets; redact before ingestion.');process.exit(1);}
const output=path.join(root,'knowledge/cases',input.id+'.json');if(fs.existsSync(output)){console.error('Case exists; review and edit manually rather than overwriting.');process.exit(1);}
fs.writeFileSync(output,JSON.stringify(input,null,2)+'\n');
console.log(JSON.stringify({status:'RECORDED_NOT_PROMOTED',path:output,note:'Human-reviewed/redacted declaration cannot be automatically verified. Update patterns and Git commit/push separately.'}));
