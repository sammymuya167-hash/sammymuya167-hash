import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler/package.json')),{Miniflare}=wr('miniflare'),{build}=wr('esbuild');
const bundle=await build({stdin:{contents:"export{handleRtc,sweepRtc}from './lib/rtc.ts';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false});
const source=bundle.outputFiles[0].text.replace(/export\s*\{[^}]+\};?\s*$/,'')+`
export default{async fetch(req,env){const user=req.headers.get('x-test-user');return handleRtc(req,{DB:env.DB,appId:env.SFU_APP,appSecret:env.SFU_SECRET,turnId:env.TURN_ID,turnSecret:env.TURN_SECRET},user?{userId:user,email:user+'@example.test',displayName:user}:null)}};
`;
const mf=new Miniflare({modules:true,script:source,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{SFU_APP:process.env.SFU_APP||'test',SFU_SECRET:process.env.SFU_SECRET||'test',TURN_ID:process.env.TURN_ID||'test',TURN_SECRET:process.env.TURN_SECRET||'test'}});
const db=await mf.getD1Database('DB');
for(const f of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())for(const s of readFileSync('drizzle/'+f,'utf8').split('--> statement-breakpoint'))if(s.trim())await db.prepare(s).run();
for(const [id,role,privacy] of [['alice','member',0],['bob','member',0],['carol','member',0],['owner','owner',0],['moderator','moderator',0],['private','member',1]])await db.prepare('INSERT INTO profiles(id,email,username,name,role,private,terms,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,id+'@example.test',id,id,role,privacy,'2026-10-15',Date.now()).run();
for(const [a,b] of [['alice','bob'],['bob','alice']])await db.prepare("INSERT INTO follows(follower,following,state,created_at) VALUES(?,?,'accepted',?)").bind(a,b,Date.now()).run();
if(process.argv.includes('--serve')){
 const server=createServer(async(req,res)=>{try{let body=[];for await(const p of req)body.push(p);const r=await mf.dispatchFetch('http://localhost:8791'+req.url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(body)});res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));}catch{res.writeHead(500);res.end('test server failure');}});
 server.listen(8791,'127.0.0.1',()=>console.log('RTC integration server ready'));
 process.on('SIGTERM',async()=>{server.close();await mf.dispose();process.exit(0)});
}else{
 let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
 async function call(path,data,user='alice',headers={}){const r=await mf.dispatchFetch('https://social.test/api/rtc'+path,{method:data===undefined?'GET':'POST',headers:{'content-type':'application/json',...(user?{'x-test-user':user}:{}),...headers},body:data===undefined?undefined:JSON.stringify(data)});return {status:r.status,b:await r.json()};}
 try{
 eq((await call('',undefined,'')).status,401);
 eq((await call('/rooms',{kind:'voice',guest:'carol'})).status,403);
 eq((await call('/rooms',{kind:'voice',guest:'alice'})).status,400);
 eq((await call('/rooms',{kind:'video',guest:'bob'},'alice',{origin:'https://evil.test'})).status,403);
 const c=await call('/rooms',{kind:'voice',guest:'bob'});eq(c.status,201);const id=c.b.room.id;
 eq((await call('',undefined,'bob')).b.incoming[0].id,id);
 eq((await call('/rooms/'+id,undefined,'carol')).status,404);
 eq((await call('/rooms/'+id+'/end',{},'carol')).status,403);
 eq((await call('/rooms/'+id+'/accept',{},'alice')).status,409);
 eq((await call('/rooms/'+id+'/accept',{},'bob')).status,200);
 eq((await call('/rooms/'+id,undefined,'alice')).b.room.state,'active');
 eq((await call('/rooms',{kind:'video',guest:'bob'})).status,409);
 eq((await call('/rooms/'+id+'/publish',{connection:'random',sessionId:'arbitrary'},'alice')).status,409);
 eq((await call('/rooms/'+id+'/end',{},'bob')).status,200);
 eq((await call('/rooms/'+id,undefined,'alice')).b.room.state,'ended');
 eq((await call('/rooms/'+id+'/accept',{},'bob')).status,410);
 const l=await call('/rooms',{kind:'live',title:'A test live',audience:'followers'},'private');eq(l.status,201);const live=l.b.room.id;
 eq((await call('',undefined,'carol')).b.lives.length,0);
 eq((await call('/rooms/'+live,undefined,'carol')).status,403);
 await db.prepare("INSERT INTO follows(follower,following,state,created_at) VALUES('carol','private','accepted',?)").bind(Date.now()).run();
 eq((await call('',undefined,'carol')).b.lives[0].id,live);
 eq((await call('/rooms/'+live,undefined,'carol')).status,200);
 eq((await call('/office',undefined,'carol')).status,403);
 eq((await call('/office',undefined,'moderator')).status,200);
 eq((await call('/office/'+live+'/end',{reason:'short'},'moderator')).status,400);
 eq((await call('/office/'+live+'/end',{reason:'Broadcast violates community rules'},'moderator')).status,200);
 eq((await call('/rooms/'+live,undefined,'carol')).b.room.state,'ended');
 eq((await db.prepare("SELECT COUNT(*) n FROM audit WHERE action='media.stopped'").first()).n,1);
 eq((await call('/office/settings',{callsEnabled:false,liveEnabled:false},'moderator')).status,403);
 eq((await call('/office/settings',{callsEnabled:false,liveEnabled:false},'owner')).status,200);
 eq((await call('/rooms',{kind:'live',title:'Paused'})).status,403);
 eq((await call('/rooms',{kind:'video',guest:'bob'})).status,403);
 await call('/office/settings',{callsEnabled:true,liveEnabled:true},'owner');
 const c2=await call('/rooms',{kind:'video',guest:'bob'});eq(c2.status,201);
 await db.prepare("UPDATE rtc_rooms SET expires_at=0 WHERE id=?").bind(c2.b.room.id).run();
 await call('');eq((await call('/rooms/'+c2.b.room.id,undefined,'bob')).b.room.state,'ended');
 const l2=await call('/rooms',{kind:'live',title:'Public live'});eq(l2.status,201);
 eq((await call('',undefined,'carol')).b.lives[0].id,l2.b.room.id);
 await db.prepare("UPDATE profiles SET status='banned' WHERE id='alice'").run();
 await call('',undefined,'owner');
 eq((await call('/office',undefined,'owner')).b.rooms.find(r=>r.id===l2.b.room.id).state,'ended');
 eq((await call('')).status,403);
 await db.prepare("UPDATE profiles SET status='active' WHERE id='alice'").run();
 const c3=await call('/rooms',{kind:'voice',guest:'bob'});eq(c3.status,201);
 await db.prepare("INSERT INTO blocks(owner,target) VALUES('bob','alice')").run();
 await call('',undefined,'owner');
 eq((await call('/office',undefined,'owner')).b.rooms.find(r=>r.id===c3.b.room.id).state,'ended');
 eq((await call('/rooms',{kind:'voice',guest:'bob'})).status,403);
 eq((await db.prepare("SELECT COUNT(*) n FROM rtc_presence").first()).n,0);
 console.log(JSON.stringify({passed:checks,scope:'Call state, mutual following, privacy, blocks, bans, expiry, busy protection, office controls, audit and CSRF'}));
 }finally{await mf.dispose()}
}
