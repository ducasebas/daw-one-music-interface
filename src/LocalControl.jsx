import {Modal} from './Modal.jsx';
import React,{useEffect,useRef,useState} from 'react';
import {tr} from '../shared/i18n.js';
import {Icon} from './Icon.jsx';

/** The server pauses only the local amplifier. Testing a connection never resumes it. */
export function LocalControl({snapshot,token,onSnapshot,offline=false,showDialog=true}){
 const local=snapshot.localControl,phase=local?.recovery?.phase,[busy,setBusy]=useState(''),[error,setError]=useState(''),working=useRef(false),[dismissed,setDismissed]=useState(false);
 useEffect(()=>{if(!local?.needed){setError('');setDismissed(false);}},[local?.needed]);
 if(snapshot.bluetooth?.active||!local||!(local.needed||local.lowered||local.standby||phase==='pausing'))return null;
 if(local.needed&&!showDialog)return null;
 const send=async action=>{if(working.current)return;working.current=true;setBusy(action);setError('');
  try{const r=await fetch(action==='reconnect'?'/api/music/reconnect':'/api/local',{method:'POST',headers:{'Content-Type':'application/json','X-TuneBox-Control':token||''},body:JSON.stringify(action==='reconnect'?{}:{action}),signal:AbortSignal.timeout(30000)});const v=await r.json().catch(()=>({}));if(v.snapshot)onSnapshot?.(v.snapshot);else if(v.localControl)onSnapshot?.(v);if(!r.ok)throw Error(v.error||'Local control failed');}
  catch(e){setError(e.name==='TimeoutError'?'The connection test took too long. Try again.':e.message);}finally{working.current=false;setBusy('');}};
 const away=local.needed,pausing=phase==='pausing',unavailable=!!busy||offline||!token;
 const content=<section className="local-control" aria-label={tr('Local control')} data-away={away||undefined}>
  <div className="local-control-text"><strong>{tr(away?local.playbackFault?'Playback needs attention':'Music Assistant is unavailable':'Local amplifier settings are active')}</strong>
   <span role="status">{pausing&&<span className="ui-spinner" aria-hidden="true"/>}{tr(pausing?'Pausing this TuneBox automatically…':away?local.standby?'TuneBox is paused locally. Other rooms and the queue are unchanged.':phase==='failed'?'Automatic local pause failed. Try again.':phase==='unaffected'?'Your current audio source is unchanged.':'Connecting to Music Assistant…':local.standby?'The amplifier is paused locally.':'The local volume is lower than before. Restore it when you are ready.')}</span></div>
  <div className="local-control-actions">
   {away?<><button disabled={unavailable} aria-busy={busy==='reconnect'} onClick={()=>send('reconnect')}><Icon name="update" className={busy==='reconnect'?'is-spinning':''} size={24}/>{tr(busy==='reconnect'?'Checking connection…':'Test connection again')}</button>{local.playbackFault&&local.standby&&<button disabled={unavailable||pausing} onClick={()=>send('resume')}>{tr('Resume locally')}</button>}{phase==='failed'&&!local.standby&&<button disabled={unavailable} onClick={()=>send('pause')}>{tr('Retry local pause')}</button>}</>:local.standby?<button disabled={unavailable||pausing} onClick={()=>send('resume')}><Icon name="play" size={24}/>{tr('Resume locally')}</button>:local.lowered?<button disabled={unavailable} onClick={()=>send('restore')}>{tr('Restore local volume')}</button>:null}
  </div>
  {busy&&<p role="status">{tr(busy==='reconnect'?'Checking connection…':'Working…')}</p>}
  {error&&<p role="alert">{tr(error)}</p>}
 </section>;
 return away&&!dismissed&&showDialog&&phase!=='idle'?<Modal className="playback-recovery-dialog" label={local.playbackFault?'Playback needs attention':'Music Assistant is unavailable'} onCancel={()=>setDismissed(true)}>{local.playbackFault&&<p>{tr('The local audio output reported repeated underruns. TuneBox keeps its amplifier paused until you resume it. Check Audio diagnostics for the observed output format.')}</p>}{content}<button onClick={()=>setDismissed(true)}>{tr('Close')}</button></Modal>:content;
}
