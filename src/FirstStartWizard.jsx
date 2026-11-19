import {YoutubeSetupButton} from './VideoArtwork.jsx';
import React,{useEffect,useRef,useState} from 'react';
import './wizards.css';
import {WizardShell} from './WizardShell.jsx';
import {SetupCards,SetupJourney} from './SetupJourneys.jsx';
import {useDeviceUpdates} from './DeviceUpdates.jsx';
import {setupApi,saveSetupPreferences} from './setup-api.js';
import {setupConnectionStatus} from '../shared/setup-journeys.js';
import {tr,getLanguage,setLanguage} from '../shared/i18n.js';
export function FirstStartWizard({snapshot,offline=false,onComplete,onClose}){
 const device=useDeviceUpdates(),[step,setStep]=useState(0),[journey,setJourney]=useState(null),[network,setNetwork]=useState({}),[language,setLang]=useState(getLanguage()),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[checkingNetwork,setCheckingNetwork]=useState(false),saving=useRef(false);
 const status=setupConnectionStatus(snapshot,network);
 async function refresh(){setCheckingNetwork(true);try{setNetwork(await setupApi('/api/network'));}catch{}finally{setCheckingNetwork(false);}}
 useEffect(()=>{refresh();},[journey]);
 useEffect(()=>{if(!device.info?.controlToken)return;fetch('/api/display/ready',{method:'POST',headers:{'X-TuneBox-Control':device.info.controlToken}}).catch(()=>{});fetch('/api/activity',{method:'POST'}).catch(()=>{});},[device.info?.controlToken]);
 async function finish(later=false){
  if(saving.current)return;if(later&&(offline||!device.info?.controlToken)){(onComplete||onClose)?.();return;}saving.current=true;setBusy(true);setNotice('Saving…');
  try{const existing=snapshot.preferences||{},maxVolume=existing.prefs?.volumeLimitConfigured?existing.maxVolume:Math.min(existing.maxVolume??40,40);await saveSetupPreferences(device.info?.controlToken,{language,setupCompleted:!later,setupDeferred:later,maxVolume});if(device.info?.manager?.managed&&!existing.setupCompleted)await device.action('dsp-initialize').catch(()=>{});if(!later&&device.info?.manager?.managed)await device.action('complete-setup').catch(()=>{});fetch('/api/activity',{method:'POST'}).catch(()=>{});(onComplete||onClose)?.();}
  catch(e){if(e.status===423&&later){try{await setupApi('/api/setup/defer',device.info?.controlToken,{});(onComplete||onClose)?.();}catch(error){setNotice(error.message);}}else setNotice(e.message);}
  finally{saving.current=false;setBusy(false);}
 }
 if(journey)return <SetupJourney id={journey} snapshot={snapshot} offline={offline} onClose={()=>setJourney(null)} onComplete={()=>{setJourney(null);device.refresh();refresh();}}/>;
 return <WizardShell title="First start setup" steps={['Welcome','Connections','Your next step']} step={step} busy={busy} statusBusy={checkingNetwork&&step===1} busyLabel="Checking your connections…" notice={notice} onClose={()=>finish(true)} onBack={step?()=>setStep(step-1):undefined} onSkip={()=>finish(true)} onNext={step<2?()=>setStep(step+1):()=>finish(false)} nextLabel={step===2?'Finish setup':'Continue'} nextDisabled={step===2&&(offline||!device.info?.controlToken)}>
  {step===0&&<><h3>{tr('Make TuneBox yours')}</h3><p>{tr('Add the connections you want. You can combine Wi-Fi, Ethernet, Bluetooth and Music Assistant, or add more later.')}</p><div className="language-settings">{[['en','English'],['nl','Nederlands']].map(([id,label])=><button key={id} aria-pressed={language===id} onClick={()=>{setLang(id);setLanguage(id);}}>{label}</button>)}</div><p>{tr('Sound calibration and picture synchronization are optional. You can finish without a microphone or a music server.')}</p></>}
  {step===1&&<><h3>{tr('Add your connections')}</h3><p>{tr('These are independent options. Setting up one does not disable the others.')}</p>{status.ethernet&&<p className="setup-connection-ready">{tr('Ethernet connected')}</p>}<SetupCards ids={['network','bluetooth']} snapshot={snapshot} network={network} onOpen={setJourney}/><p>{tr(status.network?'Network connected':'No network yet · Bluetooth can be set up independently')}</p><button onClick={()=>setStep(2)}>{tr('Continue with current connections')}</button></>}
  {step===2&&<><h3>{tr('Ready for your next step')}</h3><p>{tr(status.bluetoothConnected||status.music?'A music source is connected. Finish now or add more below.':'You can finish now and add a music source later, or set one up below.')}</p><SetupCards ids={['music','sound','sync']} snapshot={snapshot} network={network} onOpen={setJourney}/><YoutubeSetupButton snapshot={snapshot} prefs={snapshot.preferences?.prefs||{}} update={(key,value)=>saveSetupPreferences(device.info?.controlToken,{prefs:{[key]:value}})} offline={offline}/><p>{tr('All of these wizards remain available in Settings. Nothing here is required to finish setup.')}</p></>}
 </WizardShell>;
}
