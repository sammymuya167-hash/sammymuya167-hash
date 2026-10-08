"use client";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
export function OfficeModal({title,onClose,children,wide=false}:{title:string;onClose:()=>void;children:React.ReactNode;wide?:boolean}){
  const ref=useRef<HTMLDialogElement>(null),id=useId();
  useEffect(()=>{const dialog=ref.current;if(dialog&&!dialog.open)dialog.showModal();return()=>{if(dialog?.open)dialog.close();};},[]);
  if(typeof document==="undefined")return null;
  return createPortal(<dialog ref={ref} className={`office-modal ${wide?"wide":""}`} aria-labelledby={id} onCancel={event=>{event.preventDefault();onClose();}}>
    <header><div><span className="tiny-label">SHADOWNET · DRIVER OPERATIONS</span><h2 id={id}>{title}</h2></div><button type="button" onClick={onClose} aria-label="Close dialog"><X size={21}/></button></header>
    {children}
  </dialog>,document.body);
}
