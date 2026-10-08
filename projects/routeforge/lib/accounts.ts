import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { getChatGPTUser } from "../app/chatgpt-auth";
import { hashSecret, randomSecret, TrackingError } from "./tracking";
import { loginInput, newDriverInput } from "./account-input";

const db=()=>env.DB as D1Database;
export const OFFICE_COOKIE="__Host-routeforge-office";
type Account={id:string;owner_id:string;username:string;password_hash:string;role:"office"|"rider";device_id:string|null;phone:string;enabled:number;version:number};
type Seed={ownerId:string;accounts:{id:string;username:string;passwordHash:string;role:"office"|"rider";deviceId?:string;phone?:string}[]};
let seeded:Promise<void>|undefined;
export async function ensureAccounts(){
  const value=(env as unknown as {ROUTEFORGE_AUTH_BOOTSTRAP?:string}).ROUTEFORGE_AUTH_BOOTSTRAP;
  if(!value)return;
  if(!seeded)seeded=(async()=>{
    const seed=JSON.parse(value) as Seed;
    if(!seed.ownerId||!seed.accounts?.some(a=>a.role==="office"))throw new Error("Account bootstrap is incomplete");
    const office=seed.accounts.find(a=>a.role==="office")!;
    // The whole initial set is inserted atomically. Later resets/removals
    // belong to the office and must never be overwritten by a cold start.
    if(await db().prepare("SELECT id FROM company_accounts WHERE id=? AND owner_id=? AND role='office'").bind(office.id,seed.ownerId).first())return;
    const now=Date.now();
    for(const a of seed.accounts){
      if(!/^\$2[aby]\$12\$/.test(a.passwordHash))throw new Error("Account password hashes must use bcrypt cost 12");
      // Existing rider identity is verified server-side. Bootstrap never
      // creates a replacement driver or rewrites a later password reset.
      if(a.role==="rider"){
        const device=await db().prepare("SELECT id FROM tracking_devices WHERE id=? AND owner_id=?").bind(a.deviceId,seed.ownerId).first();
        if(!device)throw new Error("Bootstrap rider record is unavailable");
      }
    }
    try{await db().batch(seed.accounts.map(a=>db().prepare("INSERT INTO company_accounts(id,owner_id,username,username_key,password_hash,role,device_id,phone,enabled,version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,1,1,?,?)").bind(a.id,seed.ownerId,a.username,a.username.toLowerCase(),a.passwordHash,a.role,a.deviceId??null,a.phone??"",now,now)));}
    catch(e){if(!await db().prepare("SELECT id FROM company_accounts WHERE id=? AND owner_id=? AND role='office'").bind(office.id,seed.ownerId).first())throw e;}
  })().catch(e=>{seeded=undefined;throw e;});
  await seeded;
}
function cookieToken(value:string){const token=value.split(";").map(v=>v.trim()).find(v=>v.startsWith(OFFICE_COOKIE+"="))?.slice(OFFICE_COOKIE.length+1);return token&&/^[a-f0-9]{64}$/.test(token)?token:null;}
export async function officeIdentity(){
  await ensureAccounts();const h=await headers(),cookie=h.get("cookie")??"",token=cookieToken(cookie);
  if(token){
    const a=await db().prepare("SELECT a.owner_id,a.username FROM office_sessions s JOIN company_accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires_at>? AND s.account_version=a.version AND a.enabled=1 AND a.role='office'").bind(await hashSecret(token),Date.now()).first<{owner_id:string;username:string}>();
    return a?{owner:a.owner_id,name:a.username}:null;
  }
  if(cookie.includes(OFFICE_COOKIE+"="))return null;
  if((env as unknown as {ROUTEFORGE_AUTH_BOOTSTRAP?:string}).ROUTEFORGE_AUTH_BOOTSTRAP)return null;
  // Preserve hosted identity for unconfigured workspaces. Once an office
  // account is present, ChatGPT identity alone cannot bypass its password.
  const user=await getChatGPTUser();if(!user)return null;
  const configured=await db().prepare("SELECT id FROM company_accounts WHERE owner_id=? AND role='office' LIMIT 1").bind(user.userId).first();
  return configured?null:{owner:user.userId,name:user.fullName??"SHADOWNET"};
}
export async function officeOwner(){return (await officeIdentity())?.owner??null;}
async function accountLogin(request:Request,payload:unknown,role:Account["role"]){
  await ensureAccounts();const parsed=loginInput.safeParse(payload);if(!parsed.success)throw new TrackingError(422,"Enter your username and password.");
  const input=parsed.data,key=input.username.toLowerCase(),now=Date.now();
  // Account and trusted-edge IP limits are independent; alternating account
  // names cannot evade the IP limit, and IP changes cannot evade the account limit.
  const ip=request.headers.get("cf-connecting-ip")??"unknown",keys=await Promise.all([hashSecret("login:"+role+":"+key),hashSecret("login-ip:"+ip)]);
  const limits=[10,60];
  const attempts=await db().batch<Record<string,unknown>>(keys.map(k=>db().prepare("INSERT INTO login_limits(key,started_at,attempts) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN started_at<? THEN 1 ELSE attempts+1 END,started_at=CASE WHEN started_at<? THEN excluded.started_at ELSE started_at END RETURNING attempts").bind(k,now,now-900000,now-900000)));
  if(attempts.some((r,i)=>Number(r.results[0]?.attempts)>limits[i]))throw new TrackingError(429,"Too many sign-in attempts. Try again in 15 minutes.");
  const account=await db().prepare("SELECT * FROM company_accounts WHERE username_key=?").bind(key).first<Account>();
  // Same-cost comparison for unknown usernames avoids a fast enumeration path.
  const fallback="$2b$12$C6UzMDM.H6dfI/f/IKcEe.OblAN77LVEE91mbMbS6QQJuDY/ZCQ6";
  const valid=!bcrypt.truncates(input.password)&&await bcrypt.compare(input.password,account?.password_hash??fallback);
  if(!valid||!account||!account.enabled||account.role!==role)throw new TrackingError(401,"Username or password is incorrect.");
  return {account,input};
}
export async function loginOffice(request:Request,payload:unknown){
  const {account}=await accountLogin(request,payload,"office"),token=randomSecret(),now=Date.now(),expiresAt=now+43200000;
  await db().batch([
    db().prepare("DELETE FROM office_sessions WHERE expires_at<?").bind(now),
    db().prepare("INSERT INTO office_sessions(token_hash,account_id,account_version,expires_at) VALUES(?,?,?,?)").bind(await hashSecret(token),account.id,account.version,expiresAt),
  ]);
  return {username:account.username,token,expiresAt};
}
export async function logoutOffice(request:Request){const token=cookieToken(request.headers.get("cookie")??"");if(token)await db().prepare("DELETE FROM office_sessions WHERE token_hash=?").bind(await hashSecret(token)).run();}
export async function loginRider(request:Request,payload:unknown){
  const {account,input}=await accountLogin(request,payload,"rider");
  if(!input.deviceName||!input.appVersion||!account.device_id)throw new TrackingError(422,"Use the latest Rider app to sign in.");
  if(input.previousDeviceId&&input.previousDeviceId!==account.device_id)throw new TrackingError(409,"This phone has saved reports for another rider. Sign in to that rider account and sync them first.");
  const now=Date.now(),token=randomSecret(),hash=await hashSecret(token);
  const rows=await db().batch<Record<string,unknown>>([
    db().prepare("UPDATE tracking_devices SET token_hash=?,paired_at=COALESCE(paired_at,?),revoked_at=NULL,device_name=?,pair_code_hash=NULL,pair_expires_at=NULL WHERE id=? AND owner_id=? AND EXISTS(SELECT 1 FROM company_accounts WHERE id=? AND enabled=1 AND version=? AND role='rider') RETURNING id,driver_name,vehicle_label").bind(hash,now,input.deviceName,account.device_id,account.owner_id,account.id,account.version),
    db().prepare("INSERT INTO rider_logins(device_id,account_id,account_version,token_hash) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM tracking_devices WHERE id=? AND owner_id=? AND token_hash=?) ON CONFLICT(device_id) DO UPDATE SET account_id=excluded.account_id,account_version=excluded.account_version,token_hash=excluded.token_hash").bind(account.device_id,account.id,account.version,hash,account.device_id,account.owner_id,hash),
    db().prepare("INSERT INTO driver_runtime(device_id,owner_id,app_version,on_duty,gps_enabled,heartbeat_at) SELECT id,?,?,0,0,? FROM tracking_devices WHERE id=? AND token_hash=? ON CONFLICT(device_id) DO UPDATE SET app_version=excluded.app_version,on_duty=0,gps_enabled=0,heartbeat_at=excluded.heartbeat_at").bind(account.owner_id,input.appVersion,now,account.device_id,hash),
    db().prepare("UPDATE office_driver_profiles SET profile_json=json_set(profile_json,'$.onDuty',json('false')),updated_at=? WHERE device_id=? AND owner_id=? AND EXISTS(SELECT 1 FROM tracking_devices WHERE id=? AND token_hash=?)").bind(now,account.device_id,account.owner_id,account.device_id,hash),
  ]);
  const device=rows[0].results[0];if(!device)throw new TrackingError(409,"This driver account changed. Contact the office.");
  return {deviceId:device.id,driverName:device.driver_name,vehicleLabel:device.vehicle_label,token,username:account.username,accountId:account.id,loggedIn:true};
}
export async function listDriverAccounts(owner:string){await ensureAccounts();const rows=await db().prepare("SELECT a.id,a.username,a.device_id AS deviceId,d.driver_name AS driverName,d.phone_label AS phone,a.enabled,a.updated_at AS updatedAt FROM company_accounts a JOIN tracking_devices d ON d.id=a.device_id AND d.owner_id=a.owner_id WHERE a.owner_id=? AND a.role='rider' ORDER BY d.driver_name").bind(owner).all();return {accounts:rows.results};}
export async function createDriverAccount(owner:string,payload:unknown){
  const parsed=newDriverInput.safeParse(payload);if(!parsed.success)throw new TrackingError(422,parsed.error.issues[0]?.message??"Enter a driver name and required phone number.");
  const input=parsed.data,id=crypto.randomUUID(),deviceId=input.deviceId??crypto.randomUUID(),now=Date.now(),password=randomSecret(12);
  const base=input.driverName.replace(/[^A-Za-z0-9]/g,"").slice(0,20);
  const username=input.username??((/^[A-Za-z]/.test(base)?base:"Rider"+base)+randomSecret(3));
  if(await db().prepare("SELECT id FROM company_accounts WHERE username_key=?").bind(username.toLowerCase()).first())throw new TrackingError(409,"That username is already in use. Choose another.");
  if(input.deviceId){if(!await db().prepare("SELECT id FROM tracking_devices WHERE id=? AND owner_id=?").bind(deviceId,owner).first())throw new TrackingError(404,"Driver not found in your office.");}
  const passwordHash=await bcrypt.hash(password,12);
  const statements=[db().prepare("INSERT INTO company_accounts(id,owner_id,username,username_key,password_hash,role,device_id,phone,enabled,version,created_at,updated_at) SELECT ?,?,?,?,?,'rider',?,?,1,1,?,? WHERE (SELECT COUNT(*) FROM tracking_devices WHERE owner_id=?)<50 OR ?=1 RETURNING id").bind(id,owner,username,username.toLowerCase(),passwordHash,deviceId,input.phone,now,now,owner,Number(!!input.deviceId))];
  if(!input.deviceId)statements.push(db().prepare("INSERT INTO tracking_devices(id,owner_id,driver_name,vehicle_label,phone_label,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM company_accounts WHERE id=? AND owner_id=?)").bind(deviceId,owner,input.driverName,input.vehicleLabel,input.phone,now,id,owner));
  else statements.push(db().prepare("UPDATE tracking_devices SET phone_label=? WHERE id=? AND owner_id=? AND EXISTS(SELECT 1 FROM company_accounts WHERE id=? AND owner_id=?)").bind(input.phone,deviceId,owner,id,owner));
  if(input.deviceId)statements.push(db().prepare("UPDATE office_driver_profiles SET profile_json=json_set(profile_json,'$.phone',?),updated_at=? WHERE device_id=? AND owner_id=? AND EXISTS(SELECT 1 FROM company_accounts WHERE id=? AND owner_id=?)").bind(input.phone,now,deviceId,owner,id,owner));
  let rows;try{rows=await db().batch(statements);}catch(e){if(e instanceof Error&&/UNIQUE constraint/.test(e.message))throw new TrackingError(409,"That username or driver already has an account.");throw e;}
  if(!rows[0].results.length)throw new TrackingError(409,"The fleet limit is 50 drivers.");
  return {deviceId,driverName:input.driverName,username,password};
}
export async function resetDriverPassword(owner:string,payload:unknown){
  const id=typeof payload==="object"&&payload!==null&&"id" in payload?String(payload.id):"";
  const password=randomSecret(12),hash=await bcrypt.hash(password,12),now=Date.now();
  const rows=await db().batch<Record<string,unknown>>([
    db().prepare("UPDATE company_accounts SET password_hash=?,enabled=1,version=version+1,updated_at=? WHERE id=? AND owner_id=? AND role='rider' RETURNING username,device_id").bind(hash,now,id,owner),
    db().prepare("UPDATE driver_runtime SET on_duty=0 WHERE owner_id=? AND device_id=(SELECT device_id FROM company_accounts WHERE id=? AND owner_id=?)").bind(owner,id,owner),
    db().prepare("UPDATE office_driver_profiles SET profile_json=json_set(profile_json,'$.onDuty',json('false')),updated_at=? WHERE owner_id=? AND device_id=(SELECT device_id FROM company_accounts WHERE id=? AND owner_id=? AND role='rider')").bind(now,owner,id,owner),
    db().prepare("UPDATE tracking_devices SET token_hash=NULL WHERE owner_id=? AND id=(SELECT device_id FROM company_accounts WHERE id=? AND owner_id=? AND role='rider')").bind(owner,id,owner),
    db().prepare("DELETE FROM rider_logins WHERE account_id=? AND EXISTS(SELECT 1 FROM company_accounts WHERE id=? AND owner_id=? AND role='rider')").bind(id,id,owner),
  ]);
  const account=rows[0].results[0];if(!account)throw new TrackingError(404,"Driver login not found in your office.");return {username:account.username,password,deviceId:account.device_id};
}
