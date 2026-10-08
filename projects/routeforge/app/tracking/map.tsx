/* eslint-disable @next/next/no-img-element -- OSM tiles use direct requests with Referer and normal caching. */
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { CarFront, Footprints, LocateFixed, Maximize, Smartphone, Target } from "lucide-react";
import type { Device } from "../../lib/tracking";
import { motionOf, type GPSPoint, type DispatchStop } from "../../lib/dispatch";
import { fitView, panView, projectLocation, zoomView, type MapView } from "../../lib/map-view";

export default function JourneyMap({ points, latest, drivers = [], selectedId, onSelect, destinations = [] }: {
  points: GPSPoint[]; latest: GPSPoint | null; drivers?: Device[]; selectedId?: string;
  onSelect?: (id: string) => void; destinations?: DispatchStop[];
}) {
  const el = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 760, h: 440 });
  const [manualView, setView] = useState<MapView>(() => ({ ...projectLocation(latest?.lat ?? -1.2864, latest?.lng ?? 36.8172), zoom: 17 }));
  const [following, setFollowing] = useState(true);
  const live = latest ?? points.at(-1) ?? null;
  const view = useMemo(() => following && live ? { ...manualView, ...projectLocation(live.lat, live.lng) } : manualView, [following, live, manualView]);
  const viewRef = useRef(view);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ view: MapView; x: number; y: number; distance: number } | null>(null);
  useEffect(() => { viewRef.current = view; }, [view]);
  useEffect(() => {
    const node = el.current; if (!node) return;
    const observer = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    observer.observe(node); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const node = el.current; if (!node) return;
    const wheel = (event: WheelEvent) => {
      if ((event.target as HTMLElement).closest("button,a")) return;
      event.preventDefault();
      const rect = node.getBoundingClientRect();
      const next = zoomView(viewRef.current, viewRef.current.zoom + (event.deltaY < 0 ? 1 : -1), { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 });
      viewRef.current = next; setView(next);
      setFollowing(false);
    };
    node.addEventListener("wheel", wheel, { passive: false }); return () => node.removeEventListener("wheel", wheel);
  }, []);
  const route = latest && !points.some(p => p.eventId === latest.eventId) ? [...points, latest].sort((a,b) => a.recordedAt - b.recordedAt) : points;
  const projected = route.map(p => ({ ...projectLocation(p.lat, p.lng), point: p }));
  const z = view.zoom, tiles = 2 ** z, world = tiles * 256;
  const left = view.x * world - size.w / 2, top = view.y * world - size.h / 2;
  const tilesToShow = [];
  for (let x = Math.floor(left / 256); x <= Math.floor((left + size.w) / 256); x++) for (let y = Math.floor(top / 256); y <= Math.floor((top + size.h) / 256); y++) {
    if (y >= 0 && y < tiles) tilesToShow.push({ key: `${z}-${x}-${y}`, x, y, url: `https://tile.openstreetmap.org/${z}/${((x % tiles) + tiles) % tiles}/${y}.png` });
  }
  const path: string[] = []; let previous: GPSPoint | null = null;
  for (const p of projected) { path.push((previous?.tripId === p.point.tripId && p.point.recordedAt - previous.recordedAt < 300000 ? "L" : "M") + `${(p.x * world - left).toFixed(2)},${(p.y * world - top).toFixed(2)}`); previous = p.point; }
  const position = (p: { lat: number; lng: number }) => { const center = projectLocation(p.lat,p.lng); return { left: center.x * world - left, top: center.y * world - top }; };
  function updateView(next: MapView) { viewRef.current = next; setView(next); }
  function resetGesture() {
    const list = [...pointers.current.values()];
    if (!list.length) { gesture.current = null; return; }
    gesture.current = { view: viewRef.current, x: list.length > 1 ? (list[0].x + list[1].x) / 2 : list[0].x, y: list.length > 1 ? (list[0].y + list[1].y) / 2 : list[0].y, distance: list.length > 1 ? Math.hypot(list[0].x-list[1].x,list[0].y-list[1].y) : 0 };
  }
  function follow() { setFollowing(true); if(live) updateView({ ...projectLocation(live.lat,live.lng), zoom: Math.max(17,view.zoom) }); }
  function zoomBy(delta: number) {
    const center = live && following ? projectLocation(live.lat,live.lng) : { x: view.x, y: view.y };
    updateView(zoomView({ ...view, ...center }, view.zoom + delta));
  }
  const first = projected[0];
  const markers = drivers.filter(d => d.latestPoint && !d.revokedAt);
  const selectedDriver = markers.find(d => d.id === selectedId);
  return <div ref={el} className="journey-map" tabIndex={0} role="region" aria-label="Interactive GPS map. Drag to pan, scroll or pinch to zoom. Arrow keys move the map."
    onPointerDown={event => { if ((event.target as HTMLElement).closest("button,a") || (event.pointerType === "mouse" && event.button !== 0)) return; updateView(view); event.currentTarget.setPointerCapture(event.pointerId); pointers.current.set(event.pointerId,{ x:event.clientX,y:event.clientY }); resetGesture(); setFollowing(false); }}
    onPointerMove={event => {
      if (!pointers.current.has(event.pointerId) || !gesture.current || !el.current) return;
      pointers.current.set(event.pointerId,{ x:event.clientX,y:event.clientY }); const list=[...pointers.current.values()], start=gesture.current;
      const midpoint = list.length > 1 ? { x:(list[0].x+list[1].x)/2,y:(list[0].y+list[1].y)/2 } : list[0];
      let next=start.view;
      if(list.length>1 && start.distance>0){ const distance=Math.hypot(list[0].x-list[1].x,list[0].y-list[1].y); const rect=el.current.getBoundingClientRect(); next=zoomView(start.view,start.view.zoom+Math.round(Math.log2(Math.max(1,distance)/start.distance)),{x:start.x-rect.left-size.w/2,y:start.y-rect.top-size.h/2}); }
      updateView(panView(next,midpoint.x-start.x,midpoint.y-start.y));
    }}
    onPointerUp={event => { pointers.current.delete(event.pointerId); resetGesture(); }} onPointerCancel={event => { pointers.current.delete(event.pointerId); resetGesture(); }}
    onKeyDown={event => { if(event.target!==event.currentTarget)return; const arrows:Record<string,[number,number]>={ArrowLeft:[60,0],ArrowRight:[-60,0],ArrowUp:[0,60],ArrowDown:[0,-60]}; if(arrows[event.key]){event.preventDefault();setFollowing(false);updateView(panView(view,...arrows[event.key]));}else if(event.key==="+"||event.key==="="||event.key==="-"){event.preventDefault();zoomBy(event.key==="-"?-1:1);} }}>
    {tilesToShow.map(t=><img key={t.key} src={t.url} width={256} height={256} alt="" draggable={false} referrerPolicy="strict-origin-when-cross-origin" style={{position:"absolute",left:t.x*256-left,top:t.y*256-top}}/>)}
    <svg width={size.w} height={size.h} className="journey-overlay" aria-hidden="true"><path d={path.join(" ")} fill="none" stroke="white" strokeWidth={8} strokeLinejoin="round"/><path d={path.join(" ")} fill="none" stroke="#276744" strokeWidth={4} strokeLinejoin="round"/>{first&&<circle cx={first.x*world-left} cy={first.y*world-top} r={6} fill="white" stroke="#276744" strokeWidth={3}/>}{live&&<circle cx={position(live).left} cy={position(live).top} r={Math.min(350,live.accuracy / (156543.03392*Math.cos(live.lat*Math.PI/180)/2**z))} fill="#368761" fillOpacity={.1} stroke="#368761" strokeOpacity={.3}/>}</svg>
    {destinations.map((stop,index)=><span key={stop.id} className={`destination-pin ${stop.arrivedAt?"arrived":""}`} style={position(stop)} title={`${index+1}. ${stop.name}${stop.arrivedAt?" · Arrived":""}`}><Target size={18}/><b>{index+1}</b></span>)}
    {markers.map(d=>{const p=d.latestPoint!;const motion=motionOf(p);const Icon=motion==="vehicle"?CarFront:motion==="walking"?Footprints:Smartphone;return <button key={d.id} className={`driver-map-pin ${d.id===selectedId?"selected":""} ${d.status!=="live"?"delayed":""}`} style={position(p)} aria-label={`Follow ${d.driverName}`} onClick={()=>{setFollowing(true);updateView({...projectLocation(p.lat,p.lng),zoom:view.zoom});onSelect?.(d.id);}}><Icon size={22}/><span>{d.driverName}</span>{p.heading!=null&&motion==="vehicle"&&<i style={{transform:`rotate(${p.heading}deg)`}}>▲</i>}</button>;})}
    {!selectedDriver&&live&&<span className="driver-map-pin selected" style={position(live)}><Smartphone size={22}/></span>}
    <div className="map-controls"><div className="map-zoom"><button aria-label="Zoom in" disabled={z>=19} onClick={()=>zoomBy(1)}>+</button><button aria-label="Zoom out" disabled={z<=2} onClick={()=>zoomBy(-1)}>−</button></div><button className={following?"active":""} onClick={follow} disabled={!live}><LocateFixed size={15}/>{following?"Following":"Follow driver"}</button><button onClick={()=>{setFollowing(false);updateView(fitView([...projected,...markers.map(d=>projectLocation(d.latestPoint!.lat,d.latestPoint!.lng)),...destinations.map(s=>projectLocation(s.lat,s.lng))],size));}}>Fit journey</button><button aria-label="Fullscreen map" onClick={()=>{if(document.fullscreenElement)void document.exitFullscreen();else void el.current?.requestFullscreen().catch(()=>{});}}><Maximize size={15}/></button></div>
    <span className="map-help">Drag to explore · scroll / pinch to zoom · z{z}</span>
    {!route.length&&!markers.length&&<div className="map-empty">The first GPS fix will appear here.</div>}
    <a className="osm-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
  </div>;
}
