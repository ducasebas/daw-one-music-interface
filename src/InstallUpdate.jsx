import React,{useEffect,useRef,useState} from 'react';
import {useDeviceUpdates} from './DeviceUpdates.jsx';
import {tr} from '../shared/i18n.js';

/** A shared flow for the wall and legacy layouts. Group pause is explicit. */
export function InstallUpdate({disabled=false}){
  const {info,action}=useDeviceUpdates();
  const [confirmation,setConfirmation]=useState(null),[working,setWorking]=useState(false),[error,setError]=useState(''),[queued,setQueued]=useState(null);
  const sending=useRef(false),mounted=useRef(false),cancel=useRef(null);
  const candidate=info?.available?.commit||info?.available?.release;
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{setConfirmation(null);setError('');setQueued(null);},[candidate]);
  useEffect(()=>{if(confirmation)cancel.current?.focus();},[confirmation]);
  async function install(args={}){
    if(sending.current)return;
    sending.current=true;setWorking(true);setError('');setConfirmation(null);
    try{const result=await action('install',args);if(mounted.current)setQueued(result?.withoutMusicAssistant?'Installing without Music Assistant: the audio output is silent. TuneBox restarts when the update is ready.':'Update started. TuneBox restarts when it is ready.');}
    catch(e){
      if(!mounted.current)return;
      if(e.code==='update-group-confirmation'&&Array.isArray(e.rooms)&&e.rooms.length>0&&e.rooms.length<=128&&e.rooms.every(p=>typeof p?.id==='string'&&typeof p.name==='string')&&/^[a-f0-9]{64}$/.test(e.roomsRevision))setConfirmation({rooms:e.rooms,revision:e.roomsRevision});
      else setError(e.message);
    }finally{sending.current=false;if(mounted.current)setWorking(false);}
  }
  return <section className="install-update-action">
    <button disabled={disabled||working} aria-busy={working} onClick={()=>install()}>{working&&<span className="ui-spinner"/>}{tr(working?'Preparing update…':'Install update')}</button>
    {working&&<p role="status">{tr('Pausing playback and checking the device…')}</p>}
    {confirmation&&<section className="update-group-confirm" role="alertdialog" aria-label={tr('Pause rooms for update')} aria-modal="false" onKeyDown={event=>{if(event.key==='Escape'&&!working){event.preventDefault();setConfirmation(null);}}}>
      <h3>{tr('Pause these rooms?')}</h3><p>{tr('These rooms share playback with TuneBox. Installing will pause their music too.')}</p>
      <ul>{confirmation.rooms.map(p=><li key={p.id}>{p.name}</li>)}</ul>
      <p>{tr('Queues and volumes stay unchanged. Music stays paused after the update.')}</p>
      <div><button disabled={disabled||working} onClick={()=>install({pauseGroup:true,roomsRevision:confirmation.revision})}>{tr('Pause rooms and install')}</button><button ref={cancel} disabled={working} onClick={()=>setConfirmation(null)}>{tr('Cancel')}</button></div>
    </section>}
    {queued&&!error&&<p role="status" className="install-update-queued">{tr(queued)}</p>}
    {error&&<p role="alert" className="install-update-error">{tr(error)}</p>}
  </section>;
}
