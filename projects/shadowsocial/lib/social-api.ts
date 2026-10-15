export type Identity = { userId: string; email: string; displayName: string } | null;
type Profile = { id:string; email:string; username:string; name:string; bio:string; avatar:string|null; role:string; status:string; private:number; suspended_until:number|null; reason:string; terms:string; created_at:number };
type Bindings = { DB:D1Database; BUCKET:R2Bucket; ownerEmail:string };
type Config = { registrationOpen:boolean; postingOpen:boolean; reviewNewPosts:boolean; announcement:string; maxPostsPerDay:number; blockedWords:string; rules:string };
const DEFAULTS:Config={registrationOpen:true,postingOpen:true,reviewNewPosts:false,announcement:"Welcome to ShadowSocial. Make your first connection.",maxPostsPerDay:20,blockedWords:"",rules:"Be kind. No harassment, hate, threats or impersonation.\nShare only content you own or have permission to share.\nNo sexual exploitation, explicit sexual content, violence or illegal activity.\nProtect personal information. No spam, scams or deceptive promotions.\nReport concerns. Moderators can remove content and restrict accounts.\nYou must be at least 16 to use ShadowSocial."};
export const POLICY_VERSION="2026-10-15";
class Failure extends Error { constructor(public status:number,message:string){super(message)} }
const fail=(status:number,message:string):never=>{throw new Failure(status,message)};
const id=()=>crypto.randomUUID();
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
function text(value:unknown,max:number,label:string,min=0){if(typeof value!=="string")fail(400,`${label} is required.`);const s=(value as string).trim();if(s.length<min||s.length>max)fail(400,`${label} must be ${min}–${max} characters.`);return s;}
async function body(req:Request){const data=await bounded(req,16000);try{const v=JSON.parse(new TextDecoder().decode(data));if(!v||typeof v!=="object"||Array.isArray(v))fail(400,"Expected an object.");return v as Record<string,unknown>}catch(e){if(e instanceof Failure)throw e;return fail(400,"Invalid JSON.")}}
async function bounded(req:Request,max:number){if(Number(req.headers.get("content-length"))>max)fail(413,"Upload is too large.");const reader=req.body?.getReader();if(!reader)fail(400,"Empty request.");const chunks:Uint8Array[]=[];let size=0;while(true){const part=await reader!.read();if(part.done)break;size+=part.value.length;if(size>max){await reader!.cancel();fail(413,"Upload is too large.")}chunks.push(part.value)}const out=new Uint8Array(size);let pos=0;for(const p of chunks){out.set(p,pos);pos+=p.length}return out;}
function imageType(b:Uint8Array){if(b.length<12)return null;if(b[0]===255&&b[1]===216&&b[2]===255)return "image/jpeg";if(b.slice(0,8).every((v,i)=>v===[137,80,78,71,13,10,26,10][i]))return "image/png";if(new TextDecoder().decode(b.slice(0,4))==="RIFF"&&new TextDecoder().decode(b.slice(8,12))==="WEBP")return "image/webp";return null;}
export async function handleSocial(req:Request,env:Bindings,identity:Identity):Promise<Response>{
 const db=env.DB,url=new URL(req.url),path=url.pathname.replace(/^\/api\/?/,""),parts=path.split("/"),method=req.method;
 const q=(s:string,...v:unknown[])=>db.prepare(s).bind(...v);
 const rows=async(s:string,...v:unknown[])=>(await q(s,...v).all<Record<string,unknown>>()).results;
 const one=async<T>(s:string,...v:unknown[])=>q(s,...v).first<T>();
 const active=(alias:string)=>`(${alias}.status='active' OR (${alias}.status='suspended' AND ${alias}.suspended_until IS NOT NULL AND ${alias}.suspended_until<=${Date.now()}))`;
 const safeProfile="p.id,p.username,p.name,p.bio,p.avatar,p.role,p.private,p.created_at";
 let actor:Profile|null=null;
 const isOwner=!!identity&&!!env.ownerEmail&&identity!.email.toLowerCase()===env.ownerEmail.toLowerCase();
 const owner=()=>{if(!isOwner||actor?.role!=="owner")fail(403,"Only the platform owner can do that.")};
 const staff=()=>{if(!actor||!["owner","admin","moderator"].includes(actor.role))fail(403,"Staff access required.")};
 const account=()=>{if(!identity)fail(401,"Sign in to continue.");if(!actor)fail(409,"Create your ShadowSocial profile first.");if(actor!.status==="deleted")fail(403,"This account has been deleted.");return actor!};
 const member=()=>{const a=account();if(a.status!=="active")fail(403,`Account ${a.status}. ${a.reason}`);return a};
 const config=async()=>{const s=await one<{value:string}>("SELECT value FROM settings WHERE id='platform'");return {...DEFAULTS,...(s?JSON.parse(s.value):{})} as Config};
 const log=(action:string,target:string,reason:string)=>q("INSERT INTO audit(id,actor,action,target,reason,created_at) VALUES(?,?,?,?,?,?)",id(),actor!.id,action,target,reason,Date.now());
 const note=(user:string,kind:string,target:string,body:string)=>q("INSERT INTO notifications(id,user,actor,kind,target,body,created_at) VALUES(?,?,?,?,?,?,?)",id(),user,actor?.id??null,kind,target,body,Date.now());
 const blocked=async(a:string,b:string)=>!!await one("SELECT 1 FROM blocks WHERE (owner=? AND target=?) OR (owner=? AND target=?)",a,b,b,a);
 const rate=async(action:string,maximum:number)=>{const key=`${actor!.id}:${action}:${new Date().toISOString().slice(0,10)}`;const result=await q("INSERT INTO limits(id,count) VALUES(?,1) ON CONFLICT(id) DO UPDATE SET count=count+1 WHERE count<?",key,maximum).run();if(!result.meta.changes)fail(429,`Daily ${action} limit reached. Try again tomorrow.`)};
 const content=(s:string,c:Config)=>{const words=c.blockedWords.split(",").map(w=>w.trim().toLowerCase()).filter(Boolean);if(words.some(w=>s.toLowerCase().includes(w)))fail(400,"Please edit this text to follow the community rules.")};
 const visibility=(p="p",u="u")=>`${p}.status='live' AND ${active(u)} AND (${u}.private=0 OR ${u}.id=? OR EXISTS(SELECT 1 FROM follows f WHERE f.follower=? AND f.following=${u}.id AND f.state='accepted')) AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.owner=? AND b.target=${u}.id) OR (b.target=? AND b.owner=${u}.id))`;
 const viewer=()=>[actor?.id??"",actor?.id??"",actor?.id??"",actor?.id??""];
 const visiblePost=async(post:string)=>one<{id:string;owner:string}>(`SELECT p.id,p.owner FROM posts p JOIN profiles u ON u.id=p.owner WHERE p.id=? AND ${visibility()}`,post,...viewer());
 try{
  if(!["GET","HEAD"].includes(method)){const origin=req.headers.get("origin");if(origin&&origin!==url.origin)fail(403,"Cross-site request rejected.");if(req.headers.get("sec-fetch-site")==="cross-site")fail(403,"Cross-site request rejected.")}
  if(!env.ownerEmail)fail(503,"Owner configuration is missing.");
  if(identity){actor=await one<Profile>("SELECT * FROM profiles WHERE id=?",identity!.userId);if(actor?.status==="suspended"&&actor.suspended_until&&actor.suspended_until<=Date.now()){await q("UPDATE profiles SET status='active',reason='',suspended_until=NULL WHERE id=? AND status='suspended' AND suspended_until<=?",actor.id,Date.now()).run();actor.status="active";actor.reason=""}}
  if(path==="me"&&method==="GET")return json({profile:actor,isOwner,identity:identity?{name:identity.displayName}:null,policyVersion:POLICY_VERSION,config:await config()});
  if(path==="profile"&&method==="POST"){
   if(!identity)fail(401,"Sign in first.");if(actor)fail(409,"You already have a profile.");const c=await config();if(!c.registrationOpen&&!isOwner)fail(403,"New registrations are temporarily paused.");const b=await body(req);const username=text(b.username,24,"Username",3).toLowerCase();if(!/^[a-z0-9_]+$/.test(username))fail(400,"Use letters, numbers and underscores.");if(!isOwner&&["admin","administrator","owner","office","support","shadownet","shadowsocial","moderator"].includes(username))fail(400,"This username is reserved.");if(b.acceptRules!==true||b.ageConfirmed!==true)fail(400,"Accept the rules and confirm you are at least 16.");
   if(await one("SELECT id FROM profiles WHERE username=?",username))fail(409,"That username is already taken.");await db.batch([q("INSERT INTO profiles(id,email,username,name,role,terms,created_at) VALUES(?,?,?,?,?,?,?)",identity!.userId,identity!.email,username,text(b.name,60,"Display name",1),isOwner?"owner":"member",POLICY_VERSION,Date.now()),q("INSERT INTO audit(id,actor,action,target,reason,created_at) VALUES(?,?,?,?,?,?)",id(),identity!.userId,"account.created",identity!.userId,"Community rules accepted",Date.now())]);return json({ok:true},201);
  }
  if(path==="appeals"&&method==="POST"){if(!actor||actor.status==="deleted")fail(401,"An existing account is required.");if(await one("SELECT id FROM appeals WHERE user=? AND state='open'",actor!.id))fail(409,"Your appeal is already awaiting review.");const b=await body(req);await rate("appeals",3);await q("INSERT INTO appeals(id,user,body,created_at) VALUES(?,?,?,?)",id(),actor!.id,text(b.body,2000,"Appeal",20),Date.now()).run();return json({ok:true});}
  if(actor&&actor.status!=="active"&&!(path==="export"&&method==="GET")&&!(path==="profile"&&method==="DELETE"))fail(403,`Account ${actor.status}. ${actor.reason}`);
  if(path==="profile"&&method==="PATCH"){
   const a=member(),b=await body(req);let avatar=a.avatar;if(b.avatar!==undefined){avatar=b.avatar?text(b.avatar,80,"Avatar"):null;if(avatar&&!await one("SELECT id FROM media WHERE id=? AND owner=?",avatar,a.id))fail(400,"Choose one of your uploads.")}
   const c=await config(),name=text(b.name??a.name,60,"Name",1),bio=text(b.bio??a.bio,300,"Bio");content(name+bio,c);
   const privacy=b.private===undefined?a.private:b.private===true?1:0;
   const changes=[q("UPDATE profiles SET name=?,bio=?,avatar=?,private=? WHERE id=?",name,bio,avatar,privacy,a.id)];
   if(!privacy)changes.push(q("UPDATE follows SET state='accepted' WHERE following=?",a.id));await db.batch(changes);return json({ok:true});
  }
  if(path==="profile"&&method==="DELETE"){
   const a=account();if(a.role==="owner")fail(400,"The owner account cannot be deleted here.");const b=await body(req);if(b.confirm!==a.username)fail(400,"Type your username to confirm.");
   const files=await rows("SELECT key FROM media WHERE owner=?",a.id);for(const file of files)await env.BUCKET.delete(String(file.key));
   await db.batch([q("DELETE FROM follows WHERE follower=? OR following=?",a.id,a.id),q("DELETE FROM likes WHERE user=?",a.id),q("DELETE FROM bookmarks WHERE user=?",a.id),q("DELETE FROM notifications WHERE user=? OR actor=?",a.id,a.id),q("UPDATE comments SET body='[deleted]',status='removed' WHERE owner=?",a.id),q("UPDATE posts SET caption='',status='deleted' WHERE owner=?",a.id),q("UPDATE profiles SET email='',username=?,name='Deleted account',bio='',avatar=NULL,status='deleted',reason='' WHERE id=?",`deleted_${id().slice(0,8)}`,a.id),log("account.deleted",a.id,"User requested account deletion")]);return json({ok:true});
  }
  if(path==="export"&&method==="GET"){const a=account();const data={profile:a,posts:await rows("SELECT * FROM posts WHERE owner=?",a.id),comments:await rows("SELECT * FROM comments WHERE owner=?",a.id),follows:await rows("SELECT * FROM follows WHERE follower=? OR following=?",a.id,a.id),reports:await rows("SELECT * FROM reports WHERE reporter=?",a.id),generatedAt:new Date().toISOString()};return new Response(JSON.stringify(data,null,2),{headers:{"Content-Type":"application/json","Content-Disposition":"attachment; filename=shadowsocial-data.json","Cache-Control":"no-store"}})}
  if(path==="upload"&&method==="POST"){
   const a=member(),c=await config();if(!c.postingOpen&&a.role==="member")fail(403,"Uploads are temporarily paused.");await rate("uploads",30);const bytes=await bounded(req,6*1024*1024),mime=imageType(bytes);if(!mime)fail(415,"Choose a JPEG, PNG or WebP image.");const mediaId=id(),key=`media/${a.id}/${mediaId}`;
   await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:mime!}});try{await q("INSERT INTO media(id,owner,key,mime,bytes,created_at) VALUES(?,?,?,?,?,?)",mediaId,a.id,key,mime,bytes.length,Date.now()).run()}catch(e){await env.BUCKET.delete(key);throw e}return json({id:mediaId,url:`/api/media/${mediaId}`},201);
  }
  if(parts[0]==="media"&&parts[1]&&method==="GET"){
   const m=await one<{id:string;owner:string;key:string;mime:string}>("SELECT * FROM media WHERE id=?",parts[1]);if(!m)fail(404,"Image not found.");const own=actor?.id===m!.owner,review=actor&&["owner","admin","moderator"].includes(actor.role);
   const linked=await one(`SELECT p.id FROM posts p JOIN profiles u ON u.id=p.owner WHERE p.media_id=? AND ${visibility()}`,m!.id,...viewer());
   const avatar=await one(`SELECT p.id FROM profiles p WHERE p.avatar=? AND ${active("p")} AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.owner=? AND b.target=p.id) OR (b.target=? AND b.owner=p.id))`,m!.id,actor?.id??"",actor?.id??"");
   if(!own&&!review&&!linked&&!avatar)fail(404,"Image not found.");const file=await env.BUCKET.get(m!.key);if(!file)fail(404,"Image not found.");return new Response(file!.body,{headers:{"Content-Type":m!.mime,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'","Content-Disposition":"inline"}});
  }
  if(path==="posts"&&method==="GET"){
   const mode=url.searchParams.get("mode")??"discover",person=url.searchParams.get("user"),before=url.searchParams.get("before"),search=(url.searchParams.get("q")??"").slice(0,100);let extra="",args:unknown[]=[];
   if(mode==="following"){member();extra+=" AND EXISTS(SELECT 1 FROM follows f WHERE f.follower=? AND f.following=p.owner AND f.state='accepted')";args.push(actor!.id)}
   if(mode==="saved"){member();extra+=" AND EXISTS(SELECT 1 FROM bookmarks k WHERE k.user=? AND k.post=p.id)";args.push(actor!.id)}
   if(person){extra+=" AND u.username=?";args.push(person)}if(search){extra+=" AND p.caption LIKE ?";args.push(`%${search}%`)}
   if(before){const [time,key]=before.split("~");if(!Number.isSafeInteger(Number(time))||!key)fail(400,"Invalid page cursor.");extra+=" AND (p.created_at<? OR (p.created_at=? AND p.id<?))";args.push(Number(time),Number(time),key)}
   const data=await rows(`SELECT p.*,u.username,u.name,u.avatar,u.role,(SELECT COUNT(*) FROM likes l WHERE l.post=p.id) likes,(SELECT COUNT(*) FROM comments c JOIN profiles cu ON cu.id=c.owner WHERE c.post=p.id AND c.status='live' AND ${active("cu")} AND NOT EXISTS(SELECT 1 FROM blocks cb WHERE (cb.owner=? AND cb.target=cu.id) OR (cb.target=? AND cb.owner=cu.id))) comments,EXISTS(SELECT 1 FROM likes l WHERE l.post=p.id AND l.user=?) liked,EXISTS(SELECT 1 FROM bookmarks k WHERE k.post=p.id AND k.user=?) saved FROM posts p JOIN profiles u ON u.id=p.owner WHERE ${visibility()} ${extra} ORDER BY p.created_at DESC,p.id DESC LIMIT 25`,actor?.id??"",actor?.id??"",actor?.id??"",actor?.id??"",...viewer(),...args);
   const more=data.length>24;if(more)data.pop();const last=data[data.length-1];return json({posts:data,next:more&&last?`${last.created_at}~${last.id}`:null});
  }
  if(path==="posts"&&method==="POST"){
   const a=member(),c=await config();if(!c.postingOpen&&a.role==="member")fail(403,"Posting is temporarily paused.");const b=await body(req),caption=text(b.caption??"",2200,"Caption"),mediaId=b.mediaId?text(b.mediaId,80,"Image"):null;if(!caption&&!mediaId)fail(400,"Add a photo or caption.");content(caption,c);if(mediaId&&!await one("SELECT id FROM media WHERE id=? AND owner=?",mediaId,a.id))fail(400,"Choose your own upload.");await rate("posts",c.maxPostsPerDay);const post=id(),status=c.reviewNewPosts&&a.role==="member"?"pending":"live";await q("INSERT INTO posts(id,owner,caption,media_id,status,created_at) VALUES(?,?,?,?,?,?)",post,a.id,caption,mediaId,status,Date.now()).run();return json({id:post,status},201);
  }
  if(parts[0]==="posts"&&parts[1]){
   const postId=parts[1];
   if(parts.length===2&&method==="DELETE"){const a=member();const p=await one<{owner:string}>("SELECT owner FROM posts WHERE id=?",postId);if(p?.owner!==a.id)fail(403,"You can delete your own posts.");await q("UPDATE posts SET status='deleted' WHERE id=?",postId).run();return json({ok:true})}
   const p=await visiblePost(postId);if(!p)fail(404,"Post not found.");
   if(["like","save"].includes(parts[2])&&method==="POST"){
    const a=member(),b=await body(req),table=parts[2]==="like"?"likes":"bookmarks";if(typeof b.enabled!=="boolean")fail(400,"Choose enabled or disabled.");
    if(b.enabled){await rate("reactions",500);const result=await q(`INSERT OR IGNORE INTO ${table}(user,post) VALUES(?,?)`,a.id,postId).run();if(table==="likes"&&p!.owner!==a.id&&result.meta.changes)await note(p!.owner,"like",postId,`@${a.username} liked your post.`).run()}else await q(`DELETE FROM ${table} WHERE user=? AND post=?`,a.id,postId).run();return json({ok:true});
   }
   if(parts[2]==="comments"&&method==="GET")return json({comments:await rows(`SELECT c.id,c.body,c.owner,c.created_at,u.username,u.name,u.avatar FROM comments c JOIN profiles u ON u.id=c.owner WHERE c.post=? AND c.status='live' AND ${active("u")} AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.owner=? AND b.target=u.id) OR (b.target=? AND b.owner=u.id)) ORDER BY c.created_at DESC LIMIT 60`,postId,actor?.id??"",actor?.id??"")});
   if(parts[2]==="comments"&&method==="POST"){const a=member(),c=await config();if(!c.postingOpen&&a.role==="member")fail(403,"Comments are temporarily paused.");const b=await body(req),value=text(b.body,500,"Comment",1);content(value,c);await rate("comments",100);const key=id(),statements=[q("INSERT INTO comments(id,owner,post,body,created_at) VALUES(?,?,?,?,?)",key,a.id,postId,value,Date.now())];if(p!.owner!==a.id)statements.push(note(p!.owner,"comment",postId,`@${a.username} commented on your post.`));await db.batch(statements);return json({id:key},201)}
  }
  if(parts[0]==="comments"&&parts[1]&&method==="DELETE"){const a=member();const c=await one<{owner:string;post:string}>("SELECT owner,post FROM comments WHERE id=?",parts[1]);const p=c?await one<{owner:string}>("SELECT owner FROM posts WHERE id=?",c.post):null;if(!c||(c.owner!==a.id&&p?.owner!==a.id))fail(403,"You cannot delete this comment.");await q("UPDATE comments SET status='removed' WHERE id=?",parts[1]).run();return json({ok:true})}
  if(path==="people"&&method==="GET"){
   const term=(url.searchParams.get("q")??"").slice(0,60);return json({people:await rows(`SELECT ${safeProfile},(SELECT COUNT(*) FROM follows f WHERE f.following=p.id AND f.state='accepted') followers,(SELECT state FROM follows f WHERE f.follower=? AND f.following=p.id) relationship FROM profiles p WHERE ${active("p")} AND p.id!=? AND (p.username LIKE ? OR p.name LIKE ?) AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.owner=? AND b.target=p.id) OR (b.target=? AND b.owner=p.id)) ORDER BY p.created_at DESC LIMIT 30`,actor?.id??"",actor?.id??"",`%${term}%`,`%${term}%`,actor?.id??"",actor?.id??"")});
  }
  if(parts[0]==="people"&&parts[1]&&method==="GET"){
   const p=await one<Profile>(`SELECT * FROM profiles p WHERE p.username=? AND ${active("p")}`,parts[1]);if(!p||actor&&await blocked(actor.id,p.id))fail(404,"Profile not found.");const follower=actor?await one<{state:string}>("SELECT state FROM follows WHERE follower=? AND following=?",actor.id,p!.id):null;
   const canView=!p!.private||actor?.id===p!.id||follower?.state==="accepted";const counts=await one("SELECT (SELECT COUNT(*) FROM follows WHERE following=? AND state='accepted') followers,(SELECT COUNT(*) FROM follows WHERE follower=? AND state='accepted') following,(SELECT COUNT(*) FROM posts WHERE owner=? AND status='live') posts",p!.id,p!.id,p!.id);return json({profile:{id:p!.id,username:p!.username,name:p!.name,bio:p!.bio,avatar:p!.avatar,role:p!.role,private:p!.private,created_at:p!.created_at},counts,canView,relationship:follower?.state??null});
  }
  if(parts[0]==="people"&&parts[1]&&["follow","block"].includes(parts[2])&&method==="POST"){
   const a=member(),target=await one<Profile>(`SELECT * FROM profiles p WHERE p.id=? AND ${active("p")}`,parts[1]);if(!target||target.id===a.id)fail(400,"Choose another active account.");const b=await body(req);if(typeof b.enabled!=="boolean")fail(400,"Choose enabled or disabled.");
   if(parts[2]==="block"){
    if(b.enabled)await db.batch([q("INSERT OR IGNORE INTO blocks(owner,target) VALUES(?,?)",a.id,target!.id),q("DELETE FROM follows WHERE (follower=? AND following=?) OR (follower=? AND following=?)",a.id,target!.id,target!.id,a.id)]);else await q("DELETE FROM blocks WHERE owner=? AND target=?",a.id,target!.id).run();return json({ok:true});
   }
   if(await blocked(a.id,target!.id))fail(403,"This account is unavailable.");if(!b.enabled){await q("DELETE FROM follows WHERE follower=? AND following=?",a.id,target!.id).run();return json({state:null})}
   await rate("follows",100);const state=target!.private?"requested":"accepted";const result=await q("INSERT OR IGNORE INTO follows(follower,following,state,created_at) VALUES(?,?,?,?)",a.id,target!.id,state,Date.now()).run();if(result.meta.changes)await note(target!.id,state==="requested"?"follow_request":"follow",a.id,`@${a.username} ${state==="requested"?"requested to follow you":"started following you"}.`).run();return json({state:(await one<{state:string}>("SELECT state FROM follows WHERE follower=? AND following=?",a.id,target!.id))?.state});
  }
  if(path==="requests"&&method==="GET"){const a=member();return json({requests:await rows("SELECT p.id,p.username,p.name,p.avatar FROM follows f JOIN profiles p ON p.id=f.follower WHERE f.following=? AND f.state='requested'",a.id),blocks:await rows("SELECT p.id,p.username,p.name,p.avatar FROM blocks b JOIN profiles p ON p.id=b.target WHERE b.owner=?",a.id)})}
  if(parts[0]==="requests"&&parts[1]&&method==="POST"){const a=member(),b=await body(req);if(b.accept===true){await q("UPDATE follows SET state='accepted' WHERE follower=? AND following=? AND state='requested'",parts[1],a.id).run()}else await q("DELETE FROM follows WHERE follower=? AND following=? AND state='requested'",parts[1],a.id).run();return json({ok:true})}
  if(path==="notifications"&&method==="GET"){const a=member();return json({notifications:await rows("SELECT * FROM notifications WHERE user=? ORDER BY created_at DESC LIMIT 80",a.id)})}
  if(path==="notifications"&&method==="POST"){const a=member();await q("UPDATE notifications SET read=1 WHERE user=?",a.id).run();return json({ok:true})}
  if(path==="reports"&&method==="POST"){
   const a=member(),b=await body(req),kind=text(b.kind,16,"Report type"),target=text(b.target,100,"Report target",1),reason=text(b.reason,80,"Reason",3),details=text(b.details??"",1000,"Details");if(!["post","comment","user"].includes(kind))fail(400,"Invalid report type.");
   if(kind==="post"&&!await visiblePost(target))fail(404,"Post not found.");if(kind==="user"&&!await one(`SELECT id FROM profiles p WHERE id=? AND ${active("p")}`,target))fail(404,"Account not found.");if(kind==="comment"){const c=await one<{post:string}>("SELECT post FROM comments WHERE id=? AND status='live'",target);if(!c||!await visiblePost(c.post))fail(404,"Comment not found.")}
   await rate("reports",20);await q("INSERT OR IGNORE INTO reports(id,reporter,kind,target,reason,details,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",id(),a.id,kind,target,reason,details,Date.now(),Date.now()).run();return json({ok:true});
  }
  if(parts[0]==="office"){
   member();staff();const page=Math.min(1000,Math.max(0,Number(url.searchParams.get("page"))||0)),search=(url.searchParams.get("q")??"").slice(0,100);
   if(parts[1]==="context"&&parts[2]&&parts[3]&&method==="GET"){
    const kind=parts[2];if(!["post","comment","user"].includes(kind))fail(400,"Invalid context type.");const table=kind==="user"?"profiles":kind==="post"?"posts":"comments";
    const item=await one<Record<string,unknown>>(`SELECT * FROM ${table} WHERE id=?`,parts[3]);if(!item)fail(404,"Item not found.");const author=await one<Profile>("SELECT * FROM profiles WHERE id=?",kind==="user"?item!.id:item!.owner);return json({kind,item,author});
   }
   if(path==="office/overview"&&method==="GET")return json({stats:await one("SELECT (SELECT COUNT(*) FROM profiles WHERE status!='deleted') users,(SELECT COUNT(*) FROM posts WHERE status='live') posts,(SELECT COUNT(*) FROM reports WHERE state='open') reports,(SELECT COUNT(*) FROM profiles WHERE status IN ('banned','suspended')) restricted,(SELECT COUNT(*) FROM posts WHERE status='pending') pending,(SELECT COUNT(*) FROM appeals WHERE state='open') appeals"),audit:await rows("SELECT a.*,p.username FROM audit a LEFT JOIN profiles p ON p.id=a.actor ORDER BY a.created_at DESC LIMIT 40"),config:await config(),role:actor!.role});
   if(path==="office/users"&&method==="GET")return json({users:await rows("SELECT id,username,name,email,role,status,reason,suspended_until,private,created_at FROM profiles WHERE (username LIKE ? OR name LIKE ?) ORDER BY created_at DESC LIMIT 50 OFFSET ?",`%${search}%`,`%${search}%`,page*50),page});
   if(path==="office/posts"&&method==="GET")return json({posts:await rows("SELECT p.*,u.username,u.name FROM posts p JOIN profiles u ON u.id=p.owner WHERE (?='' OR p.status=?) ORDER BY p.created_at DESC LIMIT 50 OFFSET ?",url.searchParams.get("status")??"",url.searchParams.get("status")??"",page*50),page});
   if(path==="office/reports"&&method==="GET")return json({reports:await rows("SELECT r.*,p.username reporter_name FROM reports r JOIN profiles p ON p.id=r.reporter ORDER BY CASE WHEN r.state='open' THEN 0 ELSE 1 END,r.created_at DESC LIMIT 50 OFFSET ?",page*50),page});
   if(path==="office/appeals"&&method==="GET")return json({appeals:await rows("SELECT a.*,p.username,p.status FROM appeals a JOIN profiles p ON p.id=a.user ORDER BY CASE WHEN a.state='open' THEN 0 ELSE 1 END,a.created_at DESC LIMIT 50 OFFSET ?",page*50),page});
   if(path==="office/settings"&&method==="POST"){
    owner();const b=await body(req),c=await config();for(const k of ["registrationOpen","postingOpen","reviewNewPosts"] as const)if(typeof b[k]==="boolean")c[k]=b[k] as boolean;
    if(b.maxPostsPerDay!==undefined){const n=Number(b.maxPostsPerDay);if(!Number.isInteger(n)||n<1||n>100)fail(400,"Daily post limit must be 1–100.");c.maxPostsPerDay=n}
    for(const [k,max] of [["announcement",300],["blockedWords",2000],["rules",5000]] as const)if(b[k]!==undefined)c[k]=text(b[k],max,k,k==="rules"?30:0);
    const reason=text(b.reason,500,"Change reason",5);await db.batch([q("INSERT INTO settings(id,value) VALUES('platform',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",JSON.stringify(c)),log("settings.updated","platform",reason)]);return json({ok:true,config:c});
   }
   if(parts[1]==="users"&&parts[2]&&method==="POST"){
    const target=await one<Profile>("SELECT * FROM profiles WHERE id=?",parts[2]);if(!target||target.status==="deleted")fail(404,"User not found.");if(target!.role==="owner"||target!.id===actor!.id)fail(403,"The owner and your own account are protected.");const b=await body(req),action=text(b.action,30,"Action"),reason=text(b.reason,500,"Reason",5);if(target!.role!=="member"&&actor!.role!=="owner")fail(403,"Only the owner can manage staff.");
    let statement:D1PreparedStatement;if(action==="role"){owner();if(!["member","moderator","admin"].includes(String(b.role)))fail(400,"Invalid role.");statement=q("UPDATE profiles SET role=? WHERE id=?",b.role,target!.id)}
    else if(action==="warn")statement=note(target!.id,"moderation",target!.id,`Account warning: ${reason}`);
    else if(["ban","suspend","restore"].includes(action)){if(actor!.role==="moderator"&&action!=="suspend")fail(403,"Administrators handle bans and reinstatements.");const days=Number(b.days??7);if(!Number.isInteger(days)||days<1||days>30)fail(400,"Suspension must be 1–30 days.");statement=q("UPDATE profiles SET status=?,reason=?,suspended_until=? WHERE id=?",action==="ban"?"banned":action==="suspend"?"suspended":"active",action==="restore"?"":reason,action==="suspend"?Date.now()+days*86400000:null,target!.id)}else return fail(400,"Invalid action.");
    await db.batch([statement,log(`user.${action}`,target!.id,reason),note(target!.id,"moderation",target!.id,`${action==='restore'?'Account restored':action==='role'?'Account role updated':action==='warn'?'Please review our community rules':'Account restricted'}: ${reason}`)]);return json({ok:true});
   }
   if(["posts","comments"].includes(parts[1])&&parts[2]&&method==="POST"){
    const b=await body(req),reason=text(b.reason,500,"Reason",5),status=b.action==="restore"?"live":b.action==="remove"?"removed":null;if(!status)fail(400,"Choose restore or remove.");const table=parts[1];const item=await one<{owner:string;status:string}>(`SELECT owner,status FROM ${table} WHERE id=?`,parts[2]);if(!item)fail(404,"Content not found.");if(item!.status==="deleted")fail(400,"User-deleted content cannot be restored.");await db.batch([q(`UPDATE ${table} SET status=? WHERE id=?`,status,parts[2]),log(`content.${status}`,parts[2],reason),note(item!.owner,"moderation",parts[2],`Your ${table==='posts'?'post':'comment'} was ${status==='live'?'approved':'removed'}: ${reason}`)]);return json({ok:true});
   }
   if(parts[1]==="reports"&&parts[2]&&method==="POST"){
    const b=await body(req),state=text(b.state,20,"Decision"),reason=text(b.reason,500,"Decision note",5);if(!["resolved","dismissed"].includes(state))fail(400,"Invalid decision.");const report=await one<{reporter:string}>("SELECT reporter FROM reports WHERE id=?",parts[2]);if(!report)fail(404,"Report not found.");await db.batch([q("UPDATE reports SET state=?,note=?,reviewer=?,updated_at=? WHERE id=?",state,reason,actor!.id,Date.now(),parts[2]),log(`report.${state}`,parts[2],reason),note(report!.reporter,"report",parts[2],`Your report was reviewed: ${reason}`)]);return json({ok:true});
   }
   if(parts[1]==="appeals"&&parts[2]&&method==="POST"){const b=await body(req),reason=text(b.reason,500,"Decision note",5);const appeal=await one<{user:string}>("SELECT user FROM appeals WHERE id=?",parts[2]);if(!appeal)fail(404,"Appeal not found.");await db.batch([q("UPDATE appeals SET state='reviewed',note=? WHERE id=?",reason,parts[2]),log("appeal.reviewed",parts[2],reason),note(appeal!.user,"moderation",parts[2],`Appeal reviewed: ${reason}`)]);return json({ok:true})}
  }
  return json({error:"Endpoint not found."},404);
 }catch(e){if(e instanceof Failure)return json({error:e.message},e.status);console.error(JSON.stringify({event:"api.error",path,message:e instanceof Error?e.message:"Unknown"}));return json({error:"Something went wrong. Please try again."},500)}
}
