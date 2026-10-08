import assert from "node:assert/strict";
import { readFileSync,readdirSync } from "node:fs";
import bcrypt from "bcryptjs";
export async function verifyBootstrap({createWorker,resetWorker,passed}){
  const owner="bootstrap-fixture",deviceId=crypto.randomUUID(),officeId=crypto.randomUUID(),riderId=crypto.randomUUID(),hash=await bcrypt.hash("Synthetic-bootstrap-password-42",12);
  const seed=JSON.stringify({ownerId:owner,accounts:[{id:officeId,username:"BootstrapOffice",passwordHash:hash,role:"office"},{id:riderId,username:"BootstrapRider",passwordHash:hash,role:"rider",deviceId,phone:"+254700000099"}]});
  const worker=createWorker(seed);
  try{let db=await worker.getD1Database("DB");for(const file of readdirSync("drizzle").filter(f=>f.endsWith(".sql")).sort())for(const sql of readFileSync("drizzle/"+file,"utf8").split("--> statement-breakpoint"))if(sql.trim())await db.prepare(sql).run();
    await db.prepare("INSERT INTO tracking_devices(id,owner_id,driver_name,vehicle_label,phone_label,created_at) VALUES(?,?,?,'Fixture bike',?,?)").bind(deviceId,owner,"Existing bootstrap rider","+254700000099",Date.now()).run();
    await db.prepare("INSERT INTO driver_runtime(device_id,owner_id,app_version,on_duty,gps_enabled,heartbeat_at) VALUES(?,?,3,1,1,?)").bind(deviceId,owner,Date.now()).run();
    await db.prepare("INSERT INTO office_driver_profiles(device_id,owner_id,profile_json,updated_at) VALUES(?,?,?,?)").bind(deviceId,owner,JSON.stringify({deviceId,onDuty:true}),Date.now()).run();
    const guest=await worker.dispatchFetch("https://routeforge.test/");assert.equal(guest.status,200);assert.match(await guest.text(),/OFFICE ACCESS/);
    assert.equal((await db.prepare("SELECT COUNT(*) n FROM company_accounts").first()).n,2);
    assert.equal((await db.prepare("SELECT on_duty FROM driver_runtime WHERE device_id=?").bind(deviceId).first()).on_duty,0);assert.equal(JSON.parse((await db.prepare("SELECT profile_json FROM office_driver_profiles WHERE device_id=?").bind(deviceId).first()).profile_json).onDuty,false);
    for(const user of [owner,"other-hosted-user"]){assert.equal((await worker.dispatchFetch("https://routeforge.test/api/office",{headers:{"oai-authenticated-user-id":user,"oai-authenticated-user-email":user+"@example.test"}})).status,401);}
    const logged=await worker.dispatchFetch("https://routeforge.test/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json",Origin:"https://routeforge.test"},body:JSON.stringify({username:"BootstrapOffice",password:"Synthetic-bootstrap-password-42"})});assert.equal(logged.status,200);
    const cookie=logged.headers.get("set-cookie").split(";")[0];const accounts=await (await worker.dispatchFetch("https://routeforge.test/api/office/driver-accounts",{headers:{Cookie:cookie}})).json();assert.equal(accounts.accounts[0].deviceId,deviceId);
    passed("private bootstrap creates accounts on the existing driver record and requires the configured office login for every hosted identity");
    const newHash=await bcrypt.hash("Synthetic-reset-password-42",12);await db.prepare("UPDATE company_accounts SET password_hash=?,version=version+1 WHERE id=?").bind(newHash,riderId).run();
    // Reload the Worker while preserving D1, emulating deployment/cold start.
    await resetWorker(worker,seed,"1");db=await worker.getD1Database("DB");
    assert.equal((await worker.dispatchFetch("https://routeforge.test/")).status,200);assert.equal((await db.prepare("SELECT password_hash FROM company_accounts WHERE id=?").bind(riderId).first()).password_hash,newHash);
    await db.prepare("DELETE FROM company_accounts WHERE id=?").bind(riderId).run();await db.prepare("DELETE FROM tracking_devices WHERE id=?").bind(deviceId).run();
    await resetWorker(worker,seed,"2");db=await worker.getD1Database("DB");assert.equal((await worker.dispatchFetch("https://routeforge.test/")).status,200);assert.equal((await db.prepare("SELECT COUNT(*) n FROM company_accounts WHERE role='rider'").first()).n,0);
    passed("bootstrap survives cold starts without undoing password resets or recreating deleted drivers");
  }finally{await worker.dispose();}
}
