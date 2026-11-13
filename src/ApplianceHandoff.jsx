import React,{useEffect,useState} from 'react';
import {Modal} from './Modal.jsx';
import {QrCode} from './NetworkWizard.jsx';
import {tr} from '../shared/i18n.js';

/** Links leave the wall appliance via a phone, never a second browser window. */
export function ApplianceHandoff(){
 const [link,setLink]=useState(null);
 useEffect(()=>{
  const handler=event=>{
   if(!event.detail?.url)return;
   try{
    const url=new URL(event.detail.url);
    if(!['http:','https:'].includes(url.protocol)||url.origin===location.origin||url.username||url.password||url.href.length>2048)return;
    event.preventDefault();setLink(url.href);
   }catch{}
  };
  window.addEventListener('tunebox:handoff',handler);
  return()=>window.removeEventListener('tunebox:handoff',handler);
 },[]);
 return link&&<Modal label="Open on another device" className="appliance-handoff" onCancel={()=>setLink(null)}><h2>{tr('Open on another device')}</h2><p>{tr('Scan this code with your phone. TuneBox stays on this screen.')}</p><QrCode value={link} label="Open link on your phone"/><code className="handoff-url">{link}</code><button onClick={()=>setLink(null)}>{tr('Close')}</button></Modal>;
}
