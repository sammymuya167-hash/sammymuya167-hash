import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler/package.json')),{Miniflare}=wr('miniflare'),{build}=wr('esbuild');
const bundle=await build({stdin:{contents:"export{handleAndroidUpdates}from './lib/android-updates.ts';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false});
const source=bundle.outputFiles[0].text.replace(/export\s*\{[^}]+\};?\s*$/,'')+`\nexport default{fetch(req,env){const user=req.headers.get('x-test-user');return handleAndroidUpdates(req,{...env,ownerEmail:'owner@example.test'},user?{userId:user,email:user+'@example.test',displayName:user}:null)}};`;
const mf=new Miniflare({modules:true,script:source,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET']});
const db=await mf.getD1Database('DB'),bucket=await mf.getR2Bucket('BUCKET');
for(const f of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())for(const s of readFileSync('drizzle/'+f,'utf8').split('--> statement-breakpoint'))if(s.trim())await db.prepare(s).run();
for(const [id,role] of [['owner','owner'],['admin','admin'],['alice','member']])await db.prepare('INSERT INTO profiles(id,email,username,name,role,terms,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,id+'@example.test',id,id,role,'2026-10-15',Date.now()).run();
let passed=0;const eq=(a,b)=>{assert.deepEqual(a,b);passed++};
async function call(path='',data,user,extra={}){const r=await mf.dispatchFetch('https://social.test/api/'+(path||'app-updates'),{method:data===undefined?'GET':'POST',headers:{'content-type':'application/json',...(user?{'x-test-user':user}:{}),...extra},body:data===undefined?undefined:JSON.stringify(data)});return {status:r.status,b:await r.json()}}
const settings={enabled:true,critical:false,latestVersion:'v0.4.0',notes:'Managed native updates',reason:'Release tested and approved',revision:'default'};
try{
 eq((await call()).status,200);eq((await call()).b.release,null);
 eq((await call('office/app-updates')).status,401);
 eq((await call('office/app-updates',undefined,'alice')).status,403);
 eq((await call('office/app-updates',undefined,'admin')).status,403);
 eq((await call('office/app-updates',settings,'owner')).status,400);
 await bucket.put('android/v0.4.0.apk',new Uint8Array(1000010),{customMetadata:{versionCode:'5',supportedAbis:'arm64-v8a',sha256:'a'.repeat(64),minSdk:'26'}});
 await bucket.put('android/v9.0.0.apk',new Uint8Array(1000010),{customMetadata:{versionCode:'90',supportedAbis:'arm64-v8a',sha256:'invalid'}});
 const available=await call();eq(available.b.release.versionCode,5);eq(available.b.release.downloadPath,'/api/android/v0.4.0');
 eq((await call('office/app-updates',undefined,'owner')).b.releases.length,1);
 eq((await call('office/app-updates',{...settings,latestVersion:'https://evil.test/app.apk'},'owner')).status,400);
 eq((await call('office/app-updates',{...settings,notes:'x'.repeat(2001)},'owner')).status,400);
 eq((await call('office/app-updates',{...settings,reason:'tiny'},'owner')).status,400);
 eq((await call('office/app-updates',settings,'owner',{origin:'https://evil.test'})).status,403);
 const saved=await call('office/app-updates',{...settings,critical:true},'owner');eq(saved.status,200);eq((await call()).b.critical,true);
 eq((await call('office/app-updates',settings,'owner')).status,409);
 eq((await db.prepare("SELECT COUNT(*) n FROM audit WHERE action='android.release.settings'").first()).n,1);
 const disabled=await call('office/app-updates',{...settings,enabled:false,revision:saved.b.policy.revision},'owner');eq(disabled.status,200);
 eq((await call()).b.release,null);eq((await call()).b.enabled,false);
 await db.prepare("UPDATE profiles SET status='banned' WHERE id='owner'").run();
 eq((await call('office/app-updates',undefined,'owner')).status,403);
 eq((await call()).status,200);
 console.log(JSON.stringify({passed,scope:'Public update checks, owner-only release policy, published metadata, CSRF, audit, conflict protection, pause and restricted owner'}));
}finally{await mf.dispose()}
