import React,{useEffect,useRef,useState} from 'react';
import {tr} from '../shared/i18n.js';
import {powerDefaults,powerSettings} from '../shared/power-settings.js';
import {powerStatus,powerIsFresh,powerLifetime} from '../shared/power-status.js';
import {useDeviceUpdates} from './DeviceUpdates.jsx';
import {Icon} from './Icon.jsx';
import './power-monitoring.css';

const format=(value,places=1,unit='')=>{
 if(!Number.isFinite(value))return tr('Unavailable');
 const rounded=Math.round(value*10**places)/10**places;
 return (Object.is(rounded,-0)?0:rounded).toFixed(places)+(unit?' '+unit:'');
};
const names={disabled:'Monitoring is off',error:'Reading failed',stale:'Reading is out of date','needs-setup':'Confirm sensor wiring',ok:'Live measurement',active:'PD contract active',attached:'Connected · no PD contract',detached:'USB-C source not connected',changing:'PD contract is changing'};

export function usePowerReadings(power,offline=false){
 const [,expire]=useState(0);
 useEffect(()=>{
  if(offline||!powerIsFresh(power))return;
  const timer=setTimeout(()=>expire(v=>v+1),Math.max(0,power.observedAt+powerLifetime(power)-Date.now())+1);
  return()=>clearTimeout(timer);
 },[offline,power?.observedAt,power?.source]);
 return !offline&&powerIsFresh(power)?power:null;
}

export function PowerReadouts({power,requiredWatts=100,offline=false,children}){
 const live=usePowerReadings(power,offline),ina=live?.ina228,pd=live?.pd,health=powerStatus(live,requiredWatts);
 const legacy=!!live&&!ina&&!pd;
 const capacity=Number.isFinite(live?.contractWatts)?live.contractWatts:null;
 const current=ina?.status==='ok',contract=pd?.status==='active';
 return <section className="power-monitoring" aria-label={tr('Power supply status')}>
  <header><Icon name="hardware" size={32}/><h3>{tr('Power supply')}</h3></header>
  <div className="power-reading-pair">
   <article aria-label={tr('Measured consumption')}><span>{tr('Measured consumption')}</span><strong>{format(live?.watts,1,'W')}</strong><p>{legacy?tr('External power telemetry'):<>INA228 · {tr(names[ina?.status]||'Power readings unavailable')}</>}</p><dl><dt>{tr('Supply voltage')}</dt><dd>{format(live?.volts,2,'V')}</dd><dt>{tr('Supply current')}</dt><dd>{format(live?.amps,3,'A')}</dd></dl>{current&&<small>{tr('Uses the original 15 mΩ shunt. This is consumption, not the PD power limit.')}</small>}</article>
   <article aria-label={tr('Negotiated PD capacity')}><span>{tr('Negotiated PD capacity')}</span><strong>{format(capacity,0,'W')}</strong><p>{legacy?tr('External power telemetry'):<>HUSB238 · {tr(names[pd?.status]||'PD contract unavailable')}</>}</p><dl><dt>{tr('Contract voltage')}</dt><dd>{format(contract?pd.volts:null,0,'V')}</dd><dt>{tr('Contract current')}</dt><dd>{format(contract?pd.amps:null,2,'A')}</dd></dl></article>
  </div>
  <div className="power-health" data-severity={health.severity} role="status"><Icon name={health.severity==='warning'?'alert':health.severity==='ok'?'check':'status'} size={26}/><span>{tr(health.title)}</span><small>{tr('Required')}: {health.required} W</small></div>
  {!!pd?.profiles?.length&&<div className="power-profiles"><h4>{tr('Profiles offered by the power supply')}</h4><ul aria-label={tr('Available power profiles')}>{pd.profiles.map(p=><li key={p.volts} data-active={contract&&pd.volts===p.volts&&pd.amps===p.amps}><strong>{p.volts} V</strong><span>{format(p.amps,2,'A')}</span><small>{format(p.watts,0,'W')}</small></li>)}</ul><p>{tr('Offered profiles and the active contract can differ. Voltage selection stays with the PD board.')}</p></div>}
  {[3,4,5].includes(pd?.responseCode)&&<p className="power-error" role="alert">{tr('The PD controller reports a failed previous request.')}</p>}
  {ina?.status==='error'&&<p className="power-error" role="alert">{tr('The INA228 measurement is unavailable. Check its connection, conversion mode and voltage sense wiring.')}</p>}
  {children}
 </section>;
}

export function PowerMonitoring({offline=false,onDirty,actionsRef,pending=false}){
 const device=useDeviceUpdates(),[info,setInfo]=useState(null),[base,setBase]=useState(null),[draft,setDraft]=useState(null),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const generation=useRef(0),savingRef=useRef(false);
 const dirty=!!base&&!!draft&&JSON.stringify(base)!==JSON.stringify(draft);
 const token=device?.info?.controlToken;
 useEffect(()=>{const id=++generation.current;let live=true;
  if(offline||!token)return()=>{live=false;generation.current++;};
  setLoading(true);setError('');
  device.action('power-status').then(value=>{if(live&&id===generation.current){setInfo(value);if(value.error)throw Error(value.error);const settings=powerSettings(value.settings);setBase(settings);setDraft({...settings});}}).catch(error=>{if(live)setError(!error.message||/Unsupported (device action|action)/.test(error.message)?'Power monitoring needs the complete device update.':error.message);}).finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;generation.current++;};
 },[offline,token,retry,device?.action]);
 useEffect(()=>{onDirty?.(dirty);},[dirty,onDirty]);
 useEffect(()=>()=>{onDirty?.(false);if(actionsRef)actionsRef.current=null;},[onDirty,actionsRef]);
 async function save(){
  if(!dirty)return true;
  if(offline||!token||!info?.supported||savingRef.current)return false;
  savingRef.current=true;setSaving(true);setError('');
  try{const value=await device.action('power-config',{settings:powerSettings(draft)}),settings=powerSettings(value.settings);setInfo(value);setBase(settings);setDraft({...settings});onDirty?.(false);return true;}
  catch(e){setError(e.message);return false;}
  finally{savingRef.current=false;setSaving(false);}
 }
 function discard(){if(base)setDraft({...base});setError('');onDirty?.(false);}
 if(actionsRef)actionsRef.current={save,discard,restore:()=>{setDraft({...powerDefaults});setError('');}};
 const disabled=offline||loading||saving||pending||!info?.supported||!draft;
 const change=(key,value)=>{setError('');setDraft(old=>({...old,[key]:value}));};
 return <div className="power-configuration" aria-label={tr('Power monitoring settings')}>
  <header><h4>{tr('Power monitoring')}</h4><button type="button" disabled={dirty||loading||saving||pending||offline||!token} onClick={()=>setRetry(v=>v+1)} aria-label={tr('Refresh power setup')}>{loading?<span className="ui-spinner"/>:<Icon name="update" size={22}/>}</button></header>
  {!offline&&!token&&<p role="status">{tr('Connecting to the device manager…')}</p>}
  {loading&&<p role="status">{tr('Reading power setup…')}</p>}
  {info?.simulated&&<p>{tr('Simulation: no power devices are connected.')}</p>}
  {!loading&&info&&!info.supported&&!info.simulated&&<p>{tr('Power monitoring needs the complete device update.')}</p>}
  <div className="power-config-grid"><label className="hub-check"><input type="checkbox" checked={!!draft?.ina228} disabled={disabled} onChange={e=>change('ina228',e.target.checked)}/>{tr('Read INA228 consumption')}</label><label className="hub-check"><input type="checkbox" checked={!!draft?.husb238} disabled={disabled} onChange={e=>change('husb238',e.target.checked)}/>{tr('Read HUSB238 PD contract')}</label></div>
  {draft?.ina228&&<div className="power-wiring"><p>{tr('Confirm the measurement wiring once. Unconfirmed measurements stay unavailable.')}</p><label className="hub-check"><input type="checkbox" checked={draft.currentPathVerified} disabled={disabled} onChange={e=>change('currentPathVerified',e.target.checked)}/>{tr('The monitored current flows through VIN+ and VIN−.')}</label><label className="hub-check"><input type="checkbox" checked={draft.voltageSenseVerified} disabled={disabled} onChange={e=>change('voltageSenseVerified',e.target.checked)}/>{tr('VBUS senses the monitored supply voltage.')}</label></div>}
  <p>{tr('Save to apply monitoring changes. Reading the PD contract does not change the supply voltage.')}</p>
  {error&&<p className="power-error" role="alert">{tr(error)}</p>}
 </div>;
}
