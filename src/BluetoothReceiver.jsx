import React,{useEffect,useRef,useState} from 'react';
import {useDeviceUpdates} from './DeviceUpdates.jsx';
import {Modal} from './Modal.jsx';
import {Icon} from './Icon.jsx';
import {tr,translateFormat} from '../shared/i18n.js';
import {bluetoothLinkQuality,bluetoothStability} from '../shared/bluetooth.js';

export function BluetoothReceiver({snapshot,offline=false}){
 const device=useDeviceUpdates(),[state,setState]=useState(snapshot.bluetooth||{}),[confirm,setConfirm]=useState(false),[forget,setForget]=useState(null),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),refresh=useRef(()=>{});
 useEffect(()=>{let live=true,timer,controller,generation=0;const read=async()=>{if(offline)return;const own=++generation;controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),4000);try{const r=await fetch('/api/bluetooth',{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error();const v=await r.json();if(live&&own===generation)setState(v);}catch{if(live&&own===generation)setNotice('Bluetooth status could not be refreshed');}finally{clearTimeout(timeout);if(live&&own===generation)timer=setTimeout(read,document.hidden?10000:3000);}};refresh.current=()=>{clearTimeout(timer);controller?.abort();read();};read();return()=>{live=false;generation++;clearTimeout(timer);controller?.abort();};},[offline]);
 async function act(command,args={}){if(busy)return;setBusy(true);setNotice('');try{await device.action(command,args);refresh.current();}catch(e){setNotice(e.message);}finally{setBusy(false);}}
 return <section className="bluetooth-receiver" aria-label={tr('Bluetooth receiver')} aria-busy={busy}>
  <h3><Icon name="bluetooth" size={32}/>{tr('Phone → TuneBox')}</h3>
  <p>{tr('Stream phone audio to the local Louder output. Music Assistant and Bluetooth take turns using this output.')}</p>
  {!state.supported?<p role="status">{tr('The optional Bluetooth receiver needs to be installed and tested on this Pi before it can be selected.')}</p>:<>
   {!state.devices?.some(d=>d.connected)&&<ol className="bluetooth-steps" aria-label={tr('How to connect a phone')}><li className={state.active?'done':''}>{tr('Tap “Use Bluetooth” below. Music Assistant pauses on this TuneBox only.')}</li><li className={state.discoverable?'done':''}>{tr('Tap “Pair a phone for 2 minutes”.')}</li><li>{tr('On your phone, open Settings → Bluetooth and choose TuneBox.')}</li><li>{tr('Check that the 6-digit code on the phone matches the one on TuneBox, then tap “Codes match”.')}</li><li>{tr('Play music on your phone. Use the TuneBox volume; it never goes above its saved ceiling.')}</li></ol>}
   <strong>{tr(state.active?'Bluetooth is the local source':snapshot.mode==='music-assistant'?'Music Assistant is the local source':'Bluetooth is ready to use')}</strong>
   {state.active?<><p>{tr('Use the main volume control on TuneBox. Phone volume cannot override its saved ceiling. Playback and track selection stay on your phone.')}</p><button disabled={busy||offline} onClick={()=>act('bluetooth-stop')}>{tr(state.phase==='recovery-required'?'Restore local audio':'Switch back to Music Assistant')}</button><button disabled={busy||offline||state.phase!=='active'} onClick={()=>act(state.discoverable?'bluetooth-close-pairing':'bluetooth-pair')}>{tr(state.discoverable?'Stop pairing':'Pair a phone for 2 minutes')}</button><p role="status">{tr(state.discoverable?'Choose TuneBox in your phone Bluetooth settings, then confirm the matching code here.':'Pairing is closed. Previously approved phones can reconnect while Bluetooth is selected.')}</p></>:<button disabled={busy||offline} onClick={()=>setConfirm(true)}>{tr('Use Bluetooth…')}</button>}
   {state.devices?.map(d=><article className="bluetooth-device" key={d.address}><div><strong>{d.name}</strong><span>{tr(d.connected?'Connected':d.paired?'Paired':'Disconnected')}</span>{d.connected&&<LinkDetails device={d}/>}</div>{d.connected&&<button disabled={busy||offline} onClick={()=>act('bluetooth-disconnect',{address:d.address})}>{tr('Disconnect')}</button>}<button disabled={busy||offline||!state.active} onClick={()=>setForget(d)}>{tr('Forget…')}</button></article>)}
  </>}
  {busy&&<p role="status"><span className="ui-spinner"/>{tr('Switching local audio…')}</p>}<p role="status">{tr(notice)}</p>
  {confirm&&<Modal label="Switch local audio source" onCancel={()=>setConfirm(false)}><h3>{tr('Use this TuneBox for phone audio?')}</h3><p>{tr(snapshot.mode==='music-assistant'?'First pause music, select the local TuneBox player and leave any group. Only this Pi player is stopped. Bluetooth starts muted; increase volume on TuneBox after connecting.':'Music Assistant is not required for Bluetooth. The local ALSA output must be idle. The known local player services are suspended, and Bluetooth starts muted.')}</p><button onClick={()=>setConfirm(false)}>{tr('Cancel')}</button><button onClick={()=>{setConfirm(false);act('bluetooth-start',{confirmed:true});}}>{tr('Use Bluetooth')}</button></Modal>}
  {forget&&<Modal label="Forget Bluetooth device" onCancel={()=>setForget(null)}><h3>{tr('Forget this phone?')}</h3><p>{forget.name}</p><button onClick={()=>setForget(null)}>{tr('Cancel')}</button><button onClick={()=>{act('bluetooth-forget',{address:forget.address,confirmed:true});setForget(null);}}>{tr('Forget device')}</button></Modal>}
 </section>;
}
/** Honest link details: codec and bitrate as negotiated with this phone, and how stable the connection has been. */
function LinkDetails({device}){
 const q=bluetoothLinkQuality(device.transport),stability=bluetoothStability(device.link),minutes=Math.floor((device.link?.connectedSeconds||0)/60);
 return <dl className="bluetooth-link">
  <dt>{tr('Codec')}</dt><dd>{q?<>{q.codec}{q.kbps?<> · {translateFormat(q.codec==='SBC'?'up to {kbps} kbit/s':'{kbps} kbit/s',{kbps:q.kbps})}</>:null}{q.sampleRate?<> · {(q.sampleRate/1000).toLocaleString()} kHz</>:null}</>:tr('Not reported yet')}</dd>
  <dt>{tr('Connection')}</dt><dd data-stability={stability}>{tr(({stable:'Stable',new:'Just connected',drops:'Dropped out recently',unstable:'Unstable',unknown:'Unknown'})[stability])}{device.link?<> · {translateFormat('{minutes} min connected · {drops} drop-outs in the last hour',{minutes,drops:device.link.dropsLastHour})}</>:null}</dd>
  <dd className="bluetooth-honest">{tr(stability==='unstable'||stability==='drops'?'Move the phone closer to TuneBox or away from Wi-Fi routers and microwaves; walls and bodies weaken Bluetooth.':'Bluetooth always compresses audio. Your phone re-encodes everything, also lossless or hi-res streams, to this codec. For full quality, play through Music Assistant instead.')}</dd>
 </dl>;
}
export function BluetoothPairing({state}){
 const device=useDeviceUpdates(),[pending,setPending]=useState(false),[notice,setNotice]=useState(''),pair=state?.pairing;
 async function confirm(accept){setPending(true);setNotice('');try{await device.action('bluetooth-confirm',{nonce:pair.nonce,accept});}catch(e){setNotice(e.message);}finally{setPending(false);}}
 if(!pair)return null;
 return <Modal label="Confirm Bluetooth pairing" onCancel={()=>{if(!pending)confirm(false);}}><h3>{tr('Does this code match your phone?')}</h3><p>{pair.name}</p><strong className="bluetooth-code">{pair.code}</strong><p>{tr('Approve only if the same code appears on the phone you are connecting.')}</p><button disabled={pending} onClick={()=>confirm(false)}>{tr('Reject')}</button><button disabled={pending} onClick={()=>confirm(true)}>{tr('Codes match')}</button><p role="status">{tr(notice)}</p></Modal>;
}
