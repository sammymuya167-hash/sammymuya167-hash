import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { handleSocial } from "../../../lib/social-api";
export const dynamic="force-dynamic";
async function handle(req:Request){
 if(!env.DB||!env.BUCKET)return Response.json({error:"Storage unavailable."},{status:503});
 return handleSocial(req,{DB:env.DB,BUCKET:env.BUCKET,ownerEmail:env.SHADOWSOCIAL_OWNER_EMAIL??""},await getChatGPTUser());
}
export const GET=handle;export const POST=handle;export const PATCH=handle;export const DELETE=handle;
