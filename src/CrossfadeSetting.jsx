import React,{useEffect,useState} from 'react';
import {tr,translateFormat} from '../shared/i18n.js';
import {useDeviceUpdates} from './DeviceUpdates.jsx';
import {crossfadeDefaultSeconds} from '../shared/crossfade.js';
/** Crossfade between songs, stored in Music Assistant's player settings. Applies immediately; hidden when unsupported. */
export function CrossfadeSetting({offline=false}){
 const device=useDeviceUpdates(),[state,setState]=useState(null),[seconds,setSeconds]=useState(crossfadeDefaultSeconds),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 useEffect(()=>{if(offline)return;let live=true;fetch('/api/music/crossfade',{cache:'no-store'}).then(r=>r.json()).then(v=>{if(!live)return;setState(v);if(v.enabled&&Number.isFinite(v.seconds))setSeconds(v.seconds);}).catch(()=>{if(live)setState({supported:false});});return()=>{live=false;};},[offline]);
 if(!state?.supported)return null;
 async function save(enabled,value=seconds){setBusy(true);setNotice('');try{const r=await fetch('/api/music/crossfade',{method:'POST',headers:{'Content-Type':'application/json','X-TuneBox-Control':device?.info?.controlToken||''},body:JSON.stringify({enabled,seconds:value})});const v=await r.json();if(!r.ok)throw Error(v.error||'Crossfade could not be changed');setState(v);if(Number.isFinite(v.seconds))setSeconds(v.seconds);setNotice(v.enabled?translateFormat('Crossfade {seconds} s',{seconds:String(v.seconds).replace('.',',')}):'Crossfade off');}catch(e){setNotice(e.message);}finally{setBusy(false);}}
 const step=state.step||1;
 return <div className="crossfade-setting">
  <label className="hub-check"><input type="checkbox" aria-label={tr('Crossfade between songs')} checked={state.enabled===true} disabled={busy||offline} onChange={e=>save(e.target.checked)}/>{tr('Crossfade between songs')}</label>
  {state.enabled&&<label>{tr('Crossfade length')}<input aria-label={tr('Crossfade length')} type="range" min={state.min} max={state.max} step={step} value={seconds} disabled={busy||offline} onChange={e=>setSeconds(Number(e.target.value))} onPointerUp={()=>save(true)} onKeyUp={()=>save(true)}/><output>{String(seconds).replace('.',',')} s</output></label>}
  <p>{tr(step===1?'Stored in Music Assistant for this TuneBox. This Music Assistant version accepts whole seconds.':'Stored in Music Assistant for this TuneBox.')}</p>
  {notice&&<p role="status" className="settings-note">{tr(notice)}</p>}
 </div>;
}
