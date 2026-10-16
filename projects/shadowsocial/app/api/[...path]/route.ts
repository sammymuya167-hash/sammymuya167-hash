import {handleRtc,sweepRtc} from "../../../lib/rtc";
import{handleAndroidRelease}from"../../../lib/android-release";
import {env} from "cloudflare:workers";
import {getChatGPTUser} from "../../chatgpt-auth";
import {handleSocial} from "../../../lib/social-api";
import {handlePasswordAuth,nativeIdentity,authErrorResponse} from "../../../lib/password-auth";
import {handleMessages} from "../../../lib/messages";
export const dynamic="force-dynamic";
async function handle(req:Request){
 if(!env.DB||!env.BUCKET)return Response.json({error:"Storage unavailable."},{status:503});
 try{const hosted=await getChatGPTUser(),path=new URL(req.url).pathname,ownerEmail=env.SHADOWSOCIAL_OWNER_EMAIL??"";
 if(path.startsWith("/api/android/"))return handleAndroidRelease(req,env.BUCKET,env.SHADOWSOCIAL_RELEASE_KEY??"");
 if(path.startsWith("/api/auth/"))return handlePasswordAuth(req,env.DB,hosted,ownerEmail);
 const identity=(await nativeIdentity(req,env.DB))??hosted;
 const rtc={DB:env.DB,appId:env.SHADOWSOCIAL_SFU_APP_ID??"",appSecret:env.SHADOWSOCIAL_SFU_SECRET??"",turnId:env.SHADOWSOCIAL_TURN_KEY_ID??"",turnSecret:env.SHADOWSOCIAL_TURN_SECRET??""};
 if(path==="/api/rtc"||path.startsWith("/api/rtc/"))return handleRtc(req,rtc,identity);
 if(path==="/api/messages"||path.startsWith("/api/messages/"))return handleMessages(req,env.DB,identity);
 const response=await handleSocial(req,{DB:env.DB,BUCKET:env.BUCKET,ownerEmail},identity);
 if(response.ok&&req.method!=="GET"&&(/\/(block|follow)$/.test(path)||path.startsWith("/api/office/users/")||path==="/api/profile"))await sweepRtc(rtc);
 return response;
 }catch(e){return authErrorResponse(e)??Response.json({error:"Service temporarily unavailable."},{status:503})}
}
export const GET=handle;export const POST=handle;export const PATCH=handle;export const DELETE=handle;
