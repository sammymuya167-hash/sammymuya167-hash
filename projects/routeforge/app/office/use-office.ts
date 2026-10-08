"use client";
import { useCallback, useEffect, useState } from "react";
import type { OfficeData, OfficeOrder } from "../../lib/office";
import type { TrackingEvent } from "../../lib/tracking";
import { fleetApi } from "../tracking/use-fleet";

function newestOrders(current:OfficeOrder[],next:OfficeOrder[]){const old=new Map(current.map(o=>[o.id,o]));const ids=new Set(next.map(o=>o.id));return [...current.filter(o=>!ids.has(o.id)&&!['delivered','cancelled'].includes(o.status)),...next.map(o=>(old.get(o.id)?.version??0)>o.version?old.get(o.id)!:o)];}
export function useOffice(signedIn:boolean){
  const [receivedAt,setReceivedAt]=useState(()=>Date.now());
  const [data,setData]=useState<OfficeData|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(signedIn);
  const refresh=useCallback(async(signal?:AbortSignal)=>{
    const next=await fleetApi<OfficeData>("/api/office","GET",undefined,signal);
    if(signal?.aborted)return;setData(current=>current?{...next,orders:newestOrders(current.orders,next.orders)}:next);setReceivedAt(Date.now());setError("");setLoading(false);return next;
  },[]);
  useEffect(()=>{
    if(!signedIn)return;const controller=new AbortController();let inFlight=false;
    const tick=async()=>{if(inFlight||document.hidden)return;inFlight=true;try{await refresh(controller.signal);}catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Could not open the office.");}finally{inFlight=false;if(!controller.signal.aborted)setLoading(false);}};
    void tick();const timer=setInterval(()=>void tick(),10000);document.addEventListener("visibilitychange",tick);
    return()=>{controller.abort();clearInterval(timer);document.removeEventListener("visibilitychange",tick);};
  },[signedIn,refresh]);
  const receiveOrder=useCallback((order:OfficeOrder)=>{setData(current=>current?{...current,orders:newestOrders(current.orders,[order,...current.orders.filter(o=>o.id!==order.id)])}:current);},[]);
  const hasOffers=!!data?.orders.some(o=>o.status==='offered');
  useEffect(()=>{
    if(!signedIn||!hasOffers)return;const controller=new AbortController();let inFlight=false;
    const tick=async()=>{if(inFlight||document.hidden)return;inFlight=true;try{const update=await fleetApi<{orders:OfficeOrder[];serverTime:number}>('/api/office/order-updates','GET',undefined,controller.signal);if(controller.signal.aborted)return;const at=Date.now();setData(current=>current?{...current,orders:newestOrders(current.orders,update.orders),serverTime:update.serverTime}:current);setReceivedAt(at);}catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Could not refresh delivery offers.');}finally{inFlight=false;}};
    void tick();const timer=setInterval(()=>void tick(),1000);document.addEventListener('visibilitychange',tick);return()=>{controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',tick);};
  },[signedIn,hasOffers,refresh]);
  return {data,error,loading,refresh,receiveOrder,receivedAt};
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
