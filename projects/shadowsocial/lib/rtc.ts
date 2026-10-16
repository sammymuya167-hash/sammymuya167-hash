import type {Identity} from "./social-api";
export type RtcBindings={DB:D1Database;appId:string;appSecret:string;turnId:string;turnSecret:string};
type Room={id:string;host:string;guest:string|null;kind:string;title:string;audience:string;state:string;created_at:number;updated_at:number;expires_at:number;ended_reason:string};
type Member={room:string;user:string;connection:string;pub_session:string|null;sub_session:string|null;pub_tracks:string;sub_tracks:string;ready:number;heartbeat:number;lock_until:number};
type Track={mid:string;trackName:string;location?:string;sessionId?:string;errorCode?:string};
type Provider={sessionId?:string;sessionDescription?:{type:string;sdp:string};tracks?:Track[];errorCode?:string;requiresImmediateRenegotiation?:boolean};
class RtcError extends Error{constructor(public status:number,message:string){super(message)}}
const fail=(status:number,message:string):never=>{throw new RtcError(status,message)};
const reply=(b:unknown,status=200)=>Response.json(b,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
const active=(p:{status:string;suspended_until:number|null}|null)=>!!p&&(p.status==="active"||(p.status==="suspended"&&!!p.suspended_until&&p.suspended_until<=Date.now()));
async function read(req:Request):Promise<Record<string,unknown>>{
 const reader=req.body?.getReader();if(!reader)return {};let size=0,out="";const dec=new TextDecoder();
 while(true){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>65536){await reader.cancel();fail(413,"Request too large.")}out+=dec.decode(r.value,{stream:true})}out+=dec.decode();
 try{const v=JSON.parse(out);if(!v||typeof v!=="object"||Array.isArray(v))fail(400,"Expected an object.");return v}catch{ return fail(400,"Invalid JSON.")}
}
async function upstream(env:RtcBindings,path:string,body?:unknown,method="POST"):Promise<Provider>{
 const r=await fetch("https://rtc.live.cloudflare.com/v1/apps/"+env.appId+path,{method,headers:{Authorization:"Bearer "+env.appSecret,"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(18000)});
 const b=await r.json() as Provider;if(!r.ok||b.errorCode)fail(502,"Media service could not connect. Leave and try again.");return b;
}
const tracks=(s:string):Track[]=>{try{return JSON.parse(s)}catch{return []}};
export async function endRtcRoom(env:RtcBindings,room:Room,reason:string){
 const db=env.DB;
 // Keep closure locators until the provider confirms. Ending blocks all new media access immediately.
 await db.batch([db.prepare("UPDATE rtc_rooms SET state='ended',ended_reason=?,updated_at=? WHERE id=?").bind(reason,Date.now(),room.id),db.prepare("DELETE FROM rtc_presence WHERE room=?").bind(room.id)]);
 const members=(await db.prepare("SELECT * FROM rtc_members WHERE room=?").bind(room.id).all<Member>()).results;
 for(const m of members){
  for(const [session,list,column] of [[m.pub_session,tracks(m.pub_tracks),"pub_tracks"],[m.sub_session,tracks(m.sub_tracks),"sub_tracks"]] as const){
   if(!session||!list.length)continue;
   try{const r=await upstream(env,"/sessions/"+session+"/tracks/close",{tracks:list.map(t=>({mid:t.mid})),force:true},"PUT");
    if(!r.tracks?.some(t=>t.errorCode&&t.errorCode!=="track_not_found"&&t.errorCode!=="close_track_error"))await db.prepare("UPDATE rtc_members SET "+column+"='[]',ready=0 WHERE room=? AND user=?").bind(room.id,m.user).run();
   }catch{console.error(JSON.stringify({event:"rtc.cleanup.retry",room:room.id}))}
  }
 }
}
export async function sweepRtc(env:RtcBindings){
 const db=env.DB,now=Date.now();
 const rooms=(await db.prepare("SELECT * FROM rtc_rooms WHERE state!='ended' OR (state='ended' AND EXISTS(SELECT 1 FROM rtc_members m WHERE m.room=rtc_rooms.id AND (m.pub_tracks!='[]' OR m.sub_tracks!='[]'))) ORDER BY created_at DESC LIMIT 100").all<Room>()).results;
 for(const r of rooms){
  if(r.state==="ended"){await endRtcRoom(env,r,r.ended_reason);continue}
  const host=await db.prepare("SELECT status,suspended_until FROM profiles WHERE id=?").bind(r.host).first<{status:string;suspended_until:number|null}>();
  let invalid=!active(host);
  if(r.guest){
   const guest=await db.prepare("SELECT status,suspended_until FROM profiles WHERE id=?").bind(r.guest).first<{status:string;suspended_until:number|null}>();
   const blocked=await db.prepare("SELECT 1 FROM blocks WHERE (owner=? AND target=?) OR (owner=? AND target=?)").bind(r.host,r.guest,r.guest,r.host).first();
   const mutual=await db.prepare("SELECT COUNT(*) n FROM follows WHERE ((follower=? AND following=?) OR (follower=? AND following=?)) AND state='accepted'").bind(r.host,r.guest,r.guest,r.host).first<{n:number}>();
   invalid=invalid||!active(guest)||!!blocked||mutual?.n!==2;
  }
  if(r.kind==="live"&&!invalid){
   const viewers=(await db.prepare("SELECT m.* FROM rtc_members m JOIN profiles p ON p.id=m.user JOIN profiles h ON h.id=? WHERE m.room=? AND m.user!=? AND (m.heartbeat<? OR NOT (p.status='active' OR (p.status='suspended' AND p.suspended_until<=?)) OR EXISTS(SELECT 1 FROM blocks WHERE (owner=m.user AND target=?) OR (target=m.user AND owner=?)) OR ((h.private=1 OR ?='followers') AND NOT EXISTS(SELECT 1 FROM follows WHERE follower=m.user AND following=? AND state='accepted')))").bind(r.host,r.id,r.host,now-75000,now,r.host,r.host,r.audience,r.host).all<Member>()).results;
   for(const m of viewers){if(m.sub_session&&tracks(m.sub_tracks).length){try{await upstream(env,"/sessions/"+m.sub_session+"/tracks/close",{tracks:tracks(m.sub_tracks).map(t=>({mid:t.mid})),force:true},"PUT");}catch{continue}}await db.prepare("DELETE FROM rtc_members WHERE room=? AND user=?").bind(r.id,m.user).run();}
  }
  if(invalid||r.expires_at<=now||r.updated_at<now-90000)await endRtcRoom(env,r,invalid?"Account access changed.":r.state==="ringing"?"Missed call.":"Session ended.");
 }
}
export async function handleRtc(req:Request,env:RtcBindings,identity:Identity):Promise<Response>{
 const db=env.DB,q=(s:string,...v:unknown[])=>db.prepare(s).bind(...v);
 try{
  if(!identity)fail(401,"Sign in first.");const uid=identity!.userId,url=new URL(req.url),p=url.pathname.split("/").slice(3),method=req.method;
  if(method!=="GET"&&((req.headers.get("origin")&&req.headers.get("origin")!==url.origin)||req.headers.get("sec-fetch-site")==="cross-site"))fail(403,"Cross-site request rejected.");
  const actor=await q("SELECT id,role,status,suspended_until,private FROM profiles WHERE id=?",uid).first<{id:string;role:string;status:string;suspended_until:number|null;private:number}>();
  if(!active(actor))fail(403,"Your account is restricted.");
  const staff=["owner","admin","moderator"].includes(actor!.role),owner=actor!.role==="owner";
  const cfg=await q("SELECT value FROM settings WHERE id='rtc'").first<{value:string}>(),config={callsEnabled:true,liveEnabled:true,...(cfg?JSON.parse(cfg.value):{})};
  const ready=!!(env.appId&&env.appSecret&&env.turnId&&env.turnSecret);
  const rate=async(key:string,max:number)=>{const id=uid+":rtc:"+key+":"+new Date().toISOString().slice(0,10);const r=await q("INSERT INTO limits(id,count) VALUES(?,1) ON CONFLICT(id) DO UPDATE SET count=count+1 WHERE count<?",id,max).run();if(!r.meta.changes)fail(429,"Daily media limit reached. Try tomorrow.")};
  const allowed=async(r:Room)=>{
   if(r.kind!=="live"){
    if(uid!==r.host&&uid!==r.guest)fail(404,"Call not found.");
    const peer=uid===r.host?r.guest:r.host;
    if(!await q("SELECT p.id FROM profiles p WHERE p.id=? AND (p.status='active' OR (p.status='suspended' AND p.suspended_until<=?)) AND NOT EXISTS(SELECT 1 FROM blocks WHERE (owner=? AND target=p.id) OR (target=? AND owner=p.id)) AND EXISTS(SELECT 1 FROM follows WHERE follower=? AND following=p.id AND state='accepted') AND EXISTS(SELECT 1 FROM follows WHERE follower=p.id AND following=? AND state='accepted')",peer,Date.now(),uid,uid,uid,uid).first())fail(403,"Calls are available when you follow each other.");
   }else{
    const host=await q("SELECT status,suspended_until,private FROM profiles WHERE id=?",r.host).first<{status:string;suspended_until:number|null;private:number}>();
    if(!active(host))fail(404,"Broadcast unavailable.");
    if(uid===r.host)return;
    if(await q("SELECT 1 FROM blocks WHERE (owner=? AND target=?) OR (owner=? AND target=?)",uid,r.host,r.host,uid).first())fail(404,"Broadcast unavailable.");
    if((host!.private||r.audience==="followers")&&!await q("SELECT 1 FROM follows WHERE follower=? AND following=? AND state='accepted'",uid,r.host).first())fail(403,"Follow this creator to watch.");
   }
  };
  if(!p[0]&&method==="GET"){
   await sweepRtc(env);
   const incoming=(await q("SELECT r.*,u.name,u.username,u.avatar FROM rtc_rooms r JOIN profiles u ON u.id=r.host WHERE r.guest=? AND r.state='ringing' AND r.expires_at>? ORDER BY r.created_at DESC LIMIT 1",uid,Date.now()).all()).results;
   const lives=(await q("SELECT r.*,u.name,u.username,u.avatar,(SELECT COUNT(*) FROM rtc_members m WHERE m.room=r.id AND m.heartbeat>?) viewers FROM rtc_rooms r JOIN profiles u ON u.id=r.host WHERE r.kind='live' AND r.state='active' AND r.expires_at>? AND u.status='active' AND (r.host=? OR ((r.audience='public' AND u.private=0) OR EXISTS(SELECT 1 FROM follows WHERE follower=? AND following=r.host AND state='accepted'))) AND NOT EXISTS(SELECT 1 FROM blocks WHERE (owner=? AND target=r.host) OR (target=? AND owner=r.host)) ORDER BY r.created_at DESC LIMIT 40",Date.now()-45000,Date.now(),uid,uid,uid,uid).all()).results;
   const history=(await q("SELECT r.*,u.name,u.username,u.avatar FROM rtc_rooms r JOIN profiles u ON u.id=CASE WHEN r.host=? THEN r.guest ELSE r.host END WHERE r.kind!='live' AND (r.host=? OR r.guest=?) ORDER BY r.created_at DESC LIMIT 30",uid,uid,uid).all()).results;
   return reply({incoming,lives,history,config,ready});
  }
  if(p[0]==="office"){
   if(!staff)fail(403,"Staff access required.");
   if(p[1]==="settings"&&method==="POST"){
    if(!owner)fail(403,"Only the owner can change media settings.");const b=await read(req);
    if(typeof b.callsEnabled!=="boolean"||typeof b.liveEnabled!=="boolean")fail(400,"Choose the media settings.");
    await db.batch([q("INSERT INTO settings(id,value) VALUES('rtc',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",JSON.stringify({callsEnabled:b.callsEnabled,liveEnabled:b.liveEnabled})),q("INSERT INTO audit(id,actor,action,target,reason,created_at) VALUES(?,?,?,?,?,?)",crypto.randomUUID(),uid,"media.settings","platform","Owner updated calls and live availability",Date.now())]);
    if(!b.callsEnabled||!b.liveEnabled){const rs=(await q("SELECT * FROM rtc_rooms WHERE state!='ended'").all<Room>()).results;for(const r of rs)if((r.kind==="live"&&!b.liveEnabled)||(r.kind!=="live"&&!b.callsEnabled))await endRtcRoom(env,r,"Media paused by the owner.");}
    return reply({ok:true});
   }
   if(method==="GET"){await sweepRtc(env);return reply({rooms:(await q("SELECT r.*,u.username,u.name FROM rtc_rooms r JOIN profiles u ON u.id=r.host ORDER BY r.created_at DESC LIMIT 60").all()).results,config,ready})}
   if(p[2]==="end"&&method==="POST"){const b=await read(req),reason=String(b.reason??"").trim();if(reason.length<8||reason.length>500)fail(400,"Give a reason of 8–500 characters.");const r=await q("SELECT * FROM rtc_rooms WHERE id=?",p[1]).first<Room>();if(!r)fail(404,"Session not found.");await endRtcRoom(env,r!,reason);await q("INSERT INTO audit(id,actor,action,target,reason,created_at) VALUES(?,?,?,?,?,?)",crypto.randomUUID(),uid,"media.stopped",r!.id,reason,Date.now()).run();return reply({ok:true})}
  }
  if(p[0]!=="rooms")fail(404,"Not found.");
  if(!p[1]&&method==="POST"){
   if(!ready)fail(503,"Media service is not configured.");await sweepRtc(env);const b=await read(req),kind=String(b.kind??"");
   if(!["voice","video","live"].includes(kind))fail(400,"Choose voice, video or live.");
   if(kind==="live"?!config.liveEnabled:!config.callsEnabled)fail(403,"This media feature is paused.");
   const guest=kind==="live"?null:String(b.guest??"");if(guest===uid||kind!=="live"&&!guest)fail(400,"Choose another person.");
   const now=Date.now(),r:Room={id:crypto.randomUUID(),host:uid,guest,kind,title:kind==="live"?String(b.title??"Live with me").trim().slice(0,100):"",audience:kind==="live"&&(actor!.private||b.audience==="followers")?"followers":"public",state:kind==="live"?"active":"ringing",created_at:now,updated_at:now,expires_at:now+(kind==="live"?3600000:60000),ended_reason:""};
   await allowed(r);await rate(kind==="live"?"live":"calls",kind==="live"?5:30);
   const statements=[q("DELETE FROM rtc_presence WHERE expires_at<?",now),q("INSERT INTO rtc_rooms(id,host,guest,kind,title,audience,state,created_at,updated_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)",r.id,uid,guest,kind,r.title,r.audience,r.state,now,now,r.expires_at),q("INSERT INTO rtc_presence(user,room,expires_at) VALUES(?,?,?)",uid,r.id,r.expires_at)];
   if(guest)statements.push(q("INSERT INTO rtc_presence(user,room,expires_at) VALUES(?,?,?)",guest,r.id,r.expires_at));
   try{await db.batch(statements)}catch{fail(409,"You or this person is already in a call or live session.")}
   return reply({room:r},201);
  }
  const room=await q("SELECT * FROM rtc_rooms WHERE id=?",p[1]).first<Room>();if(!room)fail(404,"Session not found.");const r=room!;
  if(p[2]==="end"&&method==="POST"){
   if(uid!==r.host&&uid!==r.guest)fail(403,"Only a participant can end this session.");
   await endRtcRoom(env,r,r.state==="ringing"&&uid===r.guest?"Call declined.":"Session ended.");return reply({ok:true});
  }
  await allowed(r);
  if(r.state!=="ended"&&(r.expires_at<Date.now()||r.updated_at<Date.now()-90000)){await endRtcRoom(env,r,"Session expired.");r.state="ended";}
  if(!p[2]&&method==="GET"){
   return reply({room:r,published:(await q("SELECT user,ready FROM rtc_members WHERE room=? AND ready=1 AND user!=?",r.id,uid).all()).results,viewers:(await q("SELECT COUNT(*) n FROM rtc_members WHERE room=? AND user!=? AND heartbeat>?",r.id,r.host,Date.now()-45000).first<{n:number}>())?.n??0});
  }
  if(r.state==="ended")fail(410,r.ended_reason||"Session ended.");
  if(p[2]==="accept"&&method==="POST"){
   if(uid!==r.guest||r.state!=="ringing")fail(409,"Call is no longer ringing.");
   const until=Date.now()+3600000;const changed=await q("UPDATE rtc_rooms SET state='active',updated_at=?,expires_at=? WHERE id=? AND state='ringing' AND expires_at>?",Date.now(),until,r.id,Date.now()).run();if(!changed.meta.changes)fail(409,"Call expired.");
   await q("UPDATE rtc_presence SET expires_at=? WHERE room=?",until,r.id).run();return reply({ok:true});
  }
  if(r.state!=="active")fail(409,"Waiting for the other person to accept.");
  if(!ready)fail(503,"Media service is not configured.");
  const b=method==="POST"?await read(req):{};
  if(p[2]==="join"&&method==="POST"){
   const existing=await q("SELECT * FROM rtc_members WHERE room=? AND user=?",r.id,uid).first<Member>();if(existing)fail(409,"This session is already open. Leave it before joining again.");
   const count=await q("SELECT COUNT(*) n FROM rtc_members WHERE room=? AND heartbeat>?",r.id,Date.now()-45000).first<{n:number}>();if(r.kind==="live"&&uid!==r.host&&(count?.n??0)>=31)fail(409,"This live session is full. Try again soon.");
   await rate("joins",100);const connection=crypto.randomUUID();
   const joined=await q("INSERT INTO rtc_members(room,user,connection,heartbeat) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM rtc_members WHERE room=? AND heartbeat>?)<?",r.id,uid,connection,Date.now(),r.id,Date.now()-45000,r.kind==="live"?31:2).run();if(!joined.meta.changes)fail(409,"This live session is full.");
   try{const turn=await fetch("https://rtc.live.cloudflare.com/v1/turn/keys/"+env.turnId+"/credentials/generate-ice-servers",{method:"POST",headers:{Authorization:"Bearer "+env.turnSecret,"Content-Type":"application/json"},body:JSON.stringify({ttl:3900}),signal:AbortSignal.timeout(15000)});if(!turn.ok)fail(502,"Could not prepare the media connection.");const ice=await turn.json() as {iceServers:unknown[]};return reply({connection,iceServers:ice.iceServers});}catch(e){await q("DELETE FROM rtc_members WHERE room=? AND user=? AND connection=?",r.id,uid,connection).run();throw e}
  }
  const m=await q("SELECT * FROM rtc_members WHERE room=? AND user=? AND connection=?",r.id,uid,String(b.connection??"")).first<Member>();if(!m)fail(409,"Rejoin this session.");
  if(p[2]==="heartbeat"&&method==="POST"){await db.batch([q("UPDATE rtc_members SET heartbeat=? WHERE room=? AND user=?",Date.now(),r.id,uid),...(uid===r.host||r.kind!=="live"?[q("UPDATE rtc_rooms SET updated_at=? WHERE id=? AND state='active'",Date.now(),r.id)]:[])]);return reply({ok:true})}
  if(p[2]==="leave"&&method==="POST"){
   if(uid===r.host||r.kind!=="live")await endRtcRoom(env,r,"Session ended.");
   else{await endMember(m!);await q("DELETE FROM rtc_members WHERE room=? AND user=?",r.id,uid).run()}return reply({ok:true});
  }
  async function endMember(member:Member){for(const [session,list] of [[member.pub_session,tracks(member.pub_tracks)],[member.sub_session,tracks(member.sub_tracks)]] as const)if(session&&list.length)await upstream(env,"/sessions/"+session+"/tracks/close",{tracks:list.map(t=>({mid:t.mid})),force:true},"PUT")}
  const lock=await q("UPDATE rtc_members SET lock_until=? WHERE room=? AND user=? AND lock_until<?",Date.now()+25000,r.id,uid,Date.now()).run();if(!lock.meta.changes)fail(409,"Media negotiation is already running.");
  try{
   if(p[2]==="publish"&&method==="POST"){
    if(r.kind==="live"&&uid!==r.host)fail(403,"Only the host can broadcast.");
    if(m!.pub_session)fail(409,"Media is already published. Leave and rejoin to reconnect.");
    const d=b.sessionDescription as {type?:string;sdp?:string};if(d?.type!=="offer"||typeof d.sdp!=="string"||d.sdp.length>58000||/m=application/.test(d.sdp)||r.kind==="voice"&&/m=video/.test(d.sdp))fail(400,"Invalid media offer.");
    const local=b.tracks as {mid:string;kind:string}[];if(!Array.isArray(local)||local.length<1||local.length>2||local.some(t=>!/^\d{1,3}$/.test(t.mid)||!["audio","video"].includes(t.kind))||new Set(local.map(t=>t.kind)).size!==local.length||r.kind==="voice"&&local.some(t=>t.kind!=="audio"))fail(400,"Invalid publication.");
    const session=await upstream(env,"/sessions/new");if(!session.sessionId)fail(502,"Media allocation failed.");
    await q("UPDATE rtc_members SET pub_session=? WHERE room=? AND user=?",session.sessionId,r.id,uid).run();
    const result=await upstream(env,"/sessions/"+session.sessionId+"/tracks/new",{sessionDescription:d,tracks:local.map(t=>({location:"local",mid:t.mid,trackName:t.kind}))});
    await q("UPDATE rtc_members SET pub_tracks=? WHERE room=? AND user=?",JSON.stringify((result.tracks??[]).filter(t=>!t.errorCode)),r.id,uid).run();
    if(result.tracks?.some(t=>t.errorCode))fail(502,"Could not publish all media tracks.");
    const fresh=await q("SELECT state FROM rtc_rooms WHERE id=?",r.id).first<{state:string}>();if(fresh?.state!=="active"){await endRtcRoom(env,r,"Session ended.");fail(410,"Session ended.")}
    return reply(result);
   }
   if(p[2]==="ready"&&method==="POST"){if(!m!.pub_session||!tracks(m!.pub_tracks).length)fail(409,"Publish media first.");await q("UPDATE rtc_members SET ready=1 WHERE room=? AND user=?",r.id,uid).run();return reply({ok:true})}
   if(p[2]==="subscribe"&&method==="POST"){
    if(m!.sub_session)fail(409,"Already subscribed. Leave and rejoin to reconnect.");
    const source=await q("SELECT * FROM rtc_members WHERE room=? AND user!=? AND ready=1 AND heartbeat>? AND user=?",r.id,uid,Date.now()-45000,uid===r.host?r.guest:r.host).first<Member>();
    if(!source)fail(409,"Waiting for the other person's media.");
    const pub=tracks(source!.pub_tracks);if(!source!.pub_session||!pub.length)fail(409,"Waiting for media.");
    const session=await upstream(env,"/sessions/new");if(!session.sessionId)fail(502,"Media allocation failed.");
    await q("UPDATE rtc_members SET sub_session=? WHERE room=? AND user=?",session.sessionId,r.id,uid).run();
    const result=await upstream(env,"/sessions/"+session.sessionId+"/tracks/new",{tracks:pub.map(t=>({location:"remote",sessionId:source!.pub_session,trackName:t.trackName}))});
    await q("UPDATE rtc_members SET sub_tracks=? WHERE room=? AND user=?",JSON.stringify((result.tracks??[]).filter(t=>!t.errorCode)),r.id,uid).run();
    if(result.tracks?.some(t=>t.errorCode))fail(502,"Could not receive media tracks.");const fresh=await q("SELECT state FROM rtc_rooms WHERE id=?",r.id).first<{state:string}>();if(fresh?.state!=="active"){await endRtcRoom(env,r,"Session ended.");fail(410,"Session ended.")}return reply(result);
   }
   if(p[2]==="answer"&&method==="POST"){
    const d=b.sessionDescription as {type?:string;sdp?:string};if(!m!.sub_session||d?.type!=="answer"||typeof d.sdp!=="string"||d.sdp.length>58000)fail(400,"Invalid media answer.");
    return reply(await upstream(env,"/sessions/"+m!.sub_session+"/renegotiate",{sessionDescription:d},"PUT"));
   }
   return fail(404,"Not found.");
  }finally{await q("UPDATE rtc_members SET lock_until=0 WHERE room=? AND user=?",r.id,uid).run()}
 }catch(e){if(e instanceof RtcError)return reply({error:e.message},e.status);console.error(JSON.stringify({event:"rtc.error",message:e instanceof Error?e.message:"Unknown"}));return reply({error:"Media service unavailable. Try again."},503)}
}
