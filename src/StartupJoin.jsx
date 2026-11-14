import React,{useEffect,useRef,useState} from 'react';
import {tr,translateFormat} from '../shared/i18n.js';
import {startupJoinTargets} from '../shared/multiroom.js';
import {Modal} from './Modal.jsx';
import {Icon} from './Icon.jsx';

const storageKey='tunebox-startup-room-choice';
const handled=id=>{try{return JSON.parse(localStorage.getItem(storageKey))?.bootId===id;}catch{return false;}};
const remember=id=>{try{localStorage.setItem(storageKey,JSON.stringify({bootId:id}));}catch{}};

export function StartupJoin({active,controlToken,onSnapshot,onRooms,onUnlock}){
 const [data,setData]=useState(null),[done,setDone]=useState(false),[pending,setPending]=useState(null),[error,setError]=useState('');
 const token=useRef(controlToken),latest=useRef(null),connectedAt=useRef(null),joining=useRef(false);token.current=controlToken;latest.current=data;
 useEffect(()=>{
  if(!active||done){setData(null);return;}
  let live=true,timer,controller,finished=false;
  const finish=id=>{remember(id);finished=true;if(live)setDone(true);};
  const read=async()=>{
   if(joining.current){timer=setTimeout(read,3000);return;}
   controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),5000);
   try{
    const r=await fetch('/api/rooms',{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error();const value=await r.json();
    if(!live)return;
    if(!value.configured||!value.bootId){finished=true;return;}
    if(handled(value.bootId)){finished=true;setDone(true);return;}
    const local=value.rooms.find(p=>p.id===value.localId);
    if(value.connected&&local?.available){
     if(local.parentId||local.members.length||local.state==='playing'){finish(value.bootId);return;}
     connectedAt.current??=Date.now();
     if(startupJoinTargets(value).length)setData(value);
     else if(Date.now()-connectedAt.current>30000)finish(value.bootId);
     else setData(old=>old?value:null);
    }else setData(old=>old?{...old,stale:true}:null);
   }catch{if(live)setData(old=>old?{...old,stale:true}:null);}
   finally{clearTimeout(timeout);if(live&&!finished)timer=setTimeout(read,3000);}
  };
  read();return()=>{live=false;controller?.abort();clearTimeout(timer);};
 },[active,done]);
 const dismiss=()=>{if(joining.current)return;remember(data.bootId);setDone(true);};
 async function join(target){
  if(joining.current||!token.current)return;joining.current=true;setPending(target.id);setError('');
  let failure='Joining could not be confirmed. Check Rooms before trying again.';
  try{
   const value=latest.current;
   const r=await fetch('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json','X-TuneBox-Control':token.current},body:JSON.stringify({action:'join',playerId:value.localId,targetId:target.id,revision:value.revision,confirmed:true}),signal:AbortSignal.timeout(30000)});
   const result=await r.json();
   if(!r.ok){if(result.rooms)setData(result.rooms);if(r.status===423)setData(old=>({...old,locked:true}));if(typeof result.error==='string')failure=result.error;throw Error(failure);}
   if(result.snapshot)onSnapshot?.(result.snapshot);remember(value.bootId);setDone(true);
  }catch{setError(failure);setData(old=>old?{...old,stale:true}:null);}
  finally{joining.current=false;setPending(null);}
 }
 if(!active||done||!data)return null;
 const targets=startupJoinTargets(data),local=data.rooms.find(p=>p.id===data.localId),volumeReady=Number.isFinite(local?.volume)&&local.volume<=data.limit;
 return <Modal label="Join existing music" className="rooms-dialog startup-join" onCancel={dismiss}>
  <header><div><span className="rooms-eyebrow">{tr('WELCOME BACK')}</span><h2>{tr('Music is already playing')}</h2></div><Icon name="network" size={38}/></header>
  <p className="rooms-dialog-description">{tr('Listen here too? The playing room stays the leader and keeps its queue and volume. Music Assistant may briefly interrupt playback while adding this TuneBox.')}</p>
  <div className="startup-join-choices">{targets.map(room=><div key={room.id}><Icon name="speaker" size={30}/><div><strong>{room.name}</strong><span>{room.title||tr('Playing')}{room.artist?' · '+room.artist:''}</span></div><button disabled={!!pending||data.stale||data.busy||data.locked||!volumeReady||!controlToken} onClick={()=>join(room)} aria-label={translateFormat('Join {room}',{room:room.name})}>{pending===room.id?<span className="rooms-spinner"/>:<Icon name="network"/>}{tr(pending===room.id?'Synchronizing…':'Listen together')}</button></div>)}</div>
  {!targets.length&&<p role="status">{tr('The playing rooms changed. Open Rooms to choose what to listen to.')}</p>}
  <p className="startup-join-volume">{tr('TuneBox volume')}: {local?.volume??'—'}%{local?.muted?' · '+tr('Muted'):''}</p>
  {!volumeReady&&<p role="status">{tr('Check or lower TuneBox volume in Rooms before joining.')}</p>}
  {data.locked&&<button disabled={!!pending} onClick={onUnlock}><Icon name="lock"/>{tr('Unlock settings to join')}</button>}
  {data.stale&&<p role="status">{tr('Waiting for current room status…')}</p>}
  {error&&<p className="rooms-error" role="alert">{tr(error)}</p>}
  <footer><button disabled={!!pending} onClick={onRooms}>{tr('Open Rooms')}</button><button disabled={!!pending} onClick={dismiss}>{tr('Keep separate')}</button></footer>
 </Modal>;
}
