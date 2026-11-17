import React,{useEffect,useRef,useState} from 'react';
import {useDeviceUpdates} from './DeviceUpdates.jsx';
import {Modal} from './Modal.jsx';
import {Icon} from './Icon.jsx';
import {tr} from '../shared/i18n.js';

export function BluetoothReceiver({snapshot,offline=false}){
 const device=useDeviceUpdates(),[state,setState]=useState(snapshot.bluetooth||{}),[confirm,setConfirm]=useState(false),[forget,setForget]=useState(null),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),refresh=useRef(()=>{});
 useEffect(()=>{let live=true,timer,controller,generation=0;const read=async()=>{if(offline)return;const own=++generation;controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),4000);try{const r=await fetch('/api/bluetooth',{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error();const v=await r.json();if(live&&own===generation)setState(v);}catch{if(live&&own===generation)setNotice('Bluetooth status could not be refreshed');}finally{clearTimeout(timeout);if(live&&own===generation)timer=setTimeout(read,document.hidden?10000:3000);}};refresh.current=()=>{clearTimeout(timer);controller?.abort();read();};read();return()=>{live=false;generation++;clearTimeout(timer);controller?.abort();};},[offline]);
 async function act(command,args={}){if(busy)return;setBusy(true);setNotice('');try{await device.action(command,args);refresh.current();}catch(e){setNotice(e.message);}finally{setBusy(false);}}
 return <section className="bluetooth-receiver" aria-label={tr('Bluetooth receiver')} aria-busy={busy}>
  <h3><Icon name="bluetooth" size={32}/>{tr('Phone → TuneBox')}</h3>
  <p>{tr('Stream phone audio to the local Louder output. Music Assistant and Bluetooth take turns using this output.')}</p>
  {!state.supported?<p role="status">{tr('The optional Bluetooth receiver needs to be installed and tested on this Pi before it can be selected.')}</p>:<>
   <strong>{tr(state.active?'Bluetooth is the local source':snapshot.mode==='music-assistant'?'Music Assistant is the local source':'Bluetooth is ready to use')}</strong>
   {state.active?<><p>{tr('Use the main volume control on TuneBox. Phone volume cannot override its saved ceiling. Playback and track selection stay on your phone.')}</p><button disabled={busy||offline} onClick={()=>act('bluetooth-stop')}>{tr(state.phase==='recovery-required'?'Restore local audio':'Switch back to Music Assistant')}</button><button disabled={busy||offline||state.phase!=='active'} onClick={()=>act(state.discoverable?'bluetooth-close-pairing':'bluetooth-pair')}>{tr(state.discoverable?'Stop pairing':'Pair a phone for 2 minutes')}</button><p role="status">{tr(state.discoverable?'Choose TuneBox in your phone Bluetooth settings, then confirm the matching code here.':'Pairing is closed. Previously approved phones can reconnect while Bluetooth is selected.')}</p></>:<button disabled={busy||offline} onClick={()=>setConfirm(true)}>{tr('Use Bluetooth…')}</button>}
   {state.devices?.map(d=><article className="bluetooth-device" key={d.address}><div><strong>{d.name}</strong><span>{tr(d.connected?'Connected':d.paired?'Paired':'Disconnected')}</span></div>{d.connected&&<button disabled={busy||offline} onClick={()=>act('bluetooth-disconnect',{address:d.address})}>{tr('Disconnect')}</button>}<button disabled={busy||offline||!state.active} onClick={()=>setForget(d)}>{tr('Forget…')}</button></article>)}
  </>}
  {busy&&<p role="status"><span className="ui-spinner"/>{tr('Switching local audio…')}</p>}<p role="status">{tr(notice)}</p>
  {confirm&&<Modal label="Switch local audio source" onCancel={()=>setConfirm(false)}><h3>{tr('Use this TuneBox for phone audio?')}</h3><p>{tr(snapshot.mode==='music-assistant'?'First pause music, select the local TuneBox player and leave any group. Only this Pi player is stopped. Bluetooth starts muted; increase volume on TuneBox after connecting.':'Music Assistant is not required for Bluetooth. The local ALSA output must be idle. The known local player services are suspended, and Bluetooth starts muted.')}</p><button onClick={()=>setConfirm(false)}>{tr('Cancel')}</button><button onClick={()=>{setConfirm(false);act('bluetooth-start',{confirmed:true});}}>{tr('Use Bluetooth')}</button></Modal>}
  {forget&&<Modal label="Forget Bluetooth device" onCancel={()=>setForget(null)}><h3>{tr('Forget this phone?')}</h3><p>{forget.name}</p><button onClick={()=>setForget(null)}>{tr('Cancel')}</button><button onClick={()=>{act('bluetooth-forget',{address:forget.address,confirmed:true});setForget(null);}}>{tr('Forget device')}</button></Modal>}
 </section>;
}
export function BluetoothPairing({state}){
 const device=useDeviceUpdates(),[pending,setPending]=useState(false),[notice,setNotice]=useState(''),pair=state?.pairing;
 async function confirm(accept){setPending(true);setNotice('');try{await device.action('bluetooth-confirm',{nonce:pair.nonce,accept});}catch(e){setNotice(e.message);}finally{setPending(false);}}
 if(!pair)return null;
 return <Modal label="Confirm Bluetooth pairing" onCancel={()=>{if(!pending)confirm(false);}}><h3>{tr('Does this code match your phone?')}</h3><p>{pair.name}</p><strong className="bluetooth-code">{pair.code}</strong><p>{tr('Approve only if the same code appears on the phone you are connecting.')}</p><button disabled={pending} onClick={()=>confirm(false)}>{tr('Reject')}</button><button disabled={pending} onClick={()=>confirm(true)}>{tr('Codes match')}</button><p role="status">{tr(notice)}</p></Modal>;
}
