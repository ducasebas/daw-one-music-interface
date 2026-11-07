import React,{createContext,useContext,useEffect,useRef,useState,useCallback} from 'react';
import {updatePhases} from '../shared/update-settings.js';
const Context=createContext(null);
export const phaseLabels={checking:'Updates controleren',available:'Update beschikbaar',paused:'Updates gepauzeerd','waiting-idle':'Wachten tot muziek gestopt is','waiting-window':'Wachten op het tijdvenster',downloading:'Downloaden',verifying:'Handtekening controleren',preparing:'Voorbereiden',installing:'Installeren',restarting:'Opnieuw starten','checking-health':'Opstartcontrole','rolling-back':'Vorige versie herstellen',installed:'Update voltooid','rolled-back':'Vorige versie hersteld','up-to-date':'Bijgewerkt','no-release':'Nog geen ondertekende release','not-configured':'Nog niet ingesteld',error:'Update niet voltooid'};
export function DeviceUpdatesProvider({children}){
 const [info,setInfo]=useState(null),[pending,setPending]=useState(false),[notice,setNotice]=useState('');
 const latest=useRef(null),fastUntil=useRef(0),refreshRef=useRef(()=>{});
 useEffect(()=>{let active=true,timer,controller,generation=0;const read=async()=>{
  const requestGeneration=++generation;
  controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),4000);
  try{const response=await fetch('/api/updates',{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error();const next=await response.json();if(active&&requestGeneration===generation){latest.current={...next,offline:false};setInfo(latest.current);}}
  catch{if(active&&requestGeneration===generation)setInfo(old=>({...old,offline:true}));}finally{clearTimeout(timeout);if(active&&requestGeneration===generation)timer=setTimeout(read,Date.now()<fastUntil.current||updatePhases.includes(latest.current?.status)||latest.current?.manager?.progressDisplay&&latest.current?.manager?.configured?1000:10000);}
 };refreshRef.current=()=>{clearTimeout(timer);controller?.abort();read();};read();return()=>{active=false;clearTimeout(timer);controller?.abort();};},[]);
 const refresh=useCallback(()=>{fastUntil.current=Date.now()+60000;refreshRef.current();},[]);
 const action=useCallback(async(command,args={})=>{
  setPending(true);setNotice('');
  try{const response=await fetch('/api/device',{method:'POST',headers:{'Content-Type':'application/json','X-TuneBox-Control':latest.current?.controlToken||''},body:JSON.stringify({command,args}),signal:AbortSignal.timeout(30000)});const data=await response.json();if(!response.ok)throw Error(data.error||'Actie niet gelukt');setNotice(data.message|| (data.queued?'Actie aangevraagd':data.saved?'Opgeslagen':''));refresh();return data;}
  catch(error){setNotice(error.name==='TimeoutError'?'Verbinding onderbroken; controleer de apparaatstatus voordat je opnieuw probeert':error.message);throw error;}
  finally{setPending(false);}
 },[refresh]);
 return <Context.Provider value={{info,pending,notice,action,refresh}}>{children}</Context.Provider>;
}
export const useDeviceUpdates=()=>useContext(Context);
export function UpdateProgress({info,compact=false}){
 const active=updatePhases.includes(info?.status),percent=typeof info?.percent==='number'?info.percent:null;
 return <section className={'update-progress '+(compact?'compact':'')} aria-label="Updatevoortgang" aria-live="polite"><small>{info?.manager?.simulated?'GESIMULEERDE UPDATE · GEEN SOFTWAREWIJZIGING':'DAW TUNEBOX · SOFTWARE'}</small><h3>{phaseLabels[info?.status]||info?.status||'Controleren…'}</h3>{active&&<progress aria-label="Updatevoortgang" max="100" {...(percent!==null?{value:percent}:{})}/>}<p>{info?.offline?'Backend start opnieuw · voortgang wordt hersteld zodra hij bereikbaar is':percent!==null?`${percent}% gedownload`:active?'Instellingen en Music Assistant-configuratie blijven behouden.':'Updates installeren zodra het apparaat veilig beschikbaar is.'}</p>{active&&<ol className="update-steps" aria-label="Updatestappen">{['downloading','verifying','preparing','installing','restarting','checking-health'].map((phase,i)=><li key={phase} aria-current={info.status===phase?'step':undefined}>{i+1}<span>{phaseLabels[phase]}</span></li>)}</ol>}</section>;
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
