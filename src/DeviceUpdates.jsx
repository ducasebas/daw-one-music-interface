import {tr} from "../shared/i18n.js";
import React,{createContext,useContext,useEffect,useRef,useState,useCallback,useMemo} from 'react';
import {updatePhases} from '../shared/update-settings.js';
import {deviceActionMessage} from '../shared/device-feedback.js';
import {BusyStatus} from './BusyStatus.jsx';
const Context=createContext(null);
export const phaseLabels={checking:'Updates controleren',available:'Update beschikbaar',paused:'Updates gepauzeerd','waiting-idle':'Wachten tot muziek gestopt is','waiting-window':'Wachten op het tijdvenster',downloading:'Downloaden',verifying:'Handtekening controleren',preparing:'Voorbereiden',installing:'Installeren',restarting:'Opnieuw starten','checking-health':'Opstartcontrole','rolling-back':'Vorige versie herstellen',installed:'Update voltooid','rolled-back':'Vorige versie hersteld','up-to-date':'Bijgewerkt','no-release':'Nog geen ondertekende release','not-configured':'Nog niet ingesteld',error:'Update niet voltooid'};
export function DeviceUpdatesProvider({children}){
 const [info,setInfo]=useState(null),[pending,setPending]=useState(false),[notice,setNotice]=useState(''),[activity,setActivity]=useState(null);
 const operations=useRef(new Map()),operationId=useRef(0);
 const inFlight=useRef(0);
 const latest=useRef(null),serialized=useRef(''),fastUntil=useRef(0),refreshRef=useRef(()=>{});
 useEffect(()=>{let active=true,timer,controller,generation=0;const read=async()=>{
  const requestGeneration=++generation;
  controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),4000);
  try{const response=await fetch('/api/updates',{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error();const next={...await response.json(),offline:false};if(active&&requestGeneration===generation){latest.current=next;const json=JSON.stringify(next);if(json!==serialized.current){serialized.current=json;setInfo(next);}}}
  catch{if(active&&requestGeneration===generation){serialized.current='';setInfo(old=>old?.offline?old:{...old,offline:true});}}finally{clearTimeout(timeout);if(active&&requestGeneration===generation)timer=setTimeout(read,performance.now()<fastUntil.current||updatePhases.includes(latest.current?.status)?1000:document.hidden?10000:latest.current?.manager?.configured?3000:10000);}
 };refreshRef.current=()=>{clearTimeout(timer);controller?.abort();read();};const visible=()=>{if(!document.hidden)refreshRef.current();};document.addEventListener('visibilitychange',visible);read();return()=>{active=false;clearTimeout(timer);controller?.abort();document.removeEventListener('visibilitychange',visible);};},[]);
 const refresh=useCallback(()=>{fastUntil.current=performance.now()+60000;refreshRef.current();},[]);
 const action=useCallback(async(command,args={})=>{
  const id=++operationId.current,label=deviceActionMessage(command);
  if(label){operations.current.set(id,label);setActivity(operations.current.values().next().value);}
  inFlight.current++;setPending(true);setNotice('');
  try{const response=await fetch('/api/device',{method:'POST',headers:{'Content-Type':'application/json','X-TuneBox-Control':latest.current?.controlToken||''},body:JSON.stringify({command,args}),signal:AbortSignal.timeout(30000)});const data=await response.json();if(!response.ok)throw Object.assign(Error(data.error||'Actie niet gelukt'),data.code==='update-group-confirmation'?{code:data.code,rooms:data.rooms,roomsRevision:data.roomsRevision}:{});setNotice(data.message|| (data.queued?'':data.saved?'Opgeslagen':''));refresh();return data;}
  catch(error){setNotice(error.name==='TimeoutError'?'Verbinding onderbroken; controleer de apparaatstatus voordat je opnieuw probeert':error.message);throw error;}
  finally{operations.current.delete(id);setActivity(operations.current.values().next().value||null);inFlight.current=Math.max(0,inFlight.current-1);if(!inFlight.current)setPending(false);}
 },[refresh]);
 const value=useMemo(()=>({info,pending,notice,action,refresh}),[info,pending,notice,action,refresh]);
 return <Context.Provider value={value}>{tr(children)}<BusyStatus busy={!!activity} label={activity||'Working…'} name="Device activity" className="global-device-activity"/></Context.Provider>;
}
export const useDeviceUpdates=()=>useContext(Context);
export function UpdateProgress({info,compact=false}){
 const active=updatePhases.includes(info?.status),percent=typeof info?.percent==='number'?info.percent:null;
 return <section className={'update-progress '+(compact?'compact':'')} aria-label={tr("Updatevoortgang")} aria-live="polite"><small>{tr(info?.manager?.simulated?'GESIMULEERDE UPDATE · GEEN SOFTWAREWIJZIGING':'DAW TUNEBOX · SOFTWARE')}</small><h3>{tr(phaseLabels[info?.status]||info?.status||'Controleren…')}</h3>{active&&<progress aria-label={tr("Updatevoortgang")} max="100" {...(percent!==null?{value:percent}:{})}/>}<p>{tr(info?.offline?'Backend start opnieuw · voortgang wordt hersteld zodra hij bereikbaar is':percent!==null?`${percent}% gedownload`:active?'Instellingen en Music Assistant-configuratie blijven behouden.':'Updates installeren zodra het apparaat veilig beschikbaar is.')}</p>{active&&<ol className="update-steps" aria-label={tr("Updatestappen")}>{['downloading','verifying','preparing','installing','restarting','checking-health'].map((phase,i)=><li key={phase} aria-current={info.status===phase?'step':undefined}>{tr(i+1)}<span>{tr(phaseLabels[phase])}</span></li>)}</ol>}</section>;
}
export function GlobalUpdateProgress(){
 const {info}=useDeviceUpdates();const wasBusy=useRef(false);
 const critical=['installing','restarting','checking-health','rolling-back'].includes(info?.status);
 useEffect(()=>{
  if(critical){wasBusy.current=true;if(info.manager?.progressDisplay&&!info.manager?.simulated&&['127.0.0.1','localhost'].includes(location.hostname)&&location.port==='3001'&&new URLSearchParams(location.search).get('screen')==='1'){
   const q=new URLSearchParams(location.search);location.replace('http://127.0.0.1:3002/?display='+(q.get('display')==='dsi-production'?'dsi-production':'hdmi-development')+(q.get('profile')==='pi3'?'&profile=pi3':'')+'&panel='+(q.get('panel')==='wall-16-10'?'wall-16-10':'legacy-wide'));
  }}else if(wasBusy.current&&!info?.offline&&['installed','rolled-back'].includes(info?.status)){
   wasBusy.current=false;if(!info.manager?.simulated)location.reload();
  }
 },[critical,info?.status,info?.offline,info?.manager?.simulated,info?.manager?.progressDisplay]);
 return critical?<div className="update-overlay"><UpdateProgress info={info}/></div>:null;
}
