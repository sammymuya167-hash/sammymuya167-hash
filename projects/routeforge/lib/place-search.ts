import { env } from "cloudflare:workers";
import { photonPlaces, type Place } from "./office";
import { TrackingError } from "./tracking";

export async function searchPlaces(owner:string,query:string):Promise<Place[]> {
  const q=query.trim().replace(/\s+/g," ");
  if(q.length<3||q.length>120)throw new TrackingError(422,"Search for a place using 3–120 characters.");
  const db=env.DB as D1Database,now=Date.now(),key=`KE:${q.toLocaleLowerCase("en")}`;
  const cached=await db.prepare("SELECT payload_json FROM place_search_cache WHERE owner_id=? AND cache_key=? AND updated_at>?").bind(owner,key,now-86400000).first<{payload_json:string}>();
  if(cached)return JSON.parse(cached.payload_json) as Place[];
  // One shared reservation per second across all accounts, not per isolate.
  const gate=await db.prepare("INSERT INTO place_search_gate(provider,next_allowed_at) VALUES('photon',?) ON CONFLICT(provider) DO UPDATE SET next_allowed_at=excluded.next_allowed_at WHERE place_search_gate.next_allowed_at<=? RETURNING provider").bind(now+1100,now).first();
  if(!gate)throw new TrackingError(429,"Place search is busy. Try again in a moment, or choose a saved partner or map pin.");
  const configured=(env as unknown as {PLACE_SEARCH_URL?:string}).PLACE_SEARCH_URL;
  const url=new URL(configured??"https://photon.komoot.io/api/");
  if(url.protocol!=="https:")throw new TrackingError(503,"Place search is unavailable. Use a saved partner or map pin.");
  url.searchParams.set("q",q);url.searchParams.set("countrycode","KE");url.searchParams.set("lang","en");url.searchParams.set("limit","6");
  let result:Place[];
  try{
    // Workers support manual/follow redirect modes. Treat any 3xx as failure.
    const response=await fetch(url,{headers:{Accept:"application/json","User-Agent":"RouteForge/2.0 (+https://routeforge-shadownet.sammymuya167.chatgpt.site)"},signal:AbortSignal.timeout(8000),redirect:"manual"});
    if(!response.ok)throw new Error("UPSTREAM_UNAVAILABLE");
    const text=await response.text();if(text.length>100000)throw new Error("OVERSIZE");
    result=photonPlaces(JSON.parse(text));
  }catch{throw new TrackingError(503,"Place search could not respond. Saved partners and manual map pins still work.");}
  await db.batch([
    db.prepare("DELETE FROM place_search_cache WHERE owner_id=? AND (updated_at<? OR cache_key IN (SELECT cache_key FROM place_search_cache WHERE owner_id=? ORDER BY updated_at DESC LIMIT -1 OFFSET 199))").bind(owner,now-86400000,owner),
    db.prepare("INSERT INTO place_search_cache(owner_id,cache_key,payload_json,updated_at) VALUES(?,?,?,?) ON CONFLICT(owner_id,cache_key) DO UPDATE SET payload_json=excluded.payload_json,updated_at=excluded.updated_at").bind(owner,key,JSON.stringify(result),now),
  ]);
  return result;
}
