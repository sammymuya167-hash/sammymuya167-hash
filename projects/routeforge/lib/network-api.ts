import { createDriverAccount } from './accounts';
import { audit } from './network-security';
import { checkOrigin } from './api';
import { TrackingError,trackingPayload,trackingResponse,trackingFailure,hashSecret } from './tracking';
import { networkDb as db,rateLimit,decryptSecret,verifySignature,networkEnabled } from './network-security';
import { networkActor,activeMerchant } from './network-access';
import { adoptMerchant,merchantData,merchantSetting,updateMerchantProfile,addBranch,changeBranch,addStaff,changeStaff,addIntegration,changeIntegration,enrollRider,newRider,createDelivery,deliverySummary,readyDelivery,areas } from './network-store';
import { adminData,adminAction,deliveryAction,publicTracking } from './network-actions';
import { tickNetwork } from './network-dispatch';
import { deferOffice } from './office-context';
import { placeInput } from './office';
import { quote } from './network-model';
import { z } from 'zod';
export function networkFailure(e:unknown){if(e instanceof z.ZodError)return trackingResponse({error:e.issues[0]?.message??'Invalid input.'},422);return trackingFailure(e);}
export async function dashboardRequest(request:Request){
  try{
    const path=new URL(request.url).pathname.replace('/api/network/',''),method=request.method;
    if(path==='health'&&method==='GET')return trackingResponse({platform:'RouteForge',version:'2.0',livePayments:false});
    if(method!=='GET'){const blocked=checkOrigin(request);if(blocked)return blocked;}
    if(method==='GET'){
      if(path==='merchant'){const result=await merchantData();deferOffice(()=>tickNetwork());return trackingResponse(result);}
      if(path==='admin'){const result=await adminData();deferOffice(()=>tickNetwork());return trackingResponse(result);}
    }
    const data=await trackingPayload(request);
    if(path==='merchant'&&method==='POST')return trackingResponse(await adoptMerchant(data),201);
    if(path==='profile'&&method==='PATCH')return trackingResponse(await updateMerchantProfile(data));
    if(path==='merchant'&&method==='PATCH')return trackingResponse(await merchantSetting(data));
    if(path==='branches'&&method==='POST')return trackingResponse(await addBranch(data),201);
    if(path==='branches'&&method==='PATCH')return trackingResponse(await changeBranch(data));
    if(path==='staff'&&method==='POST')return trackingResponse(await addStaff(data),201);
    if(path==='staff'&&method==='PATCH')return trackingResponse(await changeStaff(data));
    if(path==='integrations'&&method==='POST')return trackingResponse(await addIntegration(data),201);
    if(path==='integrations'&&method==='PATCH')return trackingResponse(await changeIntegration(data));
    if(path==='admin-riders'&&method==='POST'){const a=await networkActor('admin'),r=await createDriverAccount(a.owner,data);await audit(a.owner,a.actor,'shared.rider.account.created',r.deviceId);return trackingResponse(r,201);}
    if(path==='riders'&&method==='POST')return trackingResponse(await newRider(data),201);
    if(path==='riders'&&method==='PATCH')return trackingResponse(await enrollRider(data));
    if(path==='shared-riders'&&method==='PATCH')return trackingResponse(await enrollRider(data,true));
    if(path==='deliveries'&&method==='POST'){const a=await networkActor('dispatch');return trackingResponse(await createDelivery(a.owner,data,a.actor),201);}
    if(path==='deliveries'&&method==='PATCH')return trackingResponse(await deliveryAction(data));
    if(path==='admin'&&method==='POST')return trackingResponse(await adminAction(data));
    throw new TrackingError(404,'Network endpoint not found.');
  }catch(e){return networkFailure(e);}
}
async function apiMerchant(request:Request){
  networkEnabled();const raw=request.headers.get('authorization')?.replace(/^Bearer /,'')??'';if(!/^rf_live_[a-f0-9]{64}$/.test(raw))throw new TrackingError(401,'Send your RouteForge API key as a Bearer token.');const i=await db().prepare('SELECT id,merchant_id FROM merchant_integrations WHERE key_hash=? AND enabled=1').bind(await hashSecret(raw)).first<{id:string;merchant_id:string}>();if(!i)throw new TrackingError(401,'API key is invalid or revoked.');await rateLimit('api:'+i.id);await activeMerchant(i.merchant_id);return {owner:i.merchant_id,actor:'integration:'+i.id};
}
async function quoteRequest(owner:string,data:unknown){const i=z.object({branchId:z.string().uuid(),destination:placeInput}).strict().parse(data),b=await db().prepare('SELECT location_json FROM merchant_branches WHERE id=? AND merchant_id=? AND active=1').bind(i.branchId,owner).first<{location_json:string}>();if(!b)throw new TrackingError(404,'Branch not found.');const pickup=JSON.parse(b.location_json);for(const a of await areas()){try{return quote(a,pickup,i.destination);}catch{}}throw new TrackingError(422,'Pickup and destination are outside the supported delivery areas.');}
export async function universalRequest(request:Request){
  try{
    const path=new URL(request.url).pathname.replace('/api/v1/','').split('/'),identity=await apiMerchant(request),{owner,actor}=identity;
    if(path[0]==='branches'&&request.method==='GET'){const rows=await db().prepare('SELECT id,name,location_json,active FROM merchant_branches WHERE merchant_id=?').bind(owner).all();return trackingResponse({branches:rows.results.map(r=>({...r,location:JSON.parse(r.location_json as string),location_json:undefined}))});}
    if(path[0]==='deliveries'&&path.length===2&&request.method==='GET')return trackingResponse(await deliverySummary(path[1],owner));
    if(path[0]==='deliveries'&&path.length===3&&path[2]==='ready'&&request.method==='POST')return trackingResponse(await readyDelivery(path[1],owner,actor));
    const data=await trackingPayload(request);
    if(path[0]==='quote'&&request.method==='POST')return trackingResponse(await quoteRequest(owner,data));
    if(path[0]==='deliveries'&&path.length===1&&request.method==='POST'){const key=request.headers.get('idempotency-key');if(key&&key!==(data as {externalId?:string})?.externalId)throw new TrackingError(422,'Idempotency-Key must equal externalId.');return trackingResponse(await createDelivery(owner,data,actor),201);}
    throw new TrackingError(404,'API endpoint not found.');
  }catch(e){return networkFailure(e);}
}
async function rawJson(request:Request){const reader=request.body?.getReader();if(!reader)throw new TrackingError(400,'Send JSON.');const chunks:Uint8Array[]=[],decoder=new TextDecoder();let size=0;while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>100000){await reader.cancel();throw new TrackingError(413,'Webhook is too large.');}chunks.push(value);}reader.releaseLock();const bytes=new Uint8Array(size);let offset=0;for(const b of chunks){bytes.set(b,offset);offset+=b.length;}return decoder.decode(bytes);}
export async function signedWebhook(request:Request){
  try{networkEnabled();const id=new URL(request.url).pathname.split('/').pop();const i=await db().prepare('SELECT merchant_id,secret_cipher FROM merchant_integrations WHERE id=? AND enabled=1').bind(id).first<{merchant_id:string;secret_cipher:string}>();if(!i)throw new TrackingError(401,'Webhook credential is invalid.');await rateLimit('webhook:'+id);await activeMerchant(i.merchant_id);const timestamp=request.headers.get('x-routeforge-timestamp')??'',signature=request.headers.get('x-routeforge-signature')??'';if(!/^\d{10}$/.test(timestamp)||Math.abs(Date.now()/1000-Number(timestamp))>300)throw new TrackingError(401,'Webhook timestamp is outside the five-minute window.');const raw=await rawJson(request);if(!await verifySignature(await decryptSecret(i.secret_cipher),timestamp+'.'+raw,signature))throw new TrackingError(401,'Webhook signature is invalid.');let data:unknown;try{data=JSON.parse(raw);}catch{throw new TrackingError(400,'Send valid JSON.');}return trackingResponse(await createDelivery(i.merchant_id,data,'webhook:'+id),201);}catch(e){return networkFailure(e);}
}
export async function trackingRequest(request:Request){try{return trackingResponse(await publicTracking(request));}catch(e){return networkFailure(e);}}
