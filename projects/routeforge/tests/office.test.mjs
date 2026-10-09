import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const output=path.resolve(".sites-runtime/office-tests");
mkdirSync(output,{recursive:true});
execFileSync(process.execPath,["node_modules/typescript/bin/tsc","--outDir",output,"--module","commonjs","--moduleResolution","node","--target","es2022","--esModuleInterop","--strict","--skipLibCheck","lib/office.ts","lib/map-view.ts"],{stdio:"pipe"});
writeFileSync(path.join(output,"package.json"),'{"type":"commonjs"}');
const require=createRequire(import.meta.url);
const {driverChoices,gpsMileage,phoneLink,photonPlaces,placeInput,orderInput,driverProfileInput,statusFromDispatch}=require(path.join(output,"office.js"));
const {projectLocation,unprojectLocation}=require(path.join(output,"map-view.js"));
const time=Date.now(),tripId=crypto.randomUUID();
const point=(offset,lat=-1.28,extra={})=>({kind:"point",eventId:crypto.randomUUID(),tripId,recordedAt:time+offset,lat,lng:36.82,accuracy:8,...extra});
const place={name:"Synthetic shop",address:"Fixture area",lat:-1.28,lng:36.82,source:"manual"};
const device=(id,extra={})=>({id,driverName:"Fixture driver",pairedAt:time-10000,revokedAt:null,status:"live",latestPoint:point(0),...extra});

test("available choices contain only paired company drivers and exclude busy, off-duty and stale phones",()=>{
  const a=device("a"),b=device("b"),c=device("c"),d=device("d",{status:"stale"});
  const choices=driverChoices([a,b,c,d,device("pending",{pairedAt:null}),device("revoked",{revokedAt:time})],[{deviceId:"c",onDuty:false}],[{deviceId:"b",stops:[{deliveredAt:null}]}]);
  assert.deepEqual(choices.map(c=>c.device.id).sort(),["a","b","c","d"]);
  assert.deepEqual(choices.filter(c=>c.available).map(c=>c.device.id),["a"]);
  assert.equal(choices.find(c=>c.device.id==="b").reason,"On an active order");
});
test("automatic assignment prioritizes the longest free driver, then proximity",()=>{
  const choices=driverChoices([device("recent"),device("idle"),device("far",{latestPoint:point(0,-1.4)}),device("close")],[{deviceId:"recent",lastAssignedAt:time-100,lastReleasedAt:time-50},{deviceId:"idle",lastAssignedAt:time-10000,lastReleasedAt:time-5000}],[],place);
  assert.deepEqual(choices.map(c=>c.device.id),["close","far","idle","recent"]);
  assert.equal(driverChoices([device("done")],[],[{deviceId:"done",stops:[{deliveredAt:time}]}])[0].available,true);
});
test("GPS mileage deduplicates and orders fixes without charging stationary jitter",()=>{
  const a=point(0),b=point(60000,-1.29),jitter=point(90000,-1.290001);
  const result=gpsMileage([jitter,b,a,b]);
  assert.ok(result.measuredKm>1.1&&result.measuredKm<1.12);
  assert.equal(result.excludedSegments,0);
  assert.equal(gpsMileage([a,point(30000,-1.280001)]).measuredKm,0);
});
test("GPS mileage excludes offline gaps, different trips, poor accuracy and impossible jumps",()=>{
  const a=point(0);
  for(const b of [point(121000,-1.29),point(60000,-1.29,{tripId:crypto.randomUUID()}),point(60000,-1.29,{accuracy:51}),point(1000,-1.4),point(0,-1.29)]){
    assert.deepEqual(gpsMileage([a,b]),{measuredKm:0,excludedSegments:1});
  }
});
test("GeoJSON suggestions map longitude and latitude correctly and reject malformed results",()=>{
  const fixture={features:[{geometry:{type:"Point",coordinates:[36.82,-1.28]},properties:{name:"Synthetic shop",city:"Fixture city",country:"Kenya"}}]};
  const results=photonPlaces(fixture);
  assert.equal(results[0].lat,-1.28);assert.equal(results[0].lng,36.82);assert.equal(results[0].source,"photon");
  assert.deepEqual(photonPlaces({...fixture,features:[{...fixture.features[0],geometry:{type:"Point",coordinates:[36,91]}}]}),[]);
  assert.deepEqual(photonPlaces({features:"malformed"}),[]);
});
test("orders require real location selections and profiles reject owner spoofing or invalid rates",()=>{
  const order={id:crypto.randomUUID(),title:"Synthetic collection",pickup:place,destination:place};
  assert.equal(orderInput.safeParse(order).success,true);
  assert.equal(orderInput.safeParse({...order,driverName:"Arbitrary driver"}).success,false);
  assert.equal(placeInput.safeParse({...place,lat:NaN}).success,false);
  const profile={deviceId:crypto.randomUUID(),vehicleLabel:"Fixture vehicle",phone:"+254 700 000 000",onDuty:true,ratePerKm:25};
  assert.equal(driverProfileInput.safeParse(profile).success,true);
  assert.equal(driverProfileInput.safeParse({...profile,ratePerKm:-1}).success,false);
  assert.equal(driverProfileInput.safeParse({...profile,ownerId:"foreign"}).success,false);
});
test("calling uses normalized telephone numbers and refuses executable or malformed links",()=>{
  assert.equal(phoneLink("+254 (700) 000-000"),"tel:+254700000000");
  for(const value of ["javascript:alert(1)","123","+254700000000;extension=4","1234567890123456"]){assert.equal(phoneLink(value),null);}
});
test("collection and delivery statuses remain distinct until office confirmation",()=>{
  const pickup={arrivedAt:null,deliveredAt:null},destination={...pickup};
  const state=(a,b)=>statusFromDispatch({stops:[{...pickup,...a},{...destination,...b}]});
  assert.equal(state({},{}),"assigned");assert.equal(state({arrivedAt:time},{}),"pickup_arrived");
  assert.equal(state({deliveredAt:time},{}),"en_route");assert.equal(state({deliveredAt:time},{arrivedAt:time}),"arrived");
  assert.equal(state({deliveredAt:time},{arrivedAt:time,deliveredAt:time}),"delivered");
});
test("map crosshair converts accurately back to latitude and longitude at different places",()=>{
  for(const [lat,lng] of [[-1.28,36.82],[0,0],[-4.05,39.67],[84,-170]]){
    const recovered=unprojectLocation(projectLocation(lat,lng));
    assert.ok(Math.abs(recovered.lat-lat)<1e-10);assert.ok(Math.abs(recovered.lng-lng)<1e-10);
  }
});

test('live GPS alone cannot make a rider available when phone GPS is off or the app heartbeat is stale',()=>{
  const rider={onDuty:true,gpsEnabled:true,appVersion:3,heartbeatAt:time};
  const choices=driverChoices([device('ready',{rider}),device('gps-off',{rider:{...rider,gpsEnabled:false}}),device('disconnected',{rider:{...rider,heartbeatAt:time-91000}})],[],[]);
  assert.deepEqual(choices.filter(c=>c.available).map(c=>c.device.id),['ready']);
  assert.equal(choices.find(c=>c.device.id==='gps-off').reason,'Phone GPS is off');
  assert.equal(choices.find(c=>c.device.id==='disconnected').reason,'Rider app disconnected');
});

test('per-delivery recipients normalize Kenyan and international phone numbers while preserving older requests',()=>{
 const input={id:crypto.randomUUID(),title:'Synthetic contact request',pickup:place,destination:place};
 assert.equal(orderInput.parse(input).customer,undefined);
 assert.deepEqual(orderInput.parse({...input,customer:{name:' Test recipient ',phone:'0712 345 678'}}).customer,{name:'Test recipient',phone:'+254712345678'});
 assert.equal(orderInput.parse({...input,customer:{name:'Test',phone:'+44 7700 900123'}}).customer.phone,'+447700900123');
 for(const customer of [{name:'',phone:'0712345678'},{name:'Test',phone:'javascript:alert(1)'},{name:'Test',phone:'123'},{name:'Test',phone:'0712345678',ownerId:'other'}])assert.equal(orderInput.safeParse({...input,customer}).success,false);
});
