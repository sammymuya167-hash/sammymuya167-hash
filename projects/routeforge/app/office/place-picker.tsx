"use client";
import { useEffect, useId, useRef, useState } from "react";
import { MapPin, Search, Store, Target } from "lucide-react";
import type { Partner, Place } from "../../lib/office";
import { placeInput } from "../../lib/office";
import JourneyMap from "../tracking/map";
import { fleetApi } from "../tracking/use-fleet";
import { OfficeModal } from "./modal";

export function PlacePicker({ label, value, onChange, partners = [], previous = [], initialCenter }:{
  label:string;value:Place|null;onChange:(place:Place|null)=>void;partners?:Partner[];previous?:Place[];initialCenter?:{lat:number;lng:number};
}) {
  const [query,setQuery]=useState(value?.name??""),[open,setOpen]=useState(false),[mapOpen,setMapOpen]=useState(false);
  const [remote,setRemote]=useState<{query:string;places:Place[]}>({query:"",places:[]}),[error,setError]=useState(""),[loading,setLoading]=useState(false);
  const [manual,setManual]=useState(false),[lat,setLat]=useState(""),[lng,setLng]=useState("");
  const box=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null),id=useId();
  useEffect(()=>{
    const outside=(event:PointerEvent)=>{if(box.current&&!box.current.contains(event.target as Node))setOpen(false);};
    document.addEventListener("pointerdown",outside);return()=>document.removeEventListener("pointerdown",outside);
  },[]);
  useEffect(()=>{
    if(!open||value||query.trim().length<3)return;
    const controller=new AbortController();
    const timer=setTimeout(async()=>{
      setLoading(true);setError("");
      try{const data=await fleetApi<{places:Place[]}>(`/api/office/places?q=${encodeURIComponent(query.trim())}`,"GET",undefined,controller.signal);if(!controller.signal.aborted)setRemote({query,places:data.places});}
      catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Search unavailable. Select a saved partner or map location.");}
      finally{if(!controller.signal.aborted)setLoading(false);}
    },1200);
    return()=>{clearTimeout(timer);controller.abort();};
  },[query,open,value]);
  const needle=query.toLocaleLowerCase(),saved=partners.filter(p=>p.active&&`${p.name} ${p.location.address}`.toLocaleLowerCase().includes(needle)).slice(0,6);
  const earlier=previous.filter(p=>`${p.name} ${p.address}`.toLocaleLowerCase().includes(needle)&&!saved.some(s=>s.location.lat===p.lat&&s.location.lng===p.lng)).slice(0,3);
  const suggestions=[...saved.map(p=>({...p.location,name:p.name,source:"partner" as const,partnerId:p.id})),...earlier,...(remote.query===query?remote.places:[])];
  function choose(place:Place){onChange(place);setQuery(place.name);setOpen(false);setError("");setLoading(false);}
  function focusOption(index:number){const buttons=box.current?.querySelectorAll<HTMLButtonElement>("[role=option]");if(buttons?.length)buttons[(index+buttons.length)%buttons.length].focus();}
  function useCoordinates(){
    const parsed=placeInput.safeParse({name:query.trim()||"Pinned location",address:query.trim()||`${lat}, ${lng}`,lat:Number(lat),lng:Number(lng),source:"manual"});
    if(!lat.trim()||!lng.trim()||!parsed.success){setError("Enter valid latitude and longitude, then check the pin on the map.");return;}
    choose(parsed.data);setManual(false);
  }
  return <div className="place-picker" ref={box}>
    <label htmlFor={id}>{label}</label>
    <div className="place-search"><Search size={17}/><input ref={input} id={id} value={value?.name??query} maxLength={120} placeholder="Search a shop, building, road or area…" autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={open&&!value} aria-controls={`${id}-results`} onFocus={()=>setOpen(true)} onChange={event=>{onChange(null);setQuery(event.target.value);setOpen(true);setError("");setLoading(false);}} onKeyDown={event=>{if(event.key==="ArrowDown"&&suggestions.length){event.preventDefault();setOpen(true);focusOption(0);}else if(event.key==="Escape")setOpen(false);else if(event.key==="Enter"&&open&&!value){event.preventDefault();if(suggestions[0])choose(suggestions[0]);}}}/>{value&&<button type="button" aria-label={`Clear ${label}`} onClick={()=>{onChange(null);setQuery("");setOpen(true);input.current?.focus();}}>×</button>}</div>
    {open&&!value&&<div className="place-results" id={`${id}-results`} role="listbox" aria-label={`${label} suggestions`}>
      {suggestions.map((place,index)=><button type="button" role="option" aria-selected={false} key={`${place.source}-${place.partnerId??place.address}-${index}`} onClick={()=>choose(place)} onKeyDown={event=>{if(event.key==="ArrowDown"||event.key==="ArrowUp"){event.preventDefault();focusOption(index+(event.key==="ArrowDown"?1:-1));}else if(event.key==="Escape"){setOpen(false);input.current?.focus();}}}>{place.source==="partner"?<Store size={17}/>:<MapPin size={17}/>}<span><strong>{place.name}</strong><small>{place.source==="partner"?"Registered partner · ":place.source==="previous"?"Previous location · ":""}{place.address}</small></span></button>)}
      {loading&&<p aria-live="polite">Searching places…</p>}{!suggestions.length&&!loading&&<p>{query.trim().length<3?"Choose a registered partner or type at least 3 characters.":"Choose a result when it appears, or set the exact pin on the map."}</p>}
    </div>}
    {value&&<div className="chosen-place"><MapPin size={17}/><span><strong>{value.address}</strong><small>{value.lat.toFixed(6)}, {value.lng.toFixed(6)} · {value.source==="photon"?"Place search result — check the entrance pin":value.source==="partner"?"Registered partner location":"Office-selected pin"}</small></span></div>}
    <div className="place-tools"><button type="button" onClick={()=>{setMapOpen(true);setOpen(false);}}><Target size={14}/>{value?"Check / adjust map pin":"Choose on map"}</button><button type="button" onClick={()=>setManual(v=>!v)}>Enter coordinates</button><small>Place search: Photon / OpenStreetMap</small></div>
    {manual&&<div className="manual-coordinate-fields"><label>Latitude<input type="number" min={-85} max={85} step="any" value={lat} onChange={e=>setLat(e.target.value)}/></label><label>Longitude<input type="number" min={-180} max={180} step="any" value={lng} onChange={e=>setLng(e.target.value)}/></label><button type="button" onClick={useCoordinates}>Use coordinates</button></div>}
    {error&&<p role="alert" className="office-form-error">{error}</p>}
    {mapOpen&&<OfficeModal title={`Locate ${label.toLowerCase()}`} onClose={()=>setMapOpen(false)} wide><p className="office-note">Move the map until the crosshair is on the entrance or collection point. Zoom in to check it.</p><JourneyMap points={[]} latest={null} focusPlace={value??initialCenter} destinations={value?[{...value,id:"selected-location",arrivedAt:null,deliveredAt:null}]:[]} onPick={coordinates=>{choose({name:value?.name??(query.trim()||"Pinned location"),address:value?.address??(query.trim()||`${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)}`),lat:Number(coordinates.lat.toFixed(6)),lng:Number(coordinates.lng.toFixed(6)),source:"manual"});setMapOpen(false);}}/></OfficeModal>}
  </div>;
}
