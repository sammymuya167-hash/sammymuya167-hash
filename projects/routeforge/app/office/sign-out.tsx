"use client";
import { useState } from "react";
import { LogOut } from "lucide-react";
export function SignOut(){const [busy,setBusy]=useState(false),[error,setError]=useState("");async function signOut(){setBusy(true);try{const response=await fetch("/api/auth/logout",{method:"POST"});if(!response.ok)throw new Error("Sign-out could not be confirmed. Retry when connected.");window.location.replace(new URL("/login",window.location.origin).href);}catch(e){setError(e instanceof Error?e.message:"Could not sign out.");setBusy(false);}}return <><button className="office-secondary" disabled={busy} onClick={()=>void signOut()}><LogOut size={15}/>{busy?"Signing out…":"Sign out"}</button>{error&&<p className="office-error" role="alert">{error}</p>}</>;}
