"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { deviceStatus, type Device } from "../../lib/tracking";
import { motionOf, motionLabels, type Dispatch, type FleetAlert, type Motion } from "../../lib/dispatch";
export async function fleetApi<T>(path:string,method="GET",body?:unknown,signal?:AbortSignal):Promise<T>{
  const response=await fetch(path,{method,credentials:"same-origin",cache:"no-store",headers:body?{"Content-Type":"application/json"}:{},body:body?JSON.stringify(body):undefined,signal});
  const data=await response.json() as T & {error?:string};if(!response.ok)throw new Error(data.error??"Could not update driver operations.");return data;
}
export function useFleet(signedIn:boolean){
  const [clock,setClock]=useState(()=>Date.now());
  const [devices,setDevices]=useState<Device[]>([]),[dispatches,setDispatches]=useState<Dispatch[]>([]),[alerts,setAlerts]=useState<FleetAlert[]>([]),[observed,setObserved]=useState<FleetAlert[]>([]);
  const [loading,setLoading]=useState(signedIn),[error,setError]=useState(""),[refreshed,setRefreshed]=useState<number|null>(null),[notifications,setNotifications]=useState(false);
  const notificationsRef=useRef(false),baseline=useRef(false),activeAlerts=useRef(new Set<string>());
  const motions=useRef(new Map<string,{stable:Motion;candidate:Motion;count:number;event:string}>());
  const refresh=useCallback(async(signal?:AbortSignal)=>{
    const data=await fleetApi<{devices:Device[];dispatches:Dispatch[];alerts:FleetAlert[];serverTime:number}>("/api/tracking/devices","GET",undefined,signal);
    if(signal?.aborted)return;
    const newAlerts:FleetAlert[]=[];
    if(baseline.current) for(const alert of data.alerts)if(!activeAlerts.current.has(alert.id))newAlerts.push(alert);
    activeAlerts.current=new Set(data.alerts.map(a=>a.id));
    for(const d of data.devices){
      const motion=d.status==="live"?motionOf(d.latestPoint,data.serverTime):"unknown",previous=motions.current.get(d.id),event=d.latestPoint?.eventId??"";
      if(!previous){motions.current.set(d.id,{stable:motion,candidate:motion,count:0,event});continue;}
      if(previous.event===event)continue;
      previous.event=event;
      if(motion==="unknown"){previous.candidate=motion;previous.count=0;continue;}
      previous.count=previous.candidate===motion?previous.count+1:1;previous.candidate=motion;
      if(previous.count>=2 && previous.stable!==motion){previous.stable=motion;newAlerts.push({id:`motion-${d.id}-${event}`,deviceId:d.id,title:`${d.driverName}: ${motionLabels[motion].toLowerCase()}`,detail:"Estimated from two consecutive GPS speed readings.",at:d.latestPoint!.recordedAt,kind:"movement"});}
    }
    baseline.current=true;
    if(newAlerts.length){setObserved(current=>[...newAlerts,...current].slice(0,30));if(notificationsRef.current&&"Notification" in window&&Notification.permission==="granted")for(const alert of newAlerts.slice(0,3)){try{new Notification("RouteForge · "+alert.title,{body:alert.detail,tag:alert.id});}catch{/* Some mobile browsers expose the API but cannot show desktop alerts. */}}}
    setDevices(data.devices);setDispatches(data.dispatches);setAlerts(data.alerts);setRefreshed(data.serverTime);setClock(Date.now());setLoading(false);setError("");
  },[]);
  useEffect(()=>{
    if(!signedIn)return;const controller=new AbortController();let inFlight=false;
    const tick=async()=>{if(inFlight||document.hidden)return;inFlight=true;try{await refresh(controller.signal);}catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Could not refresh drivers.");}finally{inFlight=false;if(!controller.signal.aborted){setLoading(false);setClock(Date.now());}}};
    void tick();const timer=setInterval(()=>void tick(),10000);document.addEventListener("visibilitychange",tick);
    return()=>{controller.abort();clearInterval(timer);document.removeEventListener("visibilitychange",tick);};
  },[signedIn,refresh]);
  async function toggleNotifications(){
    if(notifications){setNotifications(false);notificationsRef.current=false;return;}
    if(!("Notification" in window)){setError("This browser does not support desktop alerts. Updates still appear in the dashboard.");return;}
    try{
      const permission=await Notification.requestPermission();
      if(permission==="granted"){setNotifications(true);notificationsRef.current=true;}else setError("Browser alerts are blocked. Arrival and activity updates still appear here.");
    }catch{setError("Browser alerts are unavailable. Arrival and activity updates still appear here.");}
  }
  const combined=[...new Map([...alerts,...observed].sort((a,b)=>b.at-a.at).map(a=>[a.id,a])).values()].slice(0,30);
  return {devices:devices.map(d=>({...d,status:deviceStatus(d,clock)})),dispatches,alerts:combined,loading,error,refreshed,refresh,notifications,toggleNotifications};
}
