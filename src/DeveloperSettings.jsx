import {AmplifierHealth} from './AmplifierHealth.jsx';
import {DeveloperValues} from './DeveloperValues.jsx';
import React,{useEffect,useRef,useState} from 'react';
import {useDeviceUpdates} from './DeviceUpdates.jsx';
import {SystemDashboard} from './SystemDashboard.jsx';
import {UpdateSettings} from './UpdateSettings.jsx';
import {BusyStatus} from './BusyStatus.jsx';
import {tr} from '../shared/i18n.js';

export function DeveloperSettings({snapshot,offline,onDirty,actionsRef,onBeforeNavigate,onOpenUpdates,topic,onTopic,powerSettings,soundSettings,startupSettings,serverSettings}){
 const device=useDeviceUpdates(),[localTab,setLocalTab]=useState('History'),[info,setInfo]=useState(null),[notice,setNotice]=useState(''),[loading,setLoading]=useState(false),[pending,setPending]=useState(false),working=useRef(false);
 const tab=topic||localTab;
 async function read(){
  setLoading(true);setNotice('');
  try{const response=await fetch('/api/debug',{signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('Unlock settings to open debug capture');setInfo(await response.json());}
  catch(e){setNotice(e.name==='TimeoutError'?'The connection timed out. Try again.':e.message);}
  finally{setLoading(false);}
 }
 useEffect(()=>{if(tab==='Debug')read();},[tab]);
 async function change(body){
  if(working.current)return;working.current=true;setPending(true);setNotice('');
  try{const response=await fetch('/api/debug',{method:'POST',headers:{'Content-Type':'application/json','X-TuneBox-Control':device.info?.controlToken||''},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});const value=await response.json();if(!response.ok)throw Error(value.error);setInfo(value);setNotice('Saved');}
  catch(e){setNotice(e.name==='TimeoutError'?'The connection timed out. Check the device connection and try again.':e.message);}
  finally{working.current=false;setPending(false);}
 }
 function choose(value){
  if(working.current)return;
  if(value==='Updates'&&onOpenUpdates){onOpenUpdates();return;}
  const apply=()=>onTopic?onTopic(value):setLocalTab(value);
  if(onBeforeNavigate)onBeforeNavigate(apply);else apply();
 }
 return <div className="developer-settings">
  <p>{tr('Advanced controls are for installation and troubleshooting. Everyday settings remain in the other menus.')}</p>
  <nav className="hub-tabs developer-topics" aria-label={tr('Developer topics')}>{['Status','Values','History','Hardware','Audio','Startup','Services','Updates','Debug'].map(value=><button key={value} disabled={pending} aria-pressed={value===tab} onClick={()=>choose(value)}>{tr(value)}</button>)}</nav>
  {tab==='Status'&&<SystemDashboard snapshot={snapshot} offline={offline} advanced/>}
  {tab==='Values'&&<DeveloperValues snapshot={snapshot} offline={offline}/>}
  {tab==='History'&&<ol className="system-history">{[...(snapshot.log||[])].reverse().slice(0,100).map(row=><li key={row.id}><time>{new Date(row.at).toLocaleTimeString()}</time><strong>{row.type}</strong><span>{row.state}</span><small>{row.reason}</small></li>)}</ol>}
  {tab==='Hardware'&&<><AmplifierHealth offline={offline}/><p>{tr('Only confirm wiring after checking the physical connections. Changing a checkbox does not connect a sensor.')}</p>{powerSettings||<p>{tr('Hardware setup is available in the main Settings menu on TuneBox.')}</p>}<dl className="system-facts"><dt>{tr('Physical power button')}</dt><dd>{tr('Requires an explicitly assigned free GPIO. GPIO3 wake shares the sensor I²C clock; confirm wiring before installation.')}</dd></dl></>}
  {tab==='Audio'&&soundSettings}
  {tab==='Startup'&&startupSettings}
  {tab==='Services'&&<>{serverSettings}<RestartControls snapshot={snapshot} offline={offline}/></>}
  {tab==='Updates'&&<UpdateSettings onDirty={onDirty} actionsRef={actionsRef}/>}
  {tab==='Debug'&&<section><h3>{tr('Debug capture')}</h3><p>{tr('Capture system information to investigate a problem. Passwords, access tokens, Wi-Fi names and audio recordings are excluded. Recording stops after 30 minutes or a restart.')}</p><BusyStatus busy={loading||pending} label={pending?'Saving debug settings…':'Loading debug status…'}/><button disabled={!info||offline||loading||pending} onClick={()=>change({enabled:!info.enabled})}>{tr(info?.enabled?'Stop debug capture':'Start debug capture')}</button><a className="hub-download" href="/api/debug/download" download="tunebox-debug.json">{tr('Download debug report')}</a><button disabled={!info||offline||loading||pending} onClick={()=>change({clear:true})}>{tr('Clear debug log')}</button>{!loading&&!info&&<button disabled={offline} onClick={read}>{tr('Try again')}</button>}<p role="status">{tr(info?.enabled?'Debug capture is running':'Debug capture is off')}</p></section>}
  <p role="status">{tr(notice)}</p>
 </div>;
}

const playingNow=snapshot=>snapshot?.playback?.playing===true||snapshot?.bluetooth?.active===true&&snapshot?.bluetooth?.playing===true;
/** Restart the whole device or only the TuneBox service. Both ask first; a reboot waits for silence. */
export function RestartControls({snapshot,offline}){
 const device=useDeviceUpdates(),dialog=useRef(null),[action,setAction]=useState(null),[notice,setNotice]=useState(''),[pending,setPending]=useState(false);
 const manager=device?.info?.manager||{},updating=['preparing','downloading','verifying','installing','restarting','checking-health','rolling-back'].includes(device?.info?.status);
 const usable=!offline&&!device?.info?.offline&&!!device?.info?.controlToken&&!updating&&!pending;
 const playing=playingNow(snapshot);
 const copy={
  reboot:{title:'Restart TuneBox?',body:'TuneBox stops its own audio output and restarts the Raspberry Pi. Other rooms keep playing. This takes about a minute.',confirm:'Restart TuneBox',busy:'Restarting TuneBox…',done:'TuneBox is restarting. The screen comes back in about a minute.'},
  'restart-service':{title:'Restart the TuneBox service?',body:'The interface reconnects after a few seconds. Music playback and the device manager keep running.',confirm:'Restart service',busy:'Restarting the TuneBox service…',done:'The TuneBox service is restarting. The interface reconnects automatically.'},
 };
 const open=value=>{setNotice('');setAction(value);dialog.current?.showModal();};
 async function run(){
  if(!action||pending)return;setPending(true);setNotice('');
  try{const result=await device.action(action,{confirmed:true});dialog.current?.close();setNotice(result?.simulated?'Simulation — nothing will be restarted.':copy[action].done);}
  catch(e){setNotice(e.message);}
  finally{setPending(false);}
 }
 return <section className="restart-controls" aria-label={tr('Restart')}>
  <h3>{tr('Restart')}</h3>
  <p>{tr('Use a restart when TuneBox behaves unexpectedly. Your settings are kept.')}</p>
  <div className="restart-actions">
   <button disabled={!usable||manager.restartServiceSupported!==true} onClick={()=>open('restart-service')}>{tr('Restart TuneBox service')}</button>
   <button disabled={!usable||manager.rebootSupported!==true||playing} onClick={()=>open('reboot')}>{tr('Reboot TuneBox')}</button>
  </div>
  {manager.managed&&(manager.rebootSupported!==true||manager.restartServiceSupported!==true)&&<p role="note">{tr('Restart controls need the updated device manager on the Pi. Run the appliance update once to install it.')}</p>}
  {playing&&manager.rebootSupported===true&&<p role="note">{tr('Pause the music to reboot. A reboot never interrupts playback.')}</p>}
  {updating&&<p role="note">{tr('Wait for the software update to finish before restarting.')}</p>}
  <p role="status">{tr(notice)}</p>
  <dialog ref={dialog} className="hub-confirm restart-dialog" aria-label={tr(action?copy[action].title:'Restart')} onClose={()=>{if(!pending)setAction(null);}} onCancel={e=>{if(pending)e.preventDefault();}}>
   {action&&<><h3>{tr(copy[action].title)}</h3><p>{tr(copy[action].body)}</p>{manager.simulated&&<p>{tr('Simulation — nothing will be restarted.')}</p>}{notice&&<p role="alert">{tr(notice)}</p>}
   <button autoFocus disabled={pending} onClick={()=>dialog.current?.close()}>{tr('Cancel')}</button><button disabled={pending||!usable&&!pending} onClick={run}>{tr(pending?copy[action].busy:copy[action].confirm)}</button></>}
  </dialog>
 </section>;
}
