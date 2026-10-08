"use client";
import { useCallback, useEffect, useState } from "react";
import type { OfficeData } from "../../lib/office";
import type { TrackingEvent } from "../../lib/tracking";
import { fleetApi } from "../tracking/use-fleet";

export function useOffice(signedIn:boolean){
  const [data,setData]=useState<OfficeData|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(signedIn);
  const refresh=useCallback(async(signal?:AbortSignal)=>{
    const next=await fleetApi<OfficeData>("/api/office","GET",undefined,signal);
    if(signal?.aborted)return;setData(next);setError("");setLoading(false);
  },[]);
  useEffect(()=>{
    if(!signedIn)return;const controller=new AbortController();let inFlight=false;
    const tick=async()=>{if(inFlight||document.hidden)return;inFlight=true;try{await refresh(controller.signal);}catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Could not open the office.");}finally{inFlight=false;if(!controller.signal.aborted)setLoading(false);}};
    void tick();const timer=setInterval(()=>void tick(),10000);document.addEventListener("visibilitychange",tick);
    return()=>{controller.abort();clearInterval(timer);document.removeEventListener("visibilitychange",tick);};
  },[signedIn,refresh]);
  return {data,error,loading,refresh};
}
export function useJourney(deviceId:string|null,enabled=true){
  const [history,setHistory]=useState<{id:string;events:TrackingEvent[];more:boolean}>({id:"",events:[],more:false});
  const [error,setError]=useState("");
  useEffect(()=>{
    if(!deviceId||!enabled)return;const controller=new AbortController();let inFlight=false;
    const tick=async()=>{
      if(inFlight||document.hidden)return;inFlight=true;
      try{const data=await fleetApi<{events:TrackingEvent[];nextCursor:string|null}>(`/api/tracking/history?deviceId=${encodeURIComponent(deviceId)}`,"GET",undefined,controller.signal);if(!controller.signal.aborted){setHistory({id:deviceId,events:data.events,more:!!data.nextCursor});setError("");}}
      catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Journey history unavailable.");}finally{inFlight=false;}
    };
    void tick();const timer=setInterval(()=>void tick(),15000);return()=>{controller.abort();clearInterval(timer);};
  },[deviceId,enabled]);
  const points=history.id===deviceId?history.events.filter((e):e is Extract<TrackingEvent,{kind:"point"}>=>e.kind==="point"):[];
  return {points,more:history.id===deviceId&&history.more,error};
}
