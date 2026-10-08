"use client";
import { useMemo } from "react";
import { Layers } from "lucide-react";
import type { Delivery, OptimizationResult, Scenario } from "../lib/model";
import { fitView, projectLocation } from "../lib/map-view";
import JourneyMap from "./tracking/map";
export default function RouteMap({scenario,result,selected,onRoute,onDelivery}:{scenario:Scenario;result:OptimizationResult|null;selected:string|null;onRoute:(id:string|null)=>void;onDelivery:(delivery:Delivery)=>void}){
  const initialView=useMemo(()=>fitView([scenario.depot,...scenario.deliveries].map(p=>projectLocation(p.lat,p.lng)),{w:760,h:440}),[scenario]);
  const routes=(result?.routes??[]).filter(r=>!selected||r.vehicle.id===selected);
  return <section className="map-card" aria-label="Company planning map"><div className="map-top"><span>{scenario.depot.name}</span><span className="map-mode"><Layers size={13}/> Real OpenStreetMap</span></div><JourneyMap points={[]} latest={null} focusPlace={scenario.depot} initialView={initialView} fitLabel="Fit delivery area" connections={routes.filter(r=>r.stops.length).map(r=>({points:[scenario.depot,...r.stops,scenario.depot],color:r.vehicle.color}))} destinations={scenario.deliveries.map(d=>({...d,arrivedAt:null,deliveredAt:null}))} onDestination={id=>{const d=scenario.deliveries.find(d=>d.id===id);if(d)onDelivery(d);}}/><div className="map-bottom"><div className="map-legend"><button className={!selected?"chosen":""} onClick={()=>onRoute(null)}>All routes</button>{scenario.vehicles.filter(v=>v.active).map(v=><button key={v.id} className={selected===v.id?"chosen":""} onClick={()=>onRoute(selected===v.id?null:v.id)}><i style={{background:v.color}}/>{v.name}</button>)}</div><small>Dashed connections are route estimates, not road directions or captured journeys.</small></div></section>;
}
