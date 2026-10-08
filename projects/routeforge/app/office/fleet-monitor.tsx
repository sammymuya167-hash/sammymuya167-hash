"use client";
import { MapPin, Phone, Radio, UserRound } from "lucide-react";
import type { Device } from "../../lib/tracking";
import type { Dispatch } from "../../lib/dispatch";
import { statusLabels, motionLabels, motionOf } from "../../lib/dispatch";
import { phoneLink, type DriverProfile } from "../../lib/office";
import JourneyMap from "../tracking/map";
import { DriverTelemetry } from "../tracking/operations";
import { useJourney } from "./use-office";

export function FleetMonitor({devices,dispatches,profiles,selectedId,onSelect,onDetails}:{
  devices:Device[];dispatches:Dispatch[];profiles:DriverProfile[];selectedId:string;onSelect:(id:string)=>void;onDetails:(id:string)=>void;
}) {
  const onboarded=devices.filter(d=>d.pairedAt&&!d.revokedAt),selected=onboarded.find(d=>d.id===selectedId)??onboarded[0];
  const assignment=dispatches.find(d=>d.deviceId===selected?.id),journey=useJourney(selected?.id??null);
  return <section className="office-monitor"><div className="office-monitor-grid">
    <aside><div className="office-list-title"><strong><Radio size={16}/> Company drivers</strong><span>{onboarded.length}</span></div>
      {onboarded.map(device=>{
        const profile=profiles.find(p=>p.deviceId===device.id),busy=dispatches.some(d=>d.deviceId===device.id&&d.stops.some(s=>!s.deliveredAt)),call=phoneLink(profile?.phone||device.phoneLabel);
        return <article className={`office-driver-row ${selected?.id===device.id?"selected":""}`} key={device.id}><button className="office-driver-select" onClick={()=>onSelect(device.id)}><strong>{device.driverName}<span className={`tracking-status status-${device.status}`}>{statusLabels[device.status]}</span></strong><small>{device.vehicleLabel||device.deviceName||"Linked phone"}</small><span>{busy?"On an active dispatch":profile?.onDuty===false?"Off duty":device.status==="live"?"Free for dispatch":"Awaiting fresh GPS"}</span><small>{device.status==="live"?motionLabels[motionOf(device.latestPoint)]:"Last known position"}{device.latestPoint?.battery!=null?` · ${device.latestPoint.battery}% battery`:""}</small></button><div className="office-driver-row-actions"><button onClick={()=>onDetails(device.id)}><UserRound size={13}/> Details</button>{call&&<a href={call}><Phone size={13}/> Call</a>}</div></article>;
      })}
      {!onboarded.length&&<p className="office-note">No company phone is paired yet. Onboard a driver from the full tracker.</p>}
      <a className="office-tracker-link" href="/tracking" target="_top"><MapPin size={15}/> Full tracker & onboarding ↗</a>
    </aside>
    <div className="office-monitor-map"><div className="office-map-title"><div><strong>{selected?.driverName??"Office map"}</strong><small>{assignment?.stops.find(s=>!s.deliveredAt)?.name??"Select a driver to follow their journey"}</small></div><span><i/> OpenStreetMap · actual GPS</span></div>
      <JourneyMap key={selected?.id??"empty-fleet"} points={journey.points} latest={selected?.latestPoint??null} drivers={onboarded} selectedId={selected?.id} onSelect={onSelect} destinations={assignment?.stops??[]} fitLabel="Fit fleet & journey"/>
      {selected&&<DriverTelemetry device={selected}/>}
      <div className="office-map-caption"><span>{journey.points.length} recent GPS fixes{journey.more?" · latest 500; full history in tracker":""}</span>{journey.error&&<span role="alert">{journey.error}</span>}<span>Lines connect recorded fixes; no live traffic or navigation route.</span></div>
    </div>
  </div></section>;
}
