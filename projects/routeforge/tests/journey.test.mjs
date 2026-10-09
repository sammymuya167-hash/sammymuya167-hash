import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
const output=path.resolve('.sites-runtime/journey-tests');mkdirSync(output,{recursive:true});
execFileSync(process.execPath,['node_modules/typescript/bin/tsc','--outDir',output,'--module','commonjs','--moduleResolution','node','--target','es2022','--esModuleInterop','--strict','--skipLibCheck','lib/journey.ts']);
writeFileSync(path.join(output,'package.json'),'{"type":"commonjs"}');
const {journeySegments}=createRequire(import.meta.url)(path.join(output,'journey.js'));
const time=Date.now(),tripId=crypto.randomUUID();
const point=(n,lat=-1.28,lng=36.82,extra={})=>({eventId:crypto.randomUUID(),tripId,kind:'point',recordedAt:time+n*1000,lat,lng,accuracy:5,...extra});
test('walking and a real turn remain a measured journey with original coordinates',()=>{
  const points=[point(0),point(5,-1.27995),point(10,-1.2799),point(15,-1.2799,36.82005)];
  assert.deepEqual(journeySegments(points),[points]);
});
test('uncertainty-sized jitter, inaccurate fixes and a provider jump do not zigzag the trail',()=>{
  const start=point(0),next=point(10,-1.2799),turn=point(20,-1.2799,36.8201);
  assert.deepEqual(journeySegments([start,point(2,-1.279999),point(4,-1.279,36.83,{accuracy:350}),next,point(12,-1.1,36.5),turn]),[[start,next,turn]]);
});
test('missing signal and separate journeys are shown as gaps without invented connecting lines',()=>{
  const a=point(0),b=point(130,-1.27),c=point(135,-1.2699),d=point(140,-1.26,36.82,{tripId:crypto.randomUUID()});
  assert.deepEqual(journeySegments([d,c,b,a]),[[a],[b,c],[d]]);
});
test('replayed or simultaneous points cannot create phantom movement and input stays intact',()=>{
  const a=point(0),b=point(5,-1.2799),input=[b,a,a,point(0,-1.27)];
  const copy=JSON.stringify(input);assert.deepEqual(journeySegments(input),[[a,b]]);assert.equal(JSON.stringify(input),copy);
});
