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
  <nav className="hub-tabs developer-topics" aria-label={tr('Developer topics')}>{['Status','History','Hardware','Audio','Startup','Services','Updates','Debug'].map(value=><button key={value} disabled={pending} aria-pressed={value===tab} onClick={()=>choose(value)}>{tr(value)}</button>)}</nav>
  {tab==='Status'&&<SystemDashboard snapshot={snapshot} offline={offline} advanced/>}
  {tab==='History'&&<ol className="system-history">{[...(snapshot.log||[])].reverse().slice(0,100).map(row=><li key={row.id}><time>{new Date(row.at).toLocaleTimeString()}</time><strong>{row.type}</strong><span>{row.state}</span><small>{row.reason}</small></li>)}</ol>}
  {tab==='Hardware'&&<><p>{tr('Only confirm wiring after checking the physical connections. Changing a checkbox does not connect a sensor.')}</p>{powerSettings||<p>{tr('Hardware setup is available in the main Settings menu on TuneBox.')}</p>}<dl className="system-facts"><dt>{tr('Physical power button')}</dt><dd>{tr('Requires an explicitly assigned free GPIO. GPIO3 wake shares the sensor I²C clock; confirm wiring before installation.')}</dd></dl></>}
  {tab==='Audio'&&soundSettings}
  {tab==='Startup'&&startupSettings}
  {tab==='Services'&&serverSettings}
  {tab==='Updates'&&<UpdateSettings onDirty={onDirty} actionsRef={actionsRef}/>}
  {tab==='Debug'&&<section><h3>{tr('Debug capture')}</h3><p>{tr('Capture system information to investigate a problem. Passwords, access tokens, Wi-Fi names and audio recordings are excluded. Recording stops after 30 minutes or a restart.')}</p><BusyStatus busy={loading||pending} label={pending?'Saving debug settings…':'Loading debug status…'}/><button disabled={!info||offline||loading||pending} onClick={()=>change({enabled:!info.enabled})}>{tr(info?.enabled?'Stop debug capture':'Start debug capture')}</button><a className="hub-download" href="/api/debug/download" download="tunebox-debug.json">{tr('Download debug report')}</a><button disabled={!info||offline||loading||pending} onClick={()=>change({clear:true})}>{tr('Clear debug log')}</button>{!loading&&!info&&<button disabled={offline} onClick={read}>{tr('Try again')}</button>}<p role="status">{tr(info?.enabled?'Debug capture is running':'Debug capture is off')}</p></section>}
  <p role="status">{tr(notice)}</p>
 </div>;
}
