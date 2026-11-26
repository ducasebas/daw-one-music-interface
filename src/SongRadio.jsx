import React,{useRef,useState} from 'react';
import {Modal} from './Modal.jsx';
import {Icon} from './Icon.jsx';
import {tr} from '../shared/i18n.js';
import {useDeviceUpdates} from './DeviceUpdates.jsx';
export function SongRadio({snapshot,offline,onSnapshot}){
 const [open,setOpen]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState(''),[replace,setReplace]=useState(false),seed=useRef(null),busy=useRef(false),updates=useDeviceUpdates();
 const track=snapshot.playback?.queue?.[snapshot.playback?.index||0];
 const available=!offline&&snapshot.mode==='music-assistant'&&snapshot.musicAssistant?.connected&&track?.mediaKey;
 async function start(){
  if(busy.current)return;busy.current=true;setPending(true);setError('');
  try{const r=await fetch('/api/library/radio',{method:'POST',headers:{'Content-Type':'application/json','X-TuneBox-Control':updates.info?.controlToken||''},body:JSON.stringify({mediaKey:seed.current?.key,confirmReplace:replace}),signal:AbortSignal.timeout(15000)});const v=await r.json();
   if(!r.ok){if(v.code==='queue-not-empty'){setReplace(true);return;}throw Error(v.error||'Radio could not start.');}
   onSnapshot?.(v);setOpen(false);
  }catch(e){setError(e.name==='TimeoutError'?'The request timed out. Check the queue before trying again.':e.message);}finally{setPending(false);busy.current=false;}
 }
 return <><button className="song-radio" disabled={!available} onClick={()=>{seed.current={key:track.mediaKey,title:track.title};setReplace(false);setError('');setOpen(true);}}><Icon name="radio" size={26}/>{tr('Start song radio')}</button>{open&&<Modal label="Start song radio" onCancel={()=>!pending&&setOpen(false)}><h3>{seed.current?.title}</h3><p>{tr('Music Assistant builds a mix from this song. Your music provider must support similar tracks.')}</p><p>{tr('This changes the selected room or group queue. Current volume limits still apply.')}</p>{replace&&<p role="alert">{tr('Music is waiting in the queue. Starting radio will replace it.')}</p>}{error&&<p role="alert">{tr(error)}</p>}<button disabled={pending} onClick={start} aria-busy={pending}>{pending&&<span className="busy-spinner" aria-hidden="true"/>}{tr(pending?'Starting radio…':replace?'Replace queue and start radio':'Start radio')}</button><button disabled={pending} onClick={()=>setOpen(false)}>{tr('Cancel')}</button></Modal>}</>;
}
