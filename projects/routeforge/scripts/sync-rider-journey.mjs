import {readFileSync,writeFileSync} from 'node:fs';
import ts from 'typescript';
const file='android-driver/app/src/main/assets/rider.html';
const code=ts.transpileModule(readFileSync('lib/journey.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/^export /gm,'');
const begin='// BEGIN SHARED JOURNEY FILTER',end='// END SHARED JOURNEY FILTER';
const html=readFileSync(file,'utf8');
const result=html.includes(begin)?html.replace(new RegExp(begin+'[\\s\\S]*?'+end),begin+'\n'+code+end):html.replace(/function journeySegments\(points\)\{[^\n]*\}\n/,begin+'\n'+code+end+'\n');
if(result===html&&!html.includes(begin))throw Error('Journey filter insertion point is missing.');
if(process.argv.includes('--check')){if(result!==html)throw Error('Native journey filter differs from the office filter. Run node scripts/sync-rider-journey.mjs.');}
else writeFileSync(file,result);
