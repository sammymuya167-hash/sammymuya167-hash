"use client";
import {useEffect,useState} from "react";
import {Download,RefreshCw,ShieldCheck} from "lucide-react";
import {api} from "../ui";
type Release={version:string;versionCode:number;bytes:number;supportedAbis:string[];sha256:string;downloadPath:string};
type Policy={enabled:boolean;critical:boolean;latestVersion:string;notes:string;revision:string};
export default function AndroidOffice({isOwner}:{isOwner:boolean}){
 const [releases,setReleases]=useState<Release[]>([]),[policy,setPolicy]=useState<Policy|null>(null),[reason,setReason]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 async function load(){setBusy(true);try{const r=await api<{policy:Policy;releases:Release[]}>("office/app-updates");setReleases(r.releases);setPolicy(r.policy);setMessage("")}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}}
 useEffect(()=>{if(isOwner)void load()},[isOwner]);
 if(!isOwner)return <section className="panel office-section"><h2>Owner access required</h2><p>Only the system owner can choose the Android release offered to clients.</p></section>;
 const selected=releases.find(r=>r.version===policy?.latestVersion);
 return <section className="panel office-section" style={{maxWidth:820}}>
 <div className="section-heading"><h2><Download size={22}/> Android updates</h2><button className="secondary" disabled={busy} onClick={()=>void load()}><RefreshCw size={16}/>Reload releases</button></div>
 <p>Publish a signed APK, then choose the release your clients see. The app checks when it opens, returns to the foreground and every 15 minutes while open.</p>
 {message&&<p role="status" className="error-banner">{message}</p>}
 {policy&&<form onSubmit={async e=>{e.preventDefault();setBusy(true);try{const r=await api<{policy:Policy}>("office/app-updates",{...policy,reason});setPolicy(r.policy);setReason("");setMessage("Android update settings saved. Clients receive them on their next check.")}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}}} style={{display:"grid",gap:20}}>
 <label className="row"><input type="checkbox" checked={policy.enabled} onChange={e=>setPolicy({...policy,enabled:e.target.checked})}/>Show update notices to clients</label>
 <label>Release offered to clients<select value={policy.latestVersion} onChange={e=>setPolicy({...policy,latestVersion:e.target.value})}>{releases.map(r=><option key={r.version} value={r.version}>{r.version} · build {r.versionCode} · {(r.bytes/1000000).toFixed(1)} MB · {r.supportedAbis.join(", ")}</option>)}</select></label>
 <label className="row"><input type="checkbox" checked={policy.critical} onChange={e=>setPolicy({...policy,critical:e.target.checked})}/>Important update — keep the notice visible until installed</label>
 <label>What's new<textarea rows={5} maxLength={2000} value={policy.notes} onChange={e=>setPolicy({...policy,notes:e.target.value})} placeholder="Tell clients what has improved."/></label>
 <label>Reason for this change<input required minLength={8} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Recorded in your audit trail"/></label>
 <button className="primary" disabled={busy||!selected||reason.trim().length<8}>Save update settings<ShieldCheck size={17}/></button>
 </form>}
 {selected&&<div style={{marginTop:24}}><a className="secondary" href={selected.downloadPath}><Download size={16}/>Download {selected.version}</a><p className="muted" style={{overflowWrap:"anywhere"}}>SHA-256: {selected.sha256}</p></div>}
 <hr style={{margin:"24px 0"}}/><p><strong>Changes from your office apply remotely.</strong> Accounts, bans, rules, announcements, posting and media settings use the shared backend. New native features require a signed APK update approved by the phone's owner.</p>
 <p className="muted">Automatic update checks start with v0.4.0. Earlier versions need that first update installed manually. Turning notices off leaves the installed app usable. Selecting an older release never downgrades a client's app.</p>
 </section>;
}
