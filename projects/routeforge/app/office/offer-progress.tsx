"use client";
import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import type { OfficeOrder } from "../../lib/office";
export function OfferProgress({order,serverTime,receivedAt}:{order:OfficeOrder;serverTime:number;receivedAt:number}){
  const [clock,setClock]=useState(()=>Date.now());
  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),100);return()=>clearInterval(timer);},[]);
  const now=serverTime+Math.max(0,clock-receivedAt),remaining=Math.max(0,(order.offerDeadline??now)-now),elapsed=Math.min(100,Math.max(0,(5000-remaining)/50));
  return <div className="office-offer-state"><div><Radio size={15}/><strong>{remaining>0?`${(remaining/1000).toFixed(1)}s to claim`:"Choosing an available rider…"}</strong><span>{order.offerRiders??"Free"} eligible riders</span></div><div className="office-offer-track" role="progressbar" aria-label="Five-second claim window elapsed" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(elapsed)}><i style={{width:`${elapsed}%`}}/></div><small>First acceptance wins. Otherwise, one free rider is chosen at random.</small></div>;
}
