import {panelProfile} from '../shared/display.js';
import {LegacyUpdateSettings} from './LegacyUpdateSettings.jsx';
import React,{useEffect,useRef,useState} from 'react';
import {tr,getLanguage} from '../shared/i18n.js';
import {relativeTime} from '../shared/interface.js';
import {release} from '../shared/release.js';
import {Icon} from './Icon.jsx';
import {KeyboardField} from './TouchKeyboard.jsx';
import {useDeviceUpdates,UpdateProgress} from './DeviceUpdates.jsx';
import {updateDefaults,updatePhases} from '../shared/update-settings.js';
export function UpdateSettings(props){return panelProfile(location.search)==='wall-16-10'?<WallUpdateSettings {...props}/>:<LegacyUpdateSettings {...props}/>;}
function WallUpdateSettings({onDirty,actionsRef,build}={}){
 const {info,pending,action}=useDeviceUpdates();
 const [draft,setDraft]=useState(updateDefaults),[confirm,setConfirm]=useState(false),[savedPolicy,setSavedPolicy]=useState(null),[checking,setChecking]=useState(false),[error,setError]=useState(''),[now,setNow]=useState(Date.now());
 const checkedBefore=useRef(null),policy=JSON.stringify(info?.manager?.policy||updateDefaults);
 useEffect(()=>{setDraft(JSON.parse(policy));setSavedPolicy(null);},[policy]);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),15000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{if(checking&&info?.checkedAt!==checkedBefore.current&&info?.status!=='checking')setChecking(false);},[info?.checkedAt,info?.status,checking]);
 useEffect(()=>{if(!checking)return;const timer=setTimeout(()=>{setChecking(false);setError('Checking took too long. Please try again.');},30000);return()=>clearTimeout(timer);},[checking]);
 const dirty=JSON.stringify(draft)!==(savedPolicy||policy);
 useEffect(()=>{onDirty?.(dirty);},[dirty,onDirty]);useEffect(()=>()=>onDirty?.(false),[onDirty]);
 const active=updatePhases.includes(info?.status),busy=checking||info?.status==='checking';
 const usable=info?.manager?.managed&&info.manager.configured&&!info.offline&&!pending&&!active&&!checking;
 async function run(command,args){setError('');if(command==='check'){checkedBefore.current=info?.checkedAt;setChecking(true);}try{await action(command,args);}catch(e){setError(e.message);setChecking(false);}}
 async function savePolicy(){if(!dirty&&actionsRef)return true;if(!usable)return false;try{await action('policy',draft);setSavedPolicy(JSON.stringify(draft));return true;}catch(e){setError(e.message);return false;}}
 if(actionsRef)actionsRef.current={save:savePolicy,discard:()=>setDraft(JSON.parse(savedPolicy||policy))};
 const current=!info?.available&&['up-to-date','installed'].includes(info?.status);
 return <div className="updates-page">
  <section className="update-summary"><div className="software-version"><span>{tr('Software version')}</span><strong>{build?.label||release.label}</strong></div>
   <div className="update-result" data-current={current} role="status">{busy?<span className="ui-spinner"/>:current?<Icon name="check" size={38}/>:<Icon name={info?.available?'update':'status'} size={36}/>}<strong>{tr(busy?'Checking for updates…':current?'Up to date':info?.available?'Update available':info?.status==='error'?'Update needs attention':info?.manager?.configured?'Ready to check':'Updates are not configured')}</strong></div>
   <p className="update-last-check">{tr('Last checked')}: {relativeTime(info?.checkedAt,now,getLanguage())}</p>
   {info?.available&&<p>{tr('Available version')}: <strong>{info.available.release}</strong></p>}
   <div className="update-actions"><button disabled={!usable} aria-busy={busy} onClick={()=>run('check')}>{busy&&<Icon name="update" className="is-spinning"/>}{tr('Check for updates')}</button>{info?.available&&<button disabled={!usable} onClick={()=>run('install')}>{tr('Install update')}</button>}</div>
  </section>
  {active&&<UpdateProgress info={info}/>}
  {error&&<p role="alert">{tr(error)}</p>}{info?.offline&&<p role="status">{tr('Offline · device changes are unavailable')}</p>}
  <section className="update-preferences"><h3>{tr('Installation preferences')}</h3><form className="update-policy" onSubmit={e=>{e.preventDefault();savePolicy();}}><label>{tr('Updates')}<select aria-label={tr('Update policy')} value={draft.mode} disabled={!usable} onChange={e=>setDraft({...draft,mode:e.target.value})}><option value="auto">{tr('Install automatically')}</option><option value="notify">{tr('Notify only')}</option><option value="paused">{tr('Paused')}</option></select></label><label className="update-toggle"><input type="checkbox" checked={draft.windowEnabled} disabled={!usable} onChange={e=>setDraft({...draft,windowEnabled:e.target.checked})}/>{tr('Only within a time window')}</label><KeyboardField label="Update window start" value={draft.start} disabled={!usable||!draft.windowEnabled} onChange={value=>setDraft({...draft,start:value})} maxLength={5} placeholder="HH:MM"/><KeyboardField label="Update window end" value={draft.end} disabled={!usable||!draft.windowEnabled} onChange={value=>setDraft({...draft,end:value})} maxLength={5} placeholder="HH:MM"/><label>{tr('Time zone')}<input aria-label={tr('Update time zone')} value={draft.timeZone} maxLength={80} disabled={!usable} onChange={e=>setDraft({...draft,timeZone:e.target.value})}/></label>{!actionsRef&&<button type="submit" disabled={!usable||!dirty}>{tr('Save update policy')}</button>}<p>{tr('Updates wait until music has stopped. Your settings are preserved.')}</p></form></section>
  {info?.available?.notes&&<section className="update-changes"><h3>{tr('What’s new')}</h3><p>{info.available.notes}</p></section>}
  {info?.manager?.previousAvailable&&<section><h3>{tr('Previous version')}</h3><button disabled={!usable} onClick={()=>setConfirm(true)}>{tr('Restore previous version…')}</button>{confirm&&<div className="update-confirm" role="alert"><p>{tr('Restore the previous version? Automatic updates will be paused.')}</p><button onClick={()=>{setConfirm(false);run('rollback');}}>{tr('Confirm restore')}</button><button onClick={()=>setConfirm(false)}>{tr('Cancel')}</button></div>}</section>}
 </div>;
}
