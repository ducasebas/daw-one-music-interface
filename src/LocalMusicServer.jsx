import React,{useEffect,useState} from 'react';
import {useDeviceUpdates} from './DeviceUpdates.jsx';
import {Modal} from './Modal.jsx';
import {tr} from '../shared/i18n.js';
import {QrCode} from './NetworkWizard.jsx';
const stepNames=['Check capacity','Install the server','Finish Music Assistant setup','Connect TuneBox'];
/** The four steps, with where you are now. Every step stays honest about what is not done. */
function LocalSteps({info,address,onConnect}){
 const ready=info?.job?.phase==='ready',step=!info?0:!info.capacity?.eligible||!info.dockerAvailable?0:info.installing?1:ready?2:1;
 return <div className="local-ma-guide"><ol className="local-ma-steps">{stepNames.map((name,i)=><li key={name} data-state={i<step?'done':i===step?'current':'next'}><b>{i+1}</b><span>{tr(name)}</span></li>)}</ol>
  {ready&&<div className="local-ma-ready"><div>{address?<QrCode value={address} label="Open on your phone or computer"/>:null}</div><div>
   <p>{tr('The server runs on this TuneBox. Finish its setup on a phone or computer on the same Wi-Fi: create the account and add your music services (Tidal, Spotify, YouTube Music).')}</p>
   {address&&<code className="handoff-url">{address}</code>}
   <p>{tr('Then connect TuneBox to it. Your old server stays as it is until you save the new one.')}</p>
   <button onClick={onConnect}>{tr('Connect TuneBox to this server')}</button></div></div>}
 </div>;
}
export function LocalMusicServer({onConnect}){const [address,setAddress]=useState(null);useEffect(()=>{fetch('/api/local-ma/address').then(r=>r.ok?r.json():null).then(v=>setAddress(v?.url||null)).catch(()=>{});},[]);const device=useDeviceUpdates(),[info,setInfo]=useState(null),[error,setError]=useState(''),[confirm,setConfirm]=useState(false),[consent,setConsent]=useState(false);
 async function refresh(){try{setInfo(await device.action('local-ma-status'));}catch(e){setError(e.message);}}
 useEffect(()=>{refresh();},[]);useEffect(()=>{if(!info?.installing)return;const id=setInterval(refresh,5000);return()=>clearInterval(id);},[info?.installing]);
 return <section className="local-ma"><h3>{tr('Run Music Assistant on this Pi')}</h3><p>{tr('Keep your existing server, or install an additional local server when this Pi has enough capacity. Accounts, providers and players need their own setup.')}</p><LocalSteps info={info} address={address} onConnect={onConnect}/>{info&&<><p>{tr(info.simulated?'Browser simulation':info.capacity.eligible?'Hardware capacity check passed':'Keep Music Assistant on your NUC')}</p><ul>{info.capacity.reasons.map(reason=><li key={reason}>{tr(reason)}</li>)}</ul>{!info.dockerAvailable&&<p>{tr('Docker Engine and Compose must be installed first. TuneBox does not run a downloaded bootstrap script.')}</p>}{info.installing&&<><progress aria-label={tr('Local Music Assistant installation')}/><p>{tr('Installing local Music Assistant…')}</p></>}{info.job?.phase&&<p role="status">{tr('Installation status')}: {tr(info.job.phase)}</p>}{info.job?.phase==='ready'&&<p>{tr('Local server ready at http://127.0.0.1:8095. Complete its onboarding before selecting it as your music server.')}</p>}</>}<button disabled={device.pending} onClick={refresh}>{tr('Check capacity')}</button><button disabled={!info?.capacity.eligible||!info?.dockerAvailable||info?.installing||device.pending||info?.simulated} onClick={()=>{setConsent(false);setConfirm(true);}}>{tr('Install local server…')}</button><p role="status">{error}</p>{confirm&&<Modal label="Install local Music Assistant"><h3>{tr('Install an additional music server?')}</h3><p>{tr('This downloads the official Music Assistant container, uses host networking and persistent storage. Your NUC connection stays unchanged. Stop playback first.')}</p><label className="hub-check"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>{tr('Install a separate local server on this Pi')}</label><button onClick={()=>setConfirm(false)}>{tr('Cancel')}</button><button disabled={!consent} onClick={async()=>{setConfirm(false);try{await device.action('local-ma-install',{confirmed:true});await refresh();}catch(e){setError(e.message);}}}>{tr('Confirm installation')}</button></Modal>}</section>;
}
