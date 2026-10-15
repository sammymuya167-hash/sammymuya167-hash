import {scrypt,timingSafeEqual} from "node:crypto";
import {Identity,POLICY_VERSION} from "./social-api";
const COOKIE="__Host-shadowsocial",TTL=30*86400000;
class AuthError extends Error{constructor(public status:number,message:string){super(message)}}
const fail=(s:number,m:string):never=>{throw new AuthError(s,m)};
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,"0")).join("");
export const digest=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s))),x=>x.toString(16).padStart(2,"0")).join("");
const equal=(a:string,b:string)=>{const x=new TextEncoder().encode(a),y=new TextEncoder().encode(b);return x.length===y.length&&timingSafeEqual(x,y)};
const hash=(p:string,s:string)=>new Promise<string>((resolve,reject)=>scrypt(p,s,32,{N:32768,r:8,p:3,maxmem:67108864},(e,k)=>e?reject(e):resolve("scrypt-v1$"+k.toString("hex"))));
const password=(v:unknown)=>{if(typeof v!=="string"||v.length<12||v.length>128)fail(400,"Use a password of 12–128 characters.");return v as string};
const email=(v:unknown)=>{const s=String(v??"").trim().toLowerCase();if(s.length>254||!/^\S+@\S+\.\S+$/.test(s))fail(400,"Enter a valid email address.");return s};
function token(req:Request){const h=req.headers.get("authorization");if(h){if(!/^Bearer [a-f0-9]{64}$/.test(h))fail(401,"Please sign in again.");return h.slice(7)}const v=req.headers.get("cookie")?.split(";").map(x=>x.trim()).find(x=>x.startsWith(COOKIE+"="))?.slice(COOKIE.length+1);if(v&&!/^[a-f0-9]{64}$/.test(v))fail(401,"Please sign in again.");return v}
function response(v:unknown,status=200,t?:string){return Response.json(v,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff",...(t!==undefined?{"Set-Cookie":COOKIE+"="+t+"; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age="+(t?2592000:0)}:{})}})}
export function authErrorResponse(e:unknown){return e instanceof AuthError?response({error:e.message},e.status,e.status===401?"":undefined):null}
export async function nativeIdentity(req:Request,db:D1Database):Promise<Identity|undefined>{const t=token(req);if(!t)return undefined;const p=await db.prepare("SELECT p.id,p.email,p.name,p.status FROM sessions s JOIN profiles p ON p.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?").bind(await digest(t),Date.now()).first<{id:string;email:string;name:string;status:string}>();if(!p||p.status==="deleted")fail(401,"Your session expired. Please sign in again.");return {userId:p!.id,email:p!.email,displayName:p!.name,authMethod:"password"}}
export async function handlePasswordAuth(req:Request,db:D1Database,hosted:Identity,ownerEmail:string){
 try{
 if(req.method!=="POST")return response({error:"Method not allowed."},405);
 const url=new URL(req.url),origin=req.headers.get("origin");if(origin&&origin!==url.origin||req.headers.get("sec-fetch-site")==="cross-site")fail(403,"Cross-site request rejected.");
 if(!ownerEmail)fail(503,"Owner configuration unavailable.");
 const q=(s:string,...v:unknown[])=>db.prepare(s).bind(...v);
 const issue=async(user:string,extra:Record<string,unknown>,expectedHash:string)=>{const t=random();const created=await q("INSERT INTO sessions(token_hash,user_id,expires_at,created_at) SELECT ?,user_id,?,? FROM credentials WHERE user_id=? AND password_hash=?",await digest(t),Date.now()+TTL,Date.now(),user,expectedHash).run();if(!created.meta.changes)fail(409,"Your password changed. Please sign in again.");await q("DELETE FROM sessions WHERE expires_at<?",Date.now()).run();return response({ok:true,token:t,...extra},200,t)};
 const action=url.pathname.split("/").pop();
 if(action==="logout"){const t=token(req);if(t)await q("DELETE FROM sessions WHERE token_hash=?",await digest(t)).run();return response({ok:true},200,"")}
 if(Number(req.headers.get("content-length"))>16000)fail(413,"Request too large.");let raw="";if(req.body){const r=req.body.getReader();while(true){const v=await r.read();if(v.done)break;raw+=new TextDecoder().decode(v.value);if(raw.length>16000){await r.cancel();fail(413,"Request too large.")}}}let b:Record<string,unknown>;try{b=JSON.parse(raw);if(!b||Array.isArray(b))throw 0}catch{fail(400,"Invalid JSON.")}
 const rate=async(label:string,key:string,max:number,ms=3600000)=>{const bucket=Math.floor(Date.now()/ms),id=await digest(label+":"+key+":"+bucket);const a=await q("INSERT INTO auth_limits(id,count,expires_at) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 WHERE count<?",id,(bucket+1)*ms,max).run();if(!a.meta.changes)fail(429,"Too many attempts. Please try again later.");await q("DELETE FROM auth_limits WHERE expires_at<?",Date.now()).run()};
 const ip=req.headers.get("cf-connecting-ip")??"unknown";
 if(action==="signup"){
 await rate("signup",ip,10);const e=email(b!.email),p=password(b!.password),username=String(b!.username??"").trim().toLowerCase(),name=String(b!.name??"").trim();
 if(!/^[a-z0-9_]{3,24}$/.test(username)||["admin","administrator","owner","office","support","shadownet","shadowsocial","moderator"].includes(username))fail(400,"Choose a username of 3–24 letters, numbers or underscores.");
 if(!name||name.length>60)fail(400,"Enter a display name of 1–60 characters.");if(b!.acceptRules!==true||b!.ageConfirmed!==true)fail(400,"Accept the rules and confirm you are at least 16.");
 const c=await q("SELECT value FROM settings WHERE id='platform'").first<{value:string}>();if(c&&JSON.parse(c.value).registrationOpen===false)fail(403,"Registration is temporarily paused.");
 if(e===ownerEmail.toLowerCase()||await q("SELECT id FROM profiles WHERE lower(email)=? OR username=?",e,username).first())fail(409,"That email or username is unavailable.");
 const uid="native_"+crypto.randomUUID(),salt=random(),recovery=random(),h=await hash(p,salt);
 await db.batch([q("INSERT INTO profiles(id,email,username,name,role,terms,created_at) VALUES(?,?,?,?,'member',?,?)",uid,e,username,name,POLICY_VERSION,Date.now()),q("INSERT INTO credentials(user_id,email,password_hash,salt,recovery_hash,created_at) VALUES(?,?,?,?,?,?)",uid,e,h,salt,await digest(recovery),Date.now()),q("INSERT INTO audit(id,actor,action,target,reason,created_at) VALUES(?,?,?,?,?,?)",crypto.randomUUID(),uid,"account.created",uid,"Native account; community rules accepted",Date.now())]);return await issue(uid,{recoveryCode:recovery},h);
 }
 if(action==="login"){
 const key=String(b!.email??"").trim().toLowerCase();if(!key||key.length>254)fail(400,"Enter your email or username.");await rate("login-ip",ip,60,900000);await rate("login-account",key,8,900000);
 const c=await q("SELECT c.*,p.status FROM credentials c JOIN profiles p ON p.id=c.user_id WHERE c.email=? OR p.username=?",key,key).first<{user_id:string;password_hash:string;salt:string;status:string}>();
 const got=await hash(String(b!.password??"").slice(0,129),c?.salt??"shadowsocial-unknown-account-salt");if(!c||!equal(got,c.password_hash)||c.status==="deleted")fail(401,"Email, username or password is incorrect.");return await issue(c!.user_id,{},c!.password_hash);
 }
 if(action==="recover"){
 const e=email(b!.email);await rate("recover",e,5);const c=await q("SELECT c.*,p.status FROM credentials c JOIN profiles p ON p.id=c.user_id WHERE c.email=?",e).first<{user_id:string;recovery_hash:string;status:string}>();
 const code=String(b!.recoveryCode??"");if(!/^[a-f0-9]{64}$/.test(code)||!c||c.status==="deleted"||!equal(await digest(code),c.recovery_hash))fail(401,"Email or recovery code is incorrect.");
 const salt=random(),recovery=random(),h=await hash(password(b!.password),salt),next=await digest(recovery);
 const updated=await q("UPDATE credentials SET password_hash=?,salt=?,recovery_hash=? WHERE user_id=? AND recovery_hash=?",h,salt,next,c!.user_id,c!.recovery_hash).run();if(!updated.meta.changes)fail(409,"This recovery code has already been used.");await q("DELETE FROM sessions WHERE user_id=?",c!.user_id).run();return await issue(c!.user_id,{recoveryCode:recovery},h);
 }
 if(action==="owner-access"){
 if(!hosted||hosted.authMethod==="password"||hosted.email.toLowerCase()!==ownerEmail.toLowerCase())fail(403,"Use the verified owner session to set up app access.");
 const p=await q("SELECT role FROM profiles WHERE id=?",hosted!.userId).first<{role:string}>();if(p?.role!=="owner")fail(409,"Create your owner profile in the office first.");
 await rate("owner-link",hosted!.userId,5);const e=ownerEmail.toLowerCase(),salt=random(),recovery=random(),h=await hash(password(b!.password),salt);
 await db.batch([q("INSERT INTO credentials(user_id,email,password_hash,salt,recovery_hash,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,password_hash=excluded.password_hash,salt=excluded.salt,recovery_hash=excluded.recovery_hash",hosted!.userId,e,h,salt,await digest(recovery),Date.now()),q("DELETE FROM sessions WHERE user_id=?",hosted!.userId),q("INSERT INTO audit(id,actor,action,target,reason,created_at) VALUES(?,?,?,?,?,?)",crypto.randomUUID(),hosted!.userId,"owner.app-access",hosted!.userId,"Owner set native password from verified session",Date.now())]);return response({ok:true,recoveryCode:recovery});
 }
 if(action==="change-password"){
 const a=await nativeIdentity(req,db);if(!a)fail(401,"Sign in first.");await rate("password-change",a!.userId,5);const c=await q("SELECT * FROM credentials WHERE user_id=?",a!.userId).first<{password_hash:string;salt:string}>();if(!c||!equal(await hash(String(b!.currentPassword??""),c.salt),c.password_hash))fail(401,"Current password is incorrect.");const salt=random(),recovery=random(),h=await hash(password(b!.password),salt);await db.batch([q("UPDATE credentials SET password_hash=?,salt=?,recovery_hash=? WHERE user_id=?",h,salt,await digest(recovery),a!.userId),q("DELETE FROM sessions WHERE user_id=?",a!.userId)]);return await issue(a!.userId,{recoveryCode:recovery},h);
 }
 return response({error:"Endpoint not found."},404);
 }catch(e){const r=authErrorResponse(e);if(r)return r;console.error(JSON.stringify({event:"auth.error",message:e instanceof Error?e.message:"Unknown"}));return response({error:"Unable to complete this request. Try again."},500)}
}
