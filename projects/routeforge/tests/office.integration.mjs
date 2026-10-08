import assert from "node:assert/strict";

// Synthetic company records only, in the caller's disposable D1 database.
export async function verifyOffice({mf,db,request,passed,geocoderCalls}) {
  const owner="office-fixture",other="office-other";
  const api=(path,method="GET",body,account=owner,origin)=>request(path,method,body,account,origin);
  const bundle=async(account=owner)=>(await (await api("/api/office","GET",undefined,account)).json());
  const place={name:"Synthetic collection point",address:"Fixture area, Kenya",lat:-1.28,lng:36.82,source:"manual"};
  const destination={...place,name:"Synthetic destination",lat:-1.29};
  const input=(title="Synthetic office order")=>({id:crypto.randomUUID(),title,pickup:place,destination,notes:"Test fixture"});
  async function jsonOk(response,expected=200){assert.equal(response.status,expected,await response.clone().text());return response.json();}
  async function createOrder(details=input()){return jsonOk(await api("/api/office/orders","POST",details),201);}
  async function action(order,kind,deviceId){return api("/api/office/orders","PATCH",{id:order.id,version:order.version,action:kind,...(deviceId?{deviceId}:{})});}
  async function enroll(name){
    const invite=await jsonOk(await api("/api/tracking/devices","POST",{driverName:name,vehicleLabel:"Synthetic vehicle",phoneLabel:"+254700000000"}),201);
    const paired=await jsonOk(await api("/api/tracking/pair","POST",{code:invite.code,deviceName:"Fixture Android"},null));
    return {...paired,tripId:crypto.randomUUID()};
  }
  function fix(device,time,location=place,extra={}){return {eventId:crypto.randomUUID(),tripId:device.tripId,kind:"point",recordedAt:time,lat:location.lat,lng:location.lng,accuracy:8,speed:10,battery:75,...extra};}
  async function upload(device,events){return mf.dispatchFetch("https://routeforge.test/api/tracking/ingest",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${device.token}`},body:JSON.stringify({events})});}
  async function profile(device,extra={}){return api("/api/office/drivers","PATCH",{deviceId:device.deviceId,vehicleLabel:"Synthetic vehicle",phone:"+254700000000",onDuty:true,ratePerKm:25,...extra});}
  async function getOrder(id){return (await bundle()).orders.find(o=>o.id===id);}
  async function cancelTracking(order){return api("/api/tracking/dispatch","PATCH",{deviceId:order.deviceId,id:order.dispatchId,action:"cancel"});}

  assert.equal((await api("/api/office","GET",undefined,null)).status,401);
  for(const endpoint of ["orders","partners","drivers","settings"]){
    assert.equal((await api(`/api/office/${endpoint}`,endpoint==="orders"||endpoint==="partners"?"POST":"PATCH",{},null)).status,401);
    assert.equal((await api(`/api/office/${endpoint}`,endpoint==="orders"||endpoint==="partners"?"POST":"PATCH",{},owner,"https://foreign.test")).status,403);
  }
  const empty=await api("/api/office");assert.equal(empty.headers.get("cache-control"),"private, no-store");
  assert.deepEqual((await empty.json()).orders,[]);
  passed("office records and all mutations require an account and same-origin authorization");

  const partner=await jsonOk(await api("/api/office/partners","POST",{name:"Synthetic registered shop",location:destination,contact:"Fixture contact",phone:"+254700000000"}),201);
  assert.equal((await api("/api/office/settings","PATCH",{name:"Synthetic office",location:place})).status,200);
  assert.equal((await bundle()).settings.location.lat,place.lat);
  const partnerOrder=await createOrder({...input(),destination:{...place,partnerId:partner.id}});
  assert.equal(partnerOrder.destination.lat,destination.lat);assert.equal(partnerOrder.destination.name,partner.name);
  assert.equal((await api("/api/office/orders","POST",{...input(),destination:{...place,partnerId:partner.id}},other)).status,404);
  assert.equal((await api("/api/office/partners","PATCH",{id:partner.id,active:false},other)).status,404);
  assert.equal((await action(partnerOrder,"cancel")).status,200);
  const stranger=await bundle(other);assert.deepEqual(stranger.orders,[]);assert.deepEqual(stranger.partners,[]);assert.equal(stranger.settings.location,null);
  passed("saved partner and office coordinates persist privately and foreign partner IDs cannot be reused");

  const retryInput=input("Idempotent fixture");
  const retries=await Promise.all([api("/api/office/orders","POST",retryInput),api("/api/office/orders","POST",retryInput)]);
  assert.deepEqual(retries.map(r=>r.status),[201,201]);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM office_orders WHERE id=?").bind(retryInput.id).first()).n,1);
  assert.equal((await api("/api/office/orders","POST",{...retryInput,title:"Changed details"})).status,409);
  assert.equal((await api("/api/office/orders","POST",{...input(),driverName:"Unregistered stranger"})).status,422);
  const queued=await getOrder(retryInput.id);
  assert.equal((await action(queued,"assign","auto")).status,409);assert.equal((await getOrder(queued.id)).status,"queued");
  assert.equal((await api("/api/office/orders","PATCH",{id:queued.id,version:queued.version,action:"cancel"},other)).status,404);
  passed("order retries are idempotent, arbitrary drivers are rejected and unavailable assignments stay queued");

  const a=await enroll("Synthetic driver A"),b=await enroll("Synthetic driver B");
  const pending=await jsonOk(await api("/api/tracking/devices","POST",{driverName:"Pending fixture"}),201);
  assert.equal((await profile({deviceId:pending.id})).status,404);
  assert.equal((await profile(a)).status,200);assert.equal((await profile(b)).status,200);
  assert.equal((await api("/api/office/drivers","PATCH",{deviceId:a.deviceId,vehicleLabel:"foreign",phone:"",onDuty:true,ratePerKm:null},other)).status,404);
  assert.equal((await upload(a,[fix(a,Date.now()-1000)])).status,200);
  assert.equal((await upload(b,[fix(b,Date.now()-1000)])).status,200);
  assert.equal((await profile(b,{onDuty:false})).status,200);
  assert.equal((await action(queued,"assign",b.deviceId)).status,409);
  assert.equal((await action(queued,"assign",pending.id)).status,409);
  assert.equal((await profile(b)).status,200);
  await db.prepare("UPDATE office_driver_profiles SET profile_json=json_set(profile_json,'$.lastAssignedAt',?) WHERE device_id=?").bind(Date.now()-5000,b.deviceId).run();
  const operation=await jsonOk(await action(queued,"assign","auto"));
  assert.equal(operation.deviceId,a.deviceId);assert.equal(operation.ratePerKm,25);
  assert.equal((await action(queued,"assign",b.deviceId)).status,409);
  assert.equal((await action(operation,"confirm_delivery")).status,409);
  assert.equal((await profile(a,{ratePerKm:40})).status,200);
  assert.equal((await getOrder(operation.id)).ratePerKm,25);
  passed("assignment uses only paired, on-duty, live drivers and snapshots the agreed kilometre rate");

  const competing=await Promise.all([createOrder(input("Concurrent B1")),createOrder(input("Concurrent B2"))]);
  const reservations=await Promise.all(competing.map(o=>action(o,"assign",b.deviceId)));
  assert.deepEqual(reservations.map(r=>r.status).sort(),[200,409]);
  const reserved=await reservations.find(r=>r.status===200).json();
  assert.equal((await cancelTracking(reserved)).status,200);
  assert.equal((await getOrder(reserved.id)).status,"cancelled");
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM driver_dispatches WHERE device_id=?").bind(b.deviceId).first()).n,0);
  assert.ok((await bundle()).profiles.find(p=>p.deviceId===b.deviceId).lastReleasedAt);
  passed("simultaneous orders cannot double-book a phone and cancellation from tracking also updates the office");

  const first=fix(a,operation.assignedAt+1000),second=fix(a,operation.assignedAt+17000);
  assert.equal((await upload(a,[first,second])).status,200);
  const pickupArrived=await getOrder(operation.id);assert.equal(pickupArrived.status,"pickup_arrived");assert.equal(pickupArrived.deliveredAt,null);
  assert.equal((await action(operation,"confirm_pickup")).status,200);
  assert.equal((await getOrder(operation.id)).status,"en_route");
  assert.equal((await action(operation,"confirm_pickup")).status,409);
  assert.equal((await upload(a,[fix(a,operation.assignedAt+60000,destination),fix(a,operation.assignedAt+76000,destination)])).status,200);
  const dropoffArrived=await getOrder(operation.id);assert.equal(dropoffArrived.status,"arrived");assert.equal(dropoffArrived.deliveredAt,null);
  assert.ok(dropoffArrived.measuredKm>1.1&&dropoffArrived.measuredKm<1.12);
  assert.equal((await action(operation,"confirm_delivery")).status,200);
  const delivered=await getOrder(operation.id);assert.equal(delivered.status,"delivered");assert.ok(delivered.pickedUpAt);assert.ok(delivered.deliveredAt);
  assert.equal(delivered.ratePerKm,25);assert.equal((await action(operation,"cancel")).status,409);
  const release=(await bundle()).profiles.find(p=>p.deviceId===a.deviceId).lastReleasedAt;
  assert.equal(release,delivered.deliveredAt);await bundle();assert.equal((await bundle()).profiles.find(p=>p.deviceId===a.deviceId).lastReleasedAt,release);
  passed("GPS arrival, manual collection and manual delivery share one durable order with reviewed mileage; polling does not reset idle time");

  const same=await createOrder(input("One order / two dispatchers"));
  const concurrent=await Promise.all([action(same,"assign",a.deviceId),action(same,"assign",b.deviceId)]);
  assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);
  const winner=await concurrent.find(r=>r.status===200).json();
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM driver_dispatches WHERE owner_id=? AND json_extract(dispatch_json,'$.orderId')=?").bind(owner,same.id).first()).n,1);
  assert.equal((await action(winner,"cancel")).status,200);
  assert.equal((await getOrder(winner.id)).status,"cancelled");
  assert.equal((await getOrder(operation.id)).status,"delivered");
  passed("concurrent assignments cannot put one order on two phones and later cancellation preserves completed history");

  const stale=await createOrder(input("Stale device fixture"));
  await db.prepare("UPDATE tracking_devices SET latest_point_at=? WHERE id=?").bind(Date.now()-120000,b.deviceId).run();
  assert.equal((await action(stale,"assign",b.deviceId)).status,409);
  assert.equal((await upload(b,[fix(b,Date.now()+1000)])).status,200);
  const recovered=await jsonOk(await action(stale,"assign",b.deviceId));assert.equal(recovered.deviceId,b.deviceId);
  assert.equal((await action(recovered,"cancel")).status,200);
  const leaving=await jsonOk(await action(await createOrder(input("Offboarding fixture")),"assign",b.deviceId));
  assert.equal((await api("/api/tracking/devices","PATCH",{id:b.deviceId,action:"revoke"})).status,200);
  assert.equal((await api("/api/tracking/devices","PATCH",{id:b.deviceId,action:"remove"})).status,200);
  assert.equal((await getOrder(leaving.id)).status,"cancelled");
  assert.equal((await getOrder(operation.id)).status,"delivered");
  passed("explicit removal of an unlinked driver closes unfinished work while preserving office order history");
  assert.equal((await api("/api/office/partners","PATCH",{id:partner.id,active:false})).status,200);
  assert.equal((await api("/api/office/orders","POST",{...input(),destination:{...place,partnerId:partner.id}})).status,404);
  assert.equal((await api("/api/office/partners","PATCH",{id:partner.id,active:true})).status,200);
  passed("server-side dispatch checks reject stale GPS even if the UI was open, and paused partners cannot receive new orders");

  assert.equal((await api("/api/office/places?q=Fixture","GET",undefined,null)).status,401);
  assert.equal((await api("/api/office/places?q=ab")).status,422);
  const before=geocoderCalls.length;
  const searched=await api("/api/office/places?q=Fixture%20shop");assert.equal(searched.status,200,`${await searched.clone().text()} / fixture calls: ${geocoderCalls.map(u=>u.href).join(",")}`);assert.equal(searched.headers.get("cache-control"),"private, no-store");
  const places=(await searched.json()).places;assert.equal(places[0].lat,-1.28);assert.equal(places[0].lng,36.82);
  const call=geocoderCalls.at(-1);assert.equal(call.origin,"https://photon.komoot.io");assert.equal(call.searchParams.get("countrycode"),"KE");assert.equal(call.searchParams.get("limit"),"6");
  assert.equal((await api("/api/office/places?q=Fixture%20shop")).status,200);assert.equal(geocoderCalls.length,before+1);
  assert.equal((await api("/api/office/places?q=Other%20search")).status,429);
  await db.prepare("UPDATE place_search_gate SET next_allowed_at=0").run();
  assert.equal((await api("/api/office/places?q=Fixture%20shop","GET",undefined,other)).status,200);assert.equal(geocoderCalls.length,before+2);
  await db.prepare("UPDATE place_search_gate SET next_allowed_at=0").run();
  assert.equal((await api("/api/office/places?q=Unavailable%20fixture")).status,503);
  await db.prepare("UPDATE place_search_gate SET next_allowed_at=0").run();
  assert.equal((await api("/api/office/places?q=Redirect%20fixture")).status,503);
  passed("the mocked geocoder contract verifies Kenya coordinates, private caching, a shared rate limit and usable failure responses");
}
