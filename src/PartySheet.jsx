import React,{useEffect,useRef,useState} from 'react';
import {tr,translateFormat} from '../shared/i18n.js';
import {Modal} from './Modal.jsx';
import {QrCode} from './NetworkWizard.jsx';
import {useDeviceUpdates} from './DeviceUpdates.jsx';

/** Party: show the phone-remote code right on Now Playing. With a settings PIN, guests
 * also need that PIN on their phone, so the code alone never hands over control. */
export function PartySheet({snapshot,onClose,onRooms}){
 const device=useDeviceUpdates(),token=device.info?.controlToken;
 const [pair,setPair]=useState(null),[error,setError]=useState(''),[now,setNow]=useState(Date.now()),open=useRef(false);
 const phones=Number(snapshot.remoteControl?.phones)||0,start=useRef(phones);
 const call=action=>fetch('/api/remote/party',{method:'POST',headers:{'Content-Type':'application/json','X-TuneBox-Control':token||''},body:JSON.stringify({action})}).then(async r=>{const v=await r.json().catch(()=>({}));if(!r.ok)throw Error(v.error||'The party code is not available right now.');return v;});
 const show=()=>{setError('');call('start').then(v=>{open.current=true;start.current=Number(snapshot.remoteControl?.phones)||0;setPair(v);setNow(Date.now());}).catch(e=>setError(e.message));};
 useEffect(()=>{if(token)show();return()=>{if(open.current)call('cancel').catch(()=>{});};},[token]);
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t);},[]);
 // A newly paired phone uses up the single-use code: offer the next one straight away.
 useEffect(()=>{if(pair&&phones>start.current){open.current=false;setPair(null);show();}},[phones]);
 const left=pair?Math.max(0,Math.ceil((pair.expiresAt-now)/1000)):0;
 const ma=snapshot.musicAssistant,keep=ma?.keepPlaying,room=snapshot.playback?.playerName||'TuneBox';
 // Multiroom awareness: grouped rooms play along with whatever the phones choose.
 // localIndependent is also false while Music Assistant is away, so only trust it when connected.
 const grouped=snapshot.mode==='music-assistant'&&snapshot.musicAssistant?.connected===true&&snapshot.activity?.localIndependent===false;
 return <Modal label="Party mode" onCancel={onClose} className="party-sheet">
  <header><h3>{tr('Party mode')}</h3><button onClick={onClose}>{tr('Close')}</button></header>
  <div className="party-body">
   <div className="party-code">{pair&&left>0?<QrCode value={pair.url} label="Scan with your phone camera"/>:<p role="status">{tr(error||(pair?'This code has expired.':'Preparing the code…'))}</p>}
    {pair&&left===0&&<button onClick={show}>{tr('Show a new code')}</button>}</div>
   <div className="party-info">
    <p className="party-lead">{tr('Guests scan this code to search music, add songs and change the volume from their phone.')}</p>
    <ul>
     <li>{snapshot.remoteControl?.pinRequired?tr('Guests also enter the settings PIN on their phone.'):tr('No PIN is set: anyone who scans this code can pair.')}</li>
     <li>{translateFormat(phones===1?'{count} phone paired':'{count} phones paired',{count:phones})}</li>
     <li>{tr(keep?.wanted===false?'Keep the music playing is off.':keep?.active===true?'Keep the music playing is on: the music continues when the queue ends.':'Keep the music playing is on.')}</li>
     <li>{grouped?translateFormat('Phones control the group that {room} plays in. Other rooms in that group play along.',{room}):translateFormat('Phones control {room} only. Other rooms are not affected.',{room})}</li>
    </ul>
    {pair&&left>0&&<p className="party-countdown">{tr('Code valid for')} {Math.floor(left/60)}:{String(left%60).padStart(2,'0')}</p>}
    <button onClick={()=>{onClose();onRooms?.();}}>{tr('Rooms')}</button>
   </div>
  </div>
 </Modal>;
}
