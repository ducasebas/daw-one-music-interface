import React,{useEffect,useRef,useState} from 'react';
import {tr} from '../shared/i18n.js';
import {useDeviceUpdates} from './DeviceUpdates.jsx';
import {setupApi} from './setup-api.js';
import {QrCode} from './NetworkWizard.jsx';
import {WizardShell} from './WizardShell.jsx';
import {Modal} from './Modal.jsx';

const when=at=>at?new Date(at).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}):'—';

/** Pair a phone by QR code. The code is single-use and expires after ten minutes. */
export function RemoteWizard({snapshot,offline=false,onClose,onComplete}){
 const device=useDeviceUpdates(),token=device.info?.controlToken,[step,setStep]=useState(0),[pair,setPair]=useState(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[now,setNow]=useState(Date.now());
 const start=useRef(Number(snapshot.remoteControl?.phones)||0),open=useRef(false);
 const phones=Number(snapshot.remoteControl?.phones)||0;
 useEffect(()=>{if(step===1&&phones>start.current){open.current=false;setStep(2);setPair(null);}},[phones,step]);
 useEffect(()=>{if(step!==1)return;const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t);},[step]);
 useEffect(()=>()=>{if(open.current&&token)setupApi('/api/remote/pairing',token,{action:'cancel'}).catch(()=>{});},[token]);
 async function show(){if(busy)return;setBusy(true);setNotice('');try{start.current=phones;const value=await setupApi('/api/remote/pairing',token,{action:'start'});open.current=true;setPair(value);setNow(Date.now());setStep(1);}catch(e){setNotice(e.message);}finally{setBusy(false);}}
 const left=pair?Math.max(0,Math.ceil((pair.expiresAt-now)/1000)):0,expired=step===1&&pair&&left===0;
 const close=()=>{if(open.current&&token){open.current=false;setupApi('/api/remote/pairing',token,{action:'cancel'}).catch(()=>{});}onClose?.();};
 return <WizardShell title="Phone remote" steps={['Show code','Scan with phone','Ready']} step={step} busy={busy} busyLabel="Preparing the code…" notice={notice} onClose={close}
  onNext={step===0?show:step===2?(onComplete||onClose):expired?show:undefined} nextLabel={step===0?'Show QR code':step===2?'Done':'Show a new code'} nextDisabled={offline||!token}>
  <section className="remote-wizard">
   {step===0&&<><h3>{tr('Control TuneBox from your phone')}</h3><p>{tr('Pause, skip, search music and change the volume from your phone. No app is needed.')}</p><ol><li>{tr('Connect your phone to the same Wi-Fi network as TuneBox.')}</li><li>{tr('Scan the QR code with the phone camera.')}</li><li>{tr('Add the page to your home screen to open it like an app.')}</li></ol><p>{tr('The phone stays paired until you forget it here. Settings can never be changed from a phone.')}</p></>}
   {step===1&&pair&&<div className="remote-pair">{expired?<p role="alert">{tr('This code has expired. Show a new code.')}</p>:<><QrCode value={pair.url} label="Scan with your phone camera"/><div><p>{tr('Waiting for your phone…')}</p><p className="remote-countdown">{tr('Code valid for')} {Math.floor(left/60)}:{String(left%60).padStart(2,'0')}</p><p>{tr('The phone must be on the same Wi-Fi network as TuneBox.')}</p><code className="handoff-url">{pair.url.split('#')[0]}</code></div></>}</div>}
   {step===2&&<><h3>{tr('Your phone is paired')}</h3><p>{tr('Use the page on your phone to play, pause, skip, search and change the volume.')}</p><p>{tr('Volume rises in small steps and never above the saved limit.')}</p></>}
  </section>
 </WizardShell>;
}

/** Connections → Phone remote: paired phones and the pairing wizard. */
export function RemotePanel({snapshot,offline=false,onPair}){
 const device=useDeviceUpdates(),token=device.info?.controlToken,[state,setState]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[forget,setForget]=useState(null);
 const phones=Number(snapshot.remoteControl?.phones)||0;
 useEffect(()=>{let live=true;setupApi('/api/remote/phones').then(v=>{if(live){setState(v);setError('');}}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[phones]);
 async function remove(target){setBusy(true);setError('');try{setState(await setupApi('/api/remote/forget',token,target==='all'?{all:true}:{id:target.id}));}catch(e){setError(e.message);}finally{setBusy(false);setForget(null);}}
 return <div className="remote-panel" aria-busy={busy}>
  <p>{tr('Pause, skip, search music and change the volume from your phone. No app is needed.')}</p>
  <button disabled={offline||!token||busy||(state&&state.phones.length>=state.limit)} onClick={onPair}>{tr('Pair a phone…')}</button>
  {state&&!state.address&&<p>{tr('Connect TuneBox to your home network first')}</p>}
  {state?.phones.length>0?<ul className="remote-phones" aria-label={tr('Paired phones')}>{state.phones.map(p=><li key={p.id}><span><strong>{p.name}</strong><small>{tr('Paired')} {when(p.createdAt)} · {tr('Last used')} {when(p.lastSeenAt)}</small></span><button disabled={busy||offline} onClick={()=>setForget(p)}>{tr('Forget')}</button></li>)}</ul>:state&&<p>{tr('No phones are paired.')}</p>}
  {state?.phones.length>1&&<button disabled={busy||offline} onClick={()=>setForget('all')}>{tr('Forget all phones')}</button>}
  <p role={error?'alert':'status'} className="hub-notice">{tr(error)}</p>
  {forget&&<Modal label="Forget phone" onCancel={()=>setForget(null)}><h3>{tr(forget==='all'?'Forget all phones?':'Forget this phone?')}</h3>{forget!=='all'&&<p>{forget.name}</p>}<p>{tr('The phone loses access immediately. You can pair it again with a new code.')}</p><button disabled={busy} onClick={()=>setForget(null)}>{tr('Cancel')}</button><button disabled={busy} onClick={()=>remove(forget)}>{tr('Forget')}</button></Modal>}
 </div>;
}
