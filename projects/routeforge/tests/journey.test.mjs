import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const output=path.resolve('.sites-runtime/journey-tests');mkdirSync(output,{recursive:true});
execFileSync(process.execPath,['node_modules/typescript/bin/tsc','--outDir',output,'--module','commonjs','--moduleResolution','node','--target','es2022','--esModuleInterop','--strict','--skipLibCheck','lib/journey.ts']);
writeFileSync(path.join(output,'package.json'),'{"type":"commonjs"}');
const {journeySegments,journeyView,holdStationaryPosition}=createRequire(import.meta.url)(path.join(output,'journey.js'));
const time=Date.now(),tripId=crypto.randomUUID();
const point=(n,lat=-1.28,lng=36.82,extra={})=>({eventId:crypto.randomUUID(),tripId,kind:'point',recordedAt:time+n*1000,lat,lng,accuracy:5,speed:1,...extra});
test('walking and a real turn remain a measured journey with original coordinates',()=>{
  const points=[point(0),point(5,-1.27995),point(10,-1.2799),point(15,-1.2799,36.82005)];
  assert.deepEqual(journeySegments(points),[points]);
});
test('uncertainty-sized jitter, inaccurate fixes and a provider jump do not zigzag the trail',()=>{
  const start=point(0),next=point(10,-1.2799),turn=point(20,-1.2799,36.8201);
  assert.deepEqual(journeySegments([start,point(2,-1.279999),point(4,-1.279,36.83,{accuracy:350}),next,point(12,-1.1,36.5),turn]),[[start,next,turn]]);
});
test('missing signal and separate journeys are shown as gaps without invented connecting lines',()=>{
  const first=[point(0),point(5,-1.2799),point(10,-1.2798)],second=[point(140,-1.27),point(145,-1.2699),point(150,-1.2698)],id=crypto.randomUUID(),third=[point(155,-1.26,36.82,{tripId:id}),point(160,-1.2599,36.82,{tripId:id}),point(165,-1.2598,36.82,{tripId:id})];
  assert.deepEqual(journeySegments([...third,...second,...first].reverse()),[first,second,third]);
});
test('replayed or simultaneous points cannot create phantom movement and input stays intact',()=>{
  const a=point(0),b=point(5,-1.2799),c=point(10,-1.2798),input=[c,b,a,a,point(0,-1.27)];
  const copy=JSON.stringify(input);assert.deepEqual(journeySegments(input),[[a,b,c]]);assert.equal(JSON.stringify(input),copy);
});

test('two stationary phones with 500 wandering indoor fixes each draw no ride and hold independent markers',()=>{
 for(const phase of [0,1]){
  const fixes=Array.from({length:500},(_,i)=>point(i*30,-1.28+Math.sin(i*1.37+phase)*.0002,36.82+Math.cos(i*.83+phase)*.0002,{accuracy:22,speed:0}));
  const raw=JSON.stringify(fixes),view=journeyView(fixes);
  assert.deepEqual(view.segments,[]);assert.equal(view.moving,false);assert.equal(view.excludedPoints,500);
  assert.equal(view.position.lat,fixes[0].lat);assert.equal(view.position.lng,fixes[0].lng);
  assert.equal(view.position.recordedAt,fixes.at(-1).recordedAt);assert.equal(JSON.stringify(fixes),raw);
 }
});

test('a pair of jumping fixes or one transient indoor speed cannot start a journey',()=>{
 assert.deepEqual(journeySegments([point(0),point(5,-1.2798)]),[]);
 const fixes=[point(0,-1.28,36.82,{speed:0}),point(30,-1.2798,36.82,{speed:2}),point(60,-1.2801,36.8201,{speed:0}),point(90,-1.28,36.82,{speed:0})];
 assert.deepEqual(journeySegments(fixes),[]);
});

test('speedless offline walks retain their beginning and real turns after coherent movement is confirmed',()=>{
 const fixes=Array.from({length:10},(_,i)=>point(i*3,-1.28+i*.00005,36.82,{speed:null}));fixes.push(point(30,fixes.at(-1).lat,36.82005,{speed:null}));
 assert.deepEqual(journeySegments(fixes),[fixes]);
});

test('stationary uncertainty without speed and slow provider creep cannot build a random-walk trail',()=>{
 const noisy=Array.from({length:500},(_,i)=>point(i*10,-1.28+Math.sin(i*1.37)*.0002,36.82+Math.cos(i*.83)*.0002,{accuracy:22,speed:null}));
 assert.deepEqual(journeySegments(noisy),[]);
 const creep=Array.from({length:100},(_,i)=>point(i*30,-1.28+i*.000004,36.82,{accuracy:12,speed:null}));
 assert.deepEqual(journeySegments(creep),[]);
});

test('stopping a real walk freezes its end instead of extending the route through indoor GPS drift',()=>{
 const walk=[point(0),point(5,-1.2799),point(10,-1.2798)],last=walk.at(-1),stopped=Array.from({length:30},(_,i)=>point(15+i*30,last.lat+Math.sin(i)*.00015,last.lng+Math.cos(i)*.00015,{speed:0,accuracy:22}));
 const view=journeyView([...walk,...stopped]);assert.deepEqual(view.segments,[walk]);assert.equal(view.moving,false);assert.equal(view.position.lat,last.lat);assert.equal(view.position.lng,last.lng);
});

test('stationary map anchors survive rolling history windows while motion and genuine GPS gaps release them',()=>{
 const origin=point(0,-1.28,36.82,{speed:0,accuracy:22});let held=origin;
 for(let i=1;i<600;i++)held=holdStationaryPosition(held,point(i*30,origin.lat+Math.sin(i)*.0002,origin.lng+Math.cos(i)*.0002,{speed:0,accuracy:10}),false);
 assert.equal(held.lat,origin.lat);assert.equal(held.lng,origin.lng);assert.equal(held.recordedAt,time+599*30000);assert.equal(held.accuracy,22);
 const moving=point(600*30,-1.2795);assert.deepEqual(holdStationaryPosition(held,moving,true),moving);
 const gap=point(605*30,-1.279);assert.deepEqual(holdStationaryPosition(held,gap,false),gap);
});

test('a slow but sustained walk still records when speed is below the old stationary-label threshold',()=>{
 const fixes=Array.from({length:15},(_,i)=>point(i*5,-1.28+i*.000018,36.82,{speed:.4,accuracy:3}));
 const recorded=journeySegments(fixes);assert.equal(recorded.length,1);assert.deepEqual(recorded[0][0],fixes[0]);assert.deepEqual(recorded[0].at(-1),fixes.at(-1));assert.ok(recorded[0].length>=6);
});

test('packaged native map uses exactly the office movement filter',()=>{
 execFileSync(process.execPath,['scripts/sync-rider-journey.mjs','--check']);
 const html=readFileSync('android-driver/app/src/main/assets/rider.html','utf8'),source=html.split('// BEGIN SHARED JOURNEY FILTER')[1].split('// END SHARED JOURNEY FILTER')[0],ctx=vm.createContext({});vm.runInContext(source,ctx);
 const fixes=Array.from({length:500},(_,i)=>point(i*30,-1.28+Math.sin(i)*.00015,36.82+Math.cos(i)*.00015,{speed:0,accuracy:22}));
 ctx.fixes=fixes;assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(journeyView(fixes))',ctx)),journeyView(fixes));
});

test('a legacy isolated GPS detour is hidden while original evidence and real turns stay intact',()=>{
 const start=point(0),bad=point(3,-1.2791),back=point(6,-1.27995),next=point(10,-1.2799);const input=[start,bad,back,next],raw=JSON.stringify(input);assert.deepEqual(journeySegments(input),[[start,back,next]]);assert.equal(JSON.stringify(input),raw);
});

test('the anonymized stationary field trace with false walking speeds draws no journey',()=>{
 const fixes=JSON.parse(readFileSync('tests/fixtures/stationary-drift.json','utf8')),before=JSON.stringify(fixes),view=journeyView(fixes);
 assert.ok(fixes.some(p=>p.speed>2));assert.deepEqual(view.segments,[]);assert.equal(view.moving,false);assert.equal(view.excludedPoints,fixes.length);assert.equal(JSON.stringify(fixes),before);
});

test('an inaccurate network anchor cannot swallow a subsequent genuine walking departure',()=>{
 const fixes=[point(0,-1.28,36.82,{accuracy:30,speed:null}),point(20,-1.28,36.82045,{accuracy:6}),point(44,-1.28,36.82025,{accuracy:3}),point(54,-1.28,36.82015,{accuracy:3})];
 assert.deepEqual(journeySegments(fixes),[fixes.slice(1)]);
});

test('sparse offline walking fixes retain the full journey while each signal gap remains within the limit',()=>{
 const fixes=[point(0),point(70,-1.27937),point(140,-1.27874)];
 assert.deepEqual(journeySegments(fixes),[fixes]);assert.equal(journeyView(fixes).position.lat,fixes.at(-1).lat);
});

test('continuous movement checks stop a confirmed walk from appending low-quality network drift',()=>{
 const walk=[point(0),point(5,-1.2799),point(10,-1.2798)],noise=Array.from({length:15},(_,i)=>point(30+i*10,-1.2798+Math.sin(i)*.00003,36.82+Math.cos(i)*.00003,{accuracy:35,speed:null}));
 const view=journeyView([...walk,...noise]);assert.deepEqual(view.segments,[walk]);assert.equal(view.moving,false);
});

test('phone motion evidence rejects stationary false walking speeds and preserves a real local loop',()=>{
 const still=Array.from({length:200},(_,i)=>point(i*4,-1.28+Math.sin(i)*.00006,36.82+Math.cos(i)*.00006,{accuracy:3,speed:1.8,motion:'still'}));
 assert.deepEqual(journeySegments(still),[]);
 const loop=Array.from({length:80},(_,i)=>point(i*3,-1.28+Math.sin(i*Math.PI/20)*.0003,36.82+Math.cos(i*Math.PI/20)*.0003,{accuracy:2,speed:1.7,motion:'moving'}));
 const kept=journeySegments(loop).flat();assert.ok(kept.length>50);assert.equal(kept.at(-1).eventId,loop.at(-1).eventId);
});

test('a quiet accelerometer does not suppress sustained vehicle travel or reuse an earlier trip anchor',()=>{
 const road=Array.from({length:80},(_,i)=>point(i*5,-1.28+i*.00009,36.82,{accuracy:3,speed:2,motion:'still'}));
 const view=journeyView(road);assert.equal(view.moving,true);assert.equal(view.position.eventId,road.at(-1).eventId);assert.equal(view.position.lat,road.at(-1).lat);assert.ok(view.segments.flat().length>60);
 const next=point(500,-1.27,36.83,{tripId:crypto.randomUUID(),speed:0});const restarted=journeyView([...road,next]);assert.equal(restarted.position.lat,next.lat);assert.equal(restarted.position.lng,next.lng);
});
