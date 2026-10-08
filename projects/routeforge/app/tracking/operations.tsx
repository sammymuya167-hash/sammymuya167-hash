"use client";
import { useState } from "react";
import { Battery, Bell, CarFront, CheckCheck, Footprints, MapPin, Navigation, Send, Smartphone, Target } from "lucide-react";
import type { Route } from "../../lib/model";
import type { Device } from "../../lib/tracking";
import { distanceMeters, motionLabels, motionOf, type Dispatch, type FleetAlert } from "../../lib/dispatch";
import { fleetApi } from "./use-fleet";
export type RouteChoice={key:string;name:string;route:Route};
export function DriverTelemetry({device}:{device:Device}){
  const p=device.latestPoint,motion=device.status==="live"?motionOf(p):"unknown";
  const Icon=motion==="vehicle"?CarFront:motion==="walking"?Footprints:Smartphone;
  return <div className="driver-telemetry"><div><Icon size={20}/><strong>{motionLabels[motion]}</strong><small>{motion==="unknown"?"Waiting for a precise, recent speed reading":"GPS estimate · vehicle type is not verified"}</small></div><div><Navigation size={18}/><strong>{p?.speed!=null?`${(p.speed*3.6).toFixed(1)} km/h`:"—"}</strong><small>Recorded speed {p?.heading!=null?`· ${Math.round(p.heading)}°`:""}</small></div><div className={p?.battery!=null&&p.battery<=20?"battery-low":""}><Battery size={20}/><strong>{p?.battery!=null?`${p.battery}%`:"—"}</strong><small>Battery at last GPS fix</small></div><div><MapPin size={18}/><strong>{p?`±${Math.round(p.accuracy)} m`:"—"}</strong><small>Position accuracy</small></div></div>;
}
export function DispatchComposer({device,routes,onChanged}:{device:Device;routes:RouteChoice[];onChanged:()=>Promise<void>}){
  const [routeKey,setRouteKey]=useState("custom"),[name,setName]=useState(""),[lat,setLat]=useState(""),[lng,setLng]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function submit(event:React.FormEvent){
    event.preventDefault();setBusy(true);setError("");
    try{
      const choice=routes.find(r=>r.key===routeKey);
      const body=choice?{name:choice.name,vehicleId:choice.route.vehicle.id,vehicleName:choice.route.vehicle.name,stops:choice.route.stops.map(s=>({id:s.id,name:s.name,address:s.address,lat:s.lat,lng:s.lng}))}:{name:name.trim(),vehicleId:"direct-destination",vehicleName:device.vehicleLabel||"Driver phone",stops:[{id:crypto.randomUUID(),name:name.trim(),address:"Dispatcher destination",lat:Number(lat),lng:Number(lng)}]};
      await fleetApi("/api/tracking/dispatch","POST",{...body,deviceId:device.id,radius:100});await onChanged();
    }catch(e){setError(e instanceof Error?e.message:"Could not dispatch driver.");}finally{setBusy(false);}
  }
  return <form className="dispatch-composer" onSubmit={submit}><h3><Send size={17}/> Dispatch {device.driverName}</h3><p>Assign a planned route or set a destination for this linked phone.</p><label>Destination / route<select value={routeKey} onChange={e=>setRouteKey(e.target.value)}><option value="custom">Set a destination</option>{routes.filter(r=>r.route.stops.length).map(r=><option key={r.key} value={r.key}>{r.name} · {r.route.vehicle.name} · {r.route.stops.length} stops</option>)}</select></label>{routeKey==="custom"&&<><label>Destination name<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Customer pickup"/></label><div className="destination-fields"><label>Latitude<input required type="number" step="any" min={-85} max={85} value={lat} onChange={e=>setLat(e.target.value)} placeholder="-1.2864"/></label><label>Longitude<input required type="number" step="any" min={-180} max={180} value={lng} onChange={e=>setLng(e.target.value)} placeholder="36.8172"/></label></div><small>Use the destination coordinates, not the driver&apos;s current location.</small></>}{error&&<p role="alert" className="dispatch-error">{error}</p>}<button className="tracking-primary" disabled={busy||!device.pairedAt||!!device.revokedAt}><Send size={16}/>{busy?"Dispatching…":"Dispatch driver"}</button><small>Arrival requires two precise GPS fixes within 100 m. No phone reinstall is needed.</small></form>;
}
export function DispatchProgress({dispatch,device,onChanged}:{dispatch:Dispatch;device:Device;onChanged:()=>Promise<void>}){
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const next=dispatch.stops.find(s=>!s.deliveredAt),distance=next&&device.latestPoint?distanceMeters(next,device.latestPoint):null;
  async function action(kind:"deliver"|"cancel",stopId?:string){
    if(kind==="cancel"&&!window.confirm("Cancel this dispatch? GPS recording continues on the phone."))return;
    setBusy(true);setError("");try{await fleetApi("/api/tracking/dispatch","PATCH",{deviceId:device.id,id:dispatch.id,action:kind,stopId});await onChanged();}catch(e){setError(e instanceof Error?e.message:"Could not update dispatch.");}finally{setBusy(false);}
  }
  return <section className="dispatch-progress"><div className="tracking-section-title"><h3><Target size={17}/> {dispatch.name}</h3><span>{dispatch.stops.filter(s=>s.deliveredAt).length}/{dispatch.stops.length} {dispatch.orderId?"stages complete":"delivered"}</span></div><p>{dispatch.vehicleName}{distance!=null?` · ${distance<1000?`${Math.round(distance)} m`:`${(distance/1000).toFixed(1)} km`} straight-line to next stop`:""}{!next?" · Route complete":""}</p><ol>{dispatch.stops.map((stop,index)=><li key={stop.id} className={stop.deliveredAt?"delivered":stop.arrivedAt?"arrived":""}><span>{stop.deliveredAt?<CheckCheck size={16}/>:index+1}</span><div><strong>{stop.name}</strong><small>{stop.deliveredAt?(dispatch.orderId&&index===0?"Collection confirmed":"Delivery confirmed"):stop.arrivedAt?`GPS arrival · ${new Date(stop.arrivedAt).toLocaleTimeString()}`:stop.id===next?.id?"Next destination":"Upcoming"}</small></div>{stop.id===next?.id&&stop.arrivedAt&&<button disabled={busy} onClick={()=>void action("deliver",stop.id)}>{dispatch.orderId&&index===0?"Confirm collection":"Confirm delivery"}</button>}</li>)}</ol>{error&&<p role="alert" className="dispatch-error">{error}</p>}<button className="text-button" disabled={busy} onClick={()=>void action("cancel")}>{next?"Cancel dispatch":"Clear completed dispatch"}</button></section>;
}
export function FleetAlerts({alerts,notifications,onNotifications}:{alerts:FleetAlert[];notifications:boolean;onNotifications:()=>void}){
  return <section className="fleet-alerts"><div className="tracking-section-title"><h3><Bell size={17}/> Fleet updates</h3><button onClick={onNotifications} className="tracking-secondary">{notifications?"Browser alerts on":"Enable browser alerts"}</button></div><p className="tracking-note">Alerts appear here while you monitor the fleet. Browser alerts are optional and apply to this open dashboard.</p>{alerts.slice(0,8).map(alert=><article key={alert.id} className={`fleet-alert ${alert.kind}`}><span>{alert.kind==="arrival"?<Target size={17}/>:alert.kind==="battery"?<Battery size={17}/>:alert.kind==="movement"?<Navigation size={17}/>:<Bell size={17}/>}</span><div><strong>{alert.title}</strong><small>{alert.detail}</small></div><time>{new Date(alert.at).toLocaleTimeString()}</time></article>)}{!alerts.length&&<p className="tracking-empty">Arrival, movement, battery and connection updates will appear here.</p>}</section>;
}
