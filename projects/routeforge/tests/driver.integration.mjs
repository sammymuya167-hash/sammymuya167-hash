import assert from "node:assert/strict";
// The actual production Worker, real D1 transactions and synthetic rider phones.
export async function verifyDriver({mf,db,request,passed}){
  const owner="rider-fixture",other="rider-other",place={name:"Synthetic pickup",address:"Fixture, Kenya",lat:-1.28,lng:36.82,source:"manual"},destination={...place,name:"Synthetic shop",lat:-1.29};
  const office=(path,method="GET",body,account=owner)=>request(path,method,body,account);
  async function ok(response,expected=200){assert.equal(response.status,expected,await response.clone().text());return response.json();}
  const bundle=async()=>ok(await office("/api/office"));
  const getOrder=async id=>(await bundle()).orders.find(o=>o.id===id);
  const create=async(title="Synthetic rider order",amountDue=8799.25)=>ok(await office("/api/office/orders","POST",{id:crypto.randomUUID(),title,pickup:place,destination,amountDue}),201);
  const officeAction=(order,action,deviceId)=>office("/api/office/orders","PATCH",{id:order.id,version:order.version,action,...(deviceId?{deviceId}:{})});
  const native=(phone,path,body,origin)=>mf.dispatchFetch(`https://routeforge.test${path}`,{method:"POST",headers:{"Content-Type":"application/json",...(phone?{Authorization:`Bearer ${phone.token}`} :{}),...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});
  const state=(phone,onDuty=true,gpsEnabled=true)=>native(phone,"/api/driver/state",{appVersion:3,onDuty,gpsEnabled});
  const action=(phone,details,operationId=crypto.randomUUID())=>native(phone,"/api/driver/actions",{...details,operationId});
  async function enroll(name,account=owner){const invite=await ok(await office("/api/tracking/devices","POST",{driverName:name,vehicleLabel:"Synthetic motorbike",phoneLabel:"+254700000000"},account),201);const paired=await ok(await native(null,"/api/tracking/pair",{code:invite.code,deviceName:"Fixture Android",appVersion:2}));return {...paired,tripId:crypto.randomUUID()};}
  async function fix(phone){return ok(await native(phone,"/api/tracking/ingest",{events:[{eventId:crypto.randomUUID(),tripId:phone.tripId,kind:"point",recordedAt:Date.now()-500,lat:place.lat,lng:place.lng,accuracy:5,battery:85}]}));}
  async function duty(phone){await ok(await action(phone,{action:"start_duty"}));await ok(await state(phone));await fix(phone);}
  async function progress(phone,order,kind,id){return action(phone,{action:kind,orderId:order.id,dispatchId:order.dispatchId},id);}
  async function finish(phone,order){await ok(await progress(phone,order,"collected"));await ok(await progress(phone,order,"delivered"));}

  assert.equal((await request("/api/office/order-updates","GET",undefined,null)).status,401);
  for(const path of ["state","actions"])assert.equal((await native(null,`/api/driver/${path}`,{})).status,401);
  const a=await enroll("Synthetic rider A"),b=await enroll("Synthetic rider B"),foreign=await enroll("Foreign rider",other);
  const update=await ok(await office("/api/office/order-updates"));assert.equal(update.orders.length,0);assert.equal((await office("/api/office/order-updates")).headers.get("cache-control"),"private, no-store");
  const initial=await ok(await state(a,false));assert.equal(initial.assignment,null);assert.deepEqual(initial.recentOrders,[]);
  assert.equal((await native(a,"/api/driver/state",{appVersion:2,onDuty:true,gpsEnabled:true,ownerId:other})).status,422);
  assert.equal((await native(a,"/api/driver/state",{appVersion:2,onDuty:true,gpsEnabled:true},"https://foreign.test")).status,403);
  const deviceView=(await ok(await office("/api/tracking/devices"))).devices.find(d=>d.id===a.deviceId);
  assert.equal(deviceView.rider.gpsEnabled,true);assert.equal(deviceView.latestPoint,null);assert.equal(deviceView.rider.onDuty,false);
  passed("native endpoints require scoped device tokens; GPS enabled is distinct from receiving a fresh fix");

  await duty(a);await duty(b);await duty(foreign);
  const queued=await create("No active offer fixture");assert.equal((await action(a,{action:"accept",orderId:queued.id})).status,409);
  const offered=await ok(await officeAction(queued,"offer"));assert.equal(offered.status,"offered");assert.ok(offered.offerDeadline-Date.now()<=5000);
  assert.deepEqual((await ok(await office("/api/office/order-updates","GET",undefined,other))).orders,[]);
  const feed=await ok(await state(a));assert.equal(feed.offers[0].id,offered.id);assert.equal(feed.offers[0].offerRiders,2);await ok(await state(b,true,false));assert.deepEqual((await ok(await state(b,true,false))).offers,[]);assert.equal((await action(b,{action:"accept",orderId:offered.id})).status,409);await ok(await state(b));assert.equal((await state(a)).headers.get("cache-control"),"private, no-store");
  assert.deepEqual((await ok(await state(foreign))).offers,[]);assert.equal((await action(foreign,{action:"accept",orderId:offered.id})).status,404);
  const claims=await Promise.all([action(a,{action:"accept",orderId:offered.id}),action(b,{action:"accept",orderId:offered.id})]);assert.equal(claims.filter(r=>r.status===200).length,1);assert.ok(claims.every(r=>[200,409].includes(r.status)));
  const claimed=await claims.find(r=>r.status===200).json(),assigned=claimed.order,winner=assigned.deviceId===a.deviceId?a:b,loser=winner===a?b:a;
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM driver_dispatches WHERE owner_id=? AND json_extract(dispatch_json,'$.orderId')=?").bind(owner,offered.id).first()).n,1);
  assert.equal((await ok(await state(winner))).order.id,assigned.id);assert.equal((await ok(await state(loser))).order,null);
  const cancelledRows=[];for(let i=0;i<11;i++){const id=crypto.randomUUID(),old={...assigned,id,status:'cancelled',dispatchId:null,updatedAt:Date.now()+i+1000};cancelledRows.push(db.prepare("INSERT INTO office_orders(id,owner_id,device_id,status,input_json,payload_json,version,updated_at) VALUES(?,?,?,'cancelled','{}',?,1,?)").bind(id,owner,winner.deviceId,JSON.stringify(old),old.updatedAt));}await db.batch(cancelledRows);
  const recoveredCurrent=await ok(await state(winner));assert.equal(recoveredCurrent.recentOrders.length,10);assert.ok(!recoveredCurrent.recentOrders.some(o=>o.id===assigned.id));assert.equal(recoveredCurrent.order.id,assigned.id);assert.equal(recoveredCurrent.assignment.id,assigned.dispatchId);
  passed("the current assigned ride is returned even when it is older than the latest ten rider records");
  passed("five-second offers are private and simultaneous acceptance reserves exactly one rider without accepting queued orders");

  const expired=await ok(await officeAction(await create("Deadline fallback fixture"),"offer"));assert.deepEqual((await ok(await state(winner))).offers,[]);assert.ok([404,409].includes((await action(winner,{action:"accept",orderId:expired.id})).status));
  await db.prepare("UPDATE order_offers SET expires_at=? WHERE order_id=?").bind(Date.now()-100,expired.id).run();
  assert.equal((await action(loser,{action:"accept",orderId:expired.id})).status,409);
  const fallback=await getOrder(expired.id);assert.equal(fallback.status,"assigned");assert.equal(fallback.deviceId,loser.deviceId);assert.notEqual(fallback.deviceId,winner.deviceId);
  passed("expired offers reject late claims and recover through a random free rider, excluding busy phones");

  assert.equal((await action(winner,{action:"stop_duty"})).status,409);
  const pauseId=crypto.randomUUID();await ok(await action(winner,{action:"pause"},pauseId));await ok(await state(winner,false));
  let paused=await getOrder(assigned.id);assert.notEqual(paused.status,"delivered");assert.match(paused.driverIssue,/stopped location/);
  assert.equal((await ok(await state(winner,false))).canStop,false);
  await ok(await action(winner,{action:"pause"},pauseId));assert.equal((await action(winner,{action:"start_duty"},pauseId)).status,409);
  await duty(winner);
  assert.equal((await progress(winner,assigned,"delivered")).status,409);
  assert.equal((await action(winner,{action:"payment",orderId:assigned.id,method:"cash",amount:8799.25})).status,409);
  assert.equal((await progress(loser,assigned,"collected")).status,409);
  passed("normal duty stop is blocked during delivery; privacy pause preserves unfinished work and cannot fake payment or delivery");

  const collectId=crypto.randomUUID(),deliverId=crypto.randomUUID();await ok(await progress(winner,assigned,"collected",collectId));await ok(await progress(winner,assigned,"collected",collectId));
  assert.equal((await getOrder(assigned.id)).status,"en_route");await ok(await progress(winner,assigned,"delivered",deliverId));await ok(await progress(winner,assigned,"delivered",deliverId));
  const completed=await getOrder(assigned.id);assert.equal(completed.status,"delivered");assert.equal(completed.completionSource,"driver");assert.equal(completed.driverIssue,null);
  assert.equal((await ok(await state(winner))).canStop,true);await ok(await action(winner,{action:"stop_duty"}));
  passed("rider collection and finish reports close the same office order and replay safely without requiring false GPS arrival");

  const receiptId=crypto.randomUUID(),payment={action:"payment",orderId:assigned.id,method:"cash",amount:8799.25,reference:"Synthetic receipt"};
  await ok(await action(winner,payment,receiptId));await ok(await action(winner,payment,receiptId));await ok(await action(winner,payment));
  assert.equal((await action(winner,{...payment,amount:8799.26},receiptId)).status,409);
  assert.equal((await action(winner,{...payment,amount:1.001})).status,422);
  assert.equal((await action(loser,payment)).status,409);
  let data=await bundle();assert.equal(data.payments.length,1);assert.equal(data.sales.reportedMinor,879925);assert.equal(data.sales.cashMinor,879925);assert.equal(data.sales.verifiedMinor,0);assert.equal(data.sales.pendingReview,1);
  assert.equal((await office("/api/office/payments","PATCH",{orderId:assigned.id,version:1,status:"verified"},other)).status,409);
  await ok(await office("/api/office/payments","PATCH",{orderId:assigned.id,version:1,status:"verified"}));assert.equal((await office("/api/office/payments","PATCH",{orderId:assigned.id,version:1,status:"void"})).status,409);
  assert.equal((await bundle()).sales.verifiedMinor,879925);assert.equal((await ok(await state(winner,false))).totals.reportedMinor,879925);assert.equal((await ok(await state(foreign))).totals.reportedMinor,0);
  passed("cash reports use exact minor units, prevent duplicate sales and expose office verification separately from rider reports");

  await finish(loser,fallback);await ok(await action(loser,{action:"payment",orderId:fallback.id,method:"till",amount:1234.56,reference:"Synthetic till"}));
  data=await bundle();assert.equal(data.sales.tillMinor,123456);assert.equal(data.sales.reportedMinor,1003381);
  await ok(await office("/api/office/payments","PATCH",{orderId:fallback.id,version:1,status:"void"}));assert.equal((await bundle()).sales.reportedMinor,879925);assert.equal((await bundle()).sales.unpaidDelivered,1);assert.equal((await bundle()).payments.find(p=>p.orderId===fallback.id).status,"void");
  passed("company till reports appear in totals without bank claims; voiding retains audit history and removes the amount from sales");

  await duty(winner);const upgradeOrder=await ok(await officeAction(await create("Upgrade preserves assignment"),"assign",winner.deviceId));
  const upgrade=await ok(await office("/api/tracking/devices","PATCH",{id:winner.deviceId,action:"upgrade"}));
  assert.equal((await state(winner)).status,200);
  const upgraded=await ok(await native(null,"/api/tracking/pair",{code:upgrade.code,deviceName:"New rider build",appVersion:2}));assert.equal(upgraded.deviceId,winner.deviceId);
  assert.equal((await state(winner)).status,401);const newPhone={...winner,...upgraded};
  const recovered=await ok(await state(newPhone,false));assert.equal(recovered.assignment.id,upgradeOrder.dispatchId);assert.equal(recovered.order.id,upgradeOrder.id);assert.equal(recovered.payments[0].orderId,assigned.id);
  assert.notEqual((await native(null,"/api/tracking/pair",{code:upgrade.code,appVersion:2})).status,200);
  await ok(await action(newPhone,{action:"unlink"}));assert.equal((await state(newPhone,false)).status,401);
  data=await bundle();assert.equal(data.orders.find(o=>o.id===upgradeOrder.id).status,"cancelled");assert.match(data.orders.find(o=>o.id===upgradeOrder.id).driverIssue,/unlinked/);assert.equal(data.orders.find(o=>o.id===assigned.id).status,"delivered");assert.equal(data.sales.verifiedMinor,879925);
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM driver_dispatches WHERE device_id=?").bind(winner.deviceId).first()).n,0);
  assert.ok((await db.prepare("SELECT COUNT(*) n FROM tracking_events WHERE device_id=?").bind(winner.deviceId).first()).n>0);
  passed("upgrade codes rotate tokens while retaining the driver, assignment and receipts; phone unlink cancels unfinished work and preserves history");

  await duty(loser);const noFree=await ok(await officeAction(await create("No free fallback"),"offer"));await ok(await action(loser,{action:"pause"}));await ok(await state(loser,false));
  await db.prepare("UPDATE order_offers SET expires_at=? WHERE order_id=?").bind(Date.now()-100,noFree.id).run();assert.equal((await getOrder(noFree.id)).status,"queued");
  passed("an expired offer with no free on-duty rider returns to the queue without inventing an assignment");

  await duty(loser);
  const legacy=await ok(await office("/api/tracking/dispatch","POST",{deviceId:loser.deviceId,name:"Synthetic legacy route",vehicleId:loser.deviceId,vehicleName:"Synthetic bike",radius:100,stops:[{id:"legacy-one",name:"Synthetic stop one",address:"Fixture",lat:place.lat,lng:place.lng},{id:"legacy-two",name:"Synthetic stop two",address:"Fixture",lat:destination.lat,lng:destination.lng}]}),201);
  const legacyId=crypto.randomUUID();await ok(await action(loser,{action:"delivered",dispatchId:legacy.id,stopId:"legacy-one"},legacyId));await ok(await action(loser,{action:"delivered",dispatchId:legacy.id,stopId:"legacy-one"},legacyId));
  let legacyState=await ok(await state(loser));assert.ok(legacyState.assignment.stops[0].deliveredAt);assert.equal(legacyState.assignment.stops[1].deliveredAt,null);assert.equal(legacyState.canStop,false);
  await ok(await action(loser,{action:"delivered",dispatchId:legacy.id,stopId:"legacy-two"}));assert.equal((await ok(await state(loser))).canStop,true);
  passed("legacy multi-stop routes use stop identity so replaying confirmation cannot complete the following destination");
  const totalOwner="alltime-totals-fixture",rows=[];
  const baseOrder=await getOrder(assigned.id);
  for(let i=0;i<501;i++){const id=crypto.randomUUID(),order={...baseOrder,id,amountDue:1,status:"delivered",deviceId:loser.deviceId,dispatchId:null,measuredKm:1,ratePerKm:1},p={orderId:id,deviceId:loser.deviceId,driverName:"Synthetic totals",method:"cash",amountMinor:100,status:"verified",reference:"Fixture",reportedAt:Date.now(),verifiedAt:Date.now(),version:1};rows.push(db.prepare("INSERT INTO office_orders(id,owner_id,status,input_json,payload_json,version,updated_at) VALUES(?,?,'delivered','{}',?,1,?)").bind(id,totalOwner,JSON.stringify(order),Date.now()),db.prepare("INSERT INTO office_payments(order_id,owner_id,device_id,status,amount_minor,payload_json,updated_at,version) VALUES(?,?,?,'verified',100,?,?,1)").bind(id,totalOwner,loser.deviceId,JSON.stringify(p),Date.now()));}
  for(let i=0;i<rows.length;i+=80)await db.batch(rows.slice(i,i+80));
  const totalData=await ok(await office("/api/office","GET",undefined,totalOwner));assert.equal(totalData.orders.length,500);assert.equal(totalData.payments.length,500);assert.equal(totalData.sales.reportedMinor,50100);assert.equal(totalData.sales.verifiedMinor,50100);assert.equal(totalData.sales.delivered,501);assert.equal(totalData.sales.unpaidDelivered,0);assert.equal(totalData.sales.expectedMinor,50100);assert.equal(totalData.sales.measuredKm,501);assert.equal(totalData.sales.estimatedDriverCostMinor,50100);
  passed("financial, delivery and mileage totals include older records beyond the 500-row dashboard view");
}
