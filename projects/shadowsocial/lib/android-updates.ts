import type {Identity} from "./social-api";
type Release={version:string;versionCode:number;bytes:number;sha256:string;supportedAbis:string[];minSdk:number;downloadPath:string;uploadedAt:string};
type Policy={enabled:boolean;latestVersion:string;critical:boolean;notes:string;revision:string};
const defaults:Policy={enabled:true,latestVersion:"v0.4.0",critical:false,notes:"Calls, live streaming and updates managed by SHADOWNET.",revision:"default"};
const versionPattern=/^v\d{1,4}\.\d{1,4}\.\d{1,4}$/;
const abis=["arm64-v8a","armeabi-v7a","x86_64"];
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
function release(object:R2Object|null):Release|null{
 if(!object)return null;
 const version=object.key.replace(/^android\//,"").replace(/\.apk$/,""),m=object.customMetadata??{};
 const legacy=version==="v0.3.0"&&m.sha256==="093f9d1d475206af1d25aa3f76e3df7baf19325339f3d7431c6ddde9b4db193a";
 const versionCode=Number(m.versionCode??(legacy?4:0)),minSdk=Number(m.minSdk??26);
 const supportedAbis=(m.supportedAbis??(legacy?"arm64-v8a":"")).split(",").filter(x=>abis.includes(x));
 if(!versionPattern.test(version)||!Number.isSafeInteger(versionCode)||versionCode<1||!Number.isInteger(minSdk)||minSdk<26||!supportedAbis.length||!/^[a-f0-9]{64}$/.test(m.sha256??"")||object.size<1000000||object.size>100*1024*1024)return null;
 return {version,versionCode,minSdk,supportedAbis,sha256:m.sha256,bytes:object.size,downloadPath:"/api/android/"+version,uploadedAt:object.uploaded.toISOString()};
}
export async function handleAndroidUpdates(req:Request,env:{DB:D1Database;BUCKET:R2Bucket;ownerEmail:string},identity:Identity=null){
 const url=new URL(req.url),office=url.pathname==="/api/office/app-updates";
 const stored=await env.DB.prepare("SELECT value FROM settings WHERE id='android_updates'").first<{value:string}>();
 const policy:Policy=stored?{...defaults,...JSON.parse(stored.value)}:{...defaults};
 if(!office){
  if(req.method!=="GET")return json({error:"Method not allowed."},405);
  let current=release(await env.BUCKET.head("android/"+policy.latestVersion+".apk"));
  if(!stored&&!current)current=release(await env.BUCKET.head("android/v0.3.0.apk"));
  return json({enabled:policy.enabled,critical:policy.critical,notes:policy.notes,release:policy.enabled?current:null});
 }
 if(!identity)return json({error:"Sign in to continue."},401);
 const actor=await env.DB.prepare("SELECT id,email,role,status FROM profiles WHERE id=?").bind(identity.userId).first<{id:string;email:string;role:string;status:string}>();
 if(!actor||actor.role!=="owner"||actor.status!=="active"||!env.ownerEmail||actor.email.toLowerCase()!==env.ownerEmail.toLowerCase()||identity.email.toLowerCase()!==env.ownerEmail.toLowerCase())return json({error:"Only the platform owner can manage Android releases."},403);
 if(req.method==="GET"){
  const listed=await env.BUCKET.list({prefix:"android/",limit:100});
  const objects:(R2Object|null)[]=[];for(let start=0;start<listed.objects.length;start+=10)objects.push(...await Promise.all(listed.objects.slice(start,start+10).map(o=>env.BUCKET.head(o.key))));
  const releases=objects.map(release).filter((x):x is Release=>!!x).sort((a,b)=>b.versionCode-a.versionCode);
  return json({policy:!stored?{...policy,latestVersion:releases[0]?.version??policy.latestVersion}:policy,releases});
 }
 if(req.method!=="POST")return json({error:"Method not allowed."},405);
 if((req.headers.get("origin")&&req.headers.get("origin")!==url.origin)||req.headers.get("sec-fetch-site")==="cross-site")return json({error:"Cross-site request rejected."},403);
 const reader=req.body?.getReader();if(!reader)return json({error:"Expected release settings."},400);
 let size=0,raw="";const decoder=new TextDecoder();
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>12000){await reader.cancel();return json({error:"Settings are too large."},413)}raw+=decoder.decode(value,{stream:true})}
 let b:Record<string,unknown>;try{b=JSON.parse(raw+decoder.decode());if(!b||typeof b!=="object"||Array.isArray(b))throw Error()}catch{return json({error:"Invalid JSON."},400)}
 if(typeof b.enabled!=="boolean"||typeof b.critical!=="boolean"||typeof b.latestVersion!=="string"||!versionPattern.test(b.latestVersion)||typeof b.notes!=="string"||b.notes.length>2000||typeof b.reason!=="string"||b.reason.trim().length<8||b.reason.length>500)return json({error:"Choose a published release, valid settings and a reason of 8–500 characters."},400);
 if(b.revision!==policy.revision)return json({error:"Settings changed. Refresh before saving."},409);
 const chosen=release(await env.BUCKET.head("android/"+b.latestVersion+".apk"));
 if(!chosen)return json({error:"That verified Android release is not published."},400);
 const next:Policy={enabled:b.enabled,critical:b.critical,latestVersion:b.latestVersion,notes:b.notes.trim(),revision:crypto.randomUUID()};
 const value=JSON.stringify(next);
 const results=await env.DB.batch([
  env.DB.prepare("INSERT INTO settings(id,value) VALUES('android_updates',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value WHERE json_extract(settings.value,'$.revision')=?").bind(value,policy.revision),
  env.DB.prepare("INSERT INTO audit(id,actor,action,target,reason,created_at) SELECT ?,?,'android.release.settings',?,?,? WHERE (SELECT value FROM settings WHERE id='android_updates')=?").bind(crypto.randomUUID(),actor.id,next.latestVersion,b.reason.trim(),Date.now(),value)
 ]);
 if(!results[0].meta.changes)return json({error:"Settings changed. Refresh before saving."},409);
 return json({ok:true,policy:next});
}
