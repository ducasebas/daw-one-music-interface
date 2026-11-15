import React,{useState,useEffect,useRef} from 'react';
import {useDeviceUpdates} from './DeviceUpdates.jsx';
import {LocalMusicServer} from './LocalMusicServer.jsx';
import {NetworkWizard} from './NetworkWizard.jsx';
import {KeyboardField} from './TouchKeyboard.jsx';
import {SensorDashboard} from './DisplaySettings.jsx';
import {setLanguage,getLanguage,tr} from '../shared/i18n.js';
import {SpeakerSettings} from './SpeakerSettings.jsx';
import {speakerSettings} from '../shared/speaker-settings.js';
import {startingDspControls} from '../shared/dsp-settings.js';
import {YoutubeSetupButton} from './VideoArtwork.jsx';
const steps=['Language','Network','Music Assistant','Player','Speakers','Display','Ready'];
export function FirstStartWizard({snapshot,offline=false,onComplete,onClose}){
 const device=useDeviceUpdates();
 const existing=snapshot.mode==='music-assistant'&&snapshot.musicAssistant?.connected===true&&snapshot.playback?.connected===true;
 const [step,setStep]=useState(0),[language,setLang]=useState(getLanguage()),[url,setUrl]=useState(''),[token,setToken]=useState(''),[probe,setProbe]=useState(null),[player,setPlayer]=useState(''),[control,setControl]=useState(false),[notice,setNotice]=useState(''),[saving,setSaving]=useState(false),[connectionSaved,setConnectionSaved]=useState(existing),[skipped,setSkipped]=useState([]);
 const mounted=useRef(true),generation=useRef(0),savingRef=useRef(false);
 const [speakers,setSpeakers]=useState(()=>speakerSettings(snapshot.preferences?.speakers));
 const [ceiling,setCeiling]=useState(()=>snapshot.preferences?.prefs?.volumeLimitConfigured?snapshot.preferences.maxVolume:Math.min(snapshot.preferences?.maxVolume??100,snapshot.musicAssistant?.volumeLimit??40));
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++;};},[]);
 useEffect(()=>{if(!device.info?.controlToken)return;const frame=requestAnimationFrame(()=>{fetch('/api/display/ready',{method:'POST',headers:{'X-TuneBox-Control':device.info.controlToken}}).catch(()=>{});fetch('/api/activity',{method:'POST'}).catch(()=>{});});return()=>cancelAnimationFrame(frame);},[device.info?.controlToken]);
 const usable=!offline&&device.info?.manager?.managed&&!device.info?.offline&&!device.pending&&!saving;
 function go(next){generation.current++;setNotice('');setStep(next);}
 function changed(setter,value){generation.current++;setter(value);setProbe(null);setPlayer('');setConnectionSaved(false);setNotice('');}
 function skip(){setSkipped(v=>v.includes(step)?v:[...v,step]);if(step===2){setToken('');setProbe(null);setPlayer('');}go(step===2?4:step+1);}
 async function act(command,args){setNotice('');try{return await device.action(command,args);}catch(e){if(mounted.current)setNotice(e.message);return null;}}
 async function savePreferences(patch){
  const options={cache:'no-store',signal:AbortSignal.timeout(6000)};
  const response=await fetch('/api/preferences',options);if(!response.ok)throw Error('Could not save setup. Try again.');const prefs=await response.json();
  const payload={...patch,language,...(patch.speakers?{prefs:{...prefs.prefs,volumeLimitConfigured:true}}:{})};
  const r=await fetch('/api/preferences',{method:'POST',headers:{'Content-Type':'application/json','X-TuneBox-Control':device.info?.controlToken||''},body:JSON.stringify({revision:prefs.revision,patch:payload}),signal:AbortSignal.timeout(6000)});
  if(!r.ok){const e=await r.json();const error=Error(e.error||'Could not save setup. Try again.');error.status=r.status;throw error;}
 }
 async function finish(later=false){
  if(savingRef.current)return;savingRef.current=true;setSaving(true);setNotice('');generation.current++;
  try{
   let savedSpeakers=false;
   if(later||!connectionSaved){try{await savePreferences({setupDeferred:true,speakers,maxVolume:ceiling});savedSpeakers=true;}catch(e){if(e.status!==423)throw e;const r=await fetch('/api/setup/defer',{method:'POST',headers:{'Content-Type':'application/json','X-TuneBox-Control':device.info?.controlToken||''},body:'{}',signal:AbortSignal.timeout(6000)});if(!r.ok)throw Error('Could not save setup. Try again.');}}
   else {await device.action('complete-setup');await savePreferences({setupCompleted:true,setupDeferred:false,speakers,maxVolume:ceiling});savedSpeakers=true;}
   if(savedSpeakers&&speakers.voicing!=='keep'){
    try{
     const state=await device.action('dsp');
     if(state.supported){const desired=startingDspControls(state.controls,speakers.voicing);const controls=desired.filter(c=>c.value!==state.controls.find(old=>old.id===c.id)?.value).map(({id,value})=>({id,value}));if(controls.length)await device.action('dsp-set',{controls});}
    }catch{ /* Optional DSP setup must not trap a user in the wizard. */ }
   }
   setToken('');fetch('/api/activity',{method:'POST'}).catch(()=>{});(onComplete||onClose)?.();
  }catch(e){if(mounted.current)setNotice(e.name==='TimeoutError'?'Could not save setup. Try again.':e.message);}
  finally{savingRef.current=false;if(mounted.current)setSaving(false);}
 }
 async function testConnection(e){
  e.preventDefault();const current=++generation.current;const result=await act('probe-music',{url,token});
  if(mounted.current&&generation.current===current&&result){setProbe(result);go(3);}
 }
 async function saveConnection(){
  const current=++generation.current;const value=await act('save-music',{url,token,playerId:player,allowControl:control,confirmed:true});
  if(mounted.current&&generation.current===current&&value){setToken('');setConnectionSaved(true);go(4);}
 }
 return <section className="first-start" role="dialog" aria-label={tr('First start setup')}><header><div><small>DAW TuneBox</small><h2>{tr('Welcome')}</h2></div><button disabled={saving} onClick={()=>finish(true)}>{tr(saving?'Saving…':'Finish later')}</button></header>
 <nav aria-label={tr('Setup steps')}>{steps.map((s,i)=><button key={s} disabled={saving} aria-current={step===i?'step':undefined} onClick={()=>go(i)}><b>{i+1}</b>{tr(s)}</button>)}</nav><div className="first-start-body">
 {step===0&&<><h3>{tr('Choose your language')}</h3><div className="language-settings">{[['en','English'],['nl','Nederlands']].map(([id,name])=><button key={id} aria-pressed={language===id} onClick={()=>{setLang(id);setLanguage(id);}}>{name}</button>)}</div><p>{tr('Use the touchscreen to connect your network, music server and player. You can complete missing steps later.')}</p></>}
 {step===1&&<NetworkWizard offline={offline} onContinue={()=>go(2)}/>}
 {step===2&&<>{existing&&<section className="wizard-existing"><p>{tr('Music Assistant and your player are already connected. You can keep this connection.')}</p><button onClick={()=>{setToken('');setConnectionSaved(true);go(4);}}>{tr('Keep current connection')}</button></section>}<form className="hub-fields" onSubmit={testConnection}><KeyboardField label="Music Assistant server address" value={url} onChange={v=>changed(setUrl,v)} placeholder="http://your-nuc:8095"/><KeyboardField label="Music Assistant access token" type="password" value={token} onChange={v=>changed(setToken,v)} autoComplete="new-password"/><p>{tr('A saved token is reused only for the same server address. Enter a token when switching servers. It is never saved in browser storage.')}</p><button aria-busy={device.pending} disabled={!usable||!url}>{tr(device.pending?'Testing connection…':'Test connection')}</button></form><LocalMusicServer/></>}
 {step===3&&<div className="hub-fields"><h3>{tr(probe?'Choose this TuneBox player':'Test the server connection first')}</h3>{!probe&&<button onClick={()=>go(2)}>{tr('Set up Music Assistant')}</button>}<div className="player-choices">{probe?.players.map(p=><button key={p.id} disabled={!p.available} aria-pressed={player===p.id} onClick={()=>setPlayer(p.id)}>{p.name}</button>)}</div><label className="hub-check"><input type="checkbox" checked={control} onChange={e=>setControl(e.target.checked)}/>{tr('Allow playback control, with server volume limit')}</label><p>{tr('Saving a different server restarts the interface and may interrupt music.')}</p><button aria-busy={device.pending} disabled={!usable||!player||!probe} onClick={saveConnection}>{tr('Save server and player')}</button></div>}
 {step===4&&<SpeakerSettings value={speakers} onChange={setSpeakers} ceiling={ceiling} onCeiling={setCeiling}/>}
 {step===5&&<><p>{tr('Check touch, the full screen layout, temperature and light. Automatic brightness can be enabled in Display settings.')}</p><SensorDashboard snapshot={snapshot} offline={offline}/></>}
 {step===6&&<><h3>{tr(connectionSaved?'Ready to listen':'Finish setup later')}</h3><p>{tr('Network, player and display preferences remain available in Settings. PIN protection is available under Security.')}</p>{skipped.length>0&&<p>{tr('Skipped steps remain available in Settings.')}</p>}<YoutubeSetupButton snapshot={snapshot} prefs={snapshot.preferences?.prefs||{}} update={(key,value)=>savePreferences({prefs:{...snapshot.preferences?.prefs,[key]:value}})} offline={offline}/><button disabled={saving||offline||!device.info?.controlToken} onClick={()=>finish(!connectionSaved)}>{tr(saving?'Saving…':connectionSaved?'Save and finish setup':'Finish for now')}</button></>}
 </div><footer><span role="status">{tr(notice||(!saving&&device.pending?'Working…':''))}</span><button disabled={step===0||saving} onClick={()=>go(step===4&&!probe?2:step-1)}>{tr('Back')}</button>{step<6&&<><button disabled={saving} onClick={skip}>{tr('Skip this step')}</button><button disabled={saving} onClick={()=>go(step===2&&!probe?4:step+1)}>{tr('Next')}</button></>}</footer></section>;
}
