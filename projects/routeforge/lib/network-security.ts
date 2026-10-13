import { env } from "cloudflare:workers";
import { hashSecret,TrackingError } from "./tracking";
const encoder=new TextEncoder();
export const networkEnv=()=>env as unknown as {DB:D1Database;ROUTEFORGE_PLATFORM_OWNER?:string;ROUTEFORGE_INTEGRATION_KEY?:string;ROUTEFORGE_NETWORK_ENABLED?:string;ROUTEFORGE_JOB_KEY?:string};
export const networkDb=()=>networkEnv().DB;
export function networkEnabled(){if(networkEnv().ROUTEFORGE_NETWORK_ENABLED!=="true")throw new TrackingError(503,"Merchant onboarding is temporarily unavailable.");}
function bytes(hex:string){return Uint8Array.from(hex.match(/.{2}/g)??[],v=>parseInt(v,16));}
function hex(value:ArrayBuffer|Uint8Array){return Array.from(new Uint8Array(value)).map(v=>v.toString(16).padStart(2,"0")).join("");}
async function cipherKey(){const secret=networkEnv().ROUTEFORGE_INTEGRATION_KEY;if(!secret||!/^[a-f0-9]{64}$/.test(secret))throw new TrackingError(503,"Integration credential encryption is not configured.");return crypto.subtle.importKey("raw",bytes(secret),"AES-GCM",false,["encrypt","decrypt"]);}
export async function encryptSecret(value:string){const iv=crypto.getRandomValues(new Uint8Array(12));return hex(iv)+":"+hex(await crypto.subtle.encrypt({name:"AES-GCM",iv},await cipherKey(),encoder.encode(value)));}
export async function decryptSecret(value:string){const [iv,data]=value.split(":");return new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:bytes(iv)},await cipherKey(),bytes(data)));}
export async function signBody(secret:string,value:string){const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return hex(await crypto.subtle.sign("HMAC",key,encoder.encode(value)));}
export async function verifySignature(secret:string,value:string,signature:string){if(!/^[a-f0-9]{64}$/.test(signature))return false;const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);return crypto.subtle.verify("HMAC",key,bytes(signature),encoder.encode(value));}
export async function rateLimit(key:string,limit=120,period=60000){const now=Date.now(),r=await networkDb().prepare("INSERT INTO login_limits(key,started_at,attempts) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN started_at<? THEN 1 ELSE attempts+1 END,started_at=CASE WHEN started_at<? THEN excluded.started_at ELSE started_at END RETURNING attempts").bind(await hashSecret("network:"+key),now,now-period,now-period).first<{attempts:number}>();if((r?.attempts??limit+1)>limit)throw new TrackingError(429,"Rate limit exceeded. Retry later.");}
export async function audit(merchant:string,actor:string,action:string,subject:string){await networkDb().prepare("INSERT INTO network_audit(id,merchant_id,actor,action,subject_id,created_at) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),merchant,actor,action,subject,Date.now()).run();}
