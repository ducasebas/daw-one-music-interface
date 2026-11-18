import React,{useEffect,useRef,useState} from 'react';
import {tr} from '../shared/i18n.js';
import {powerDefaults,powerSettings} from '../shared/power-settings.js';
import {powerStatus,powerIsFresh,powerLifetime} from '../shared/power-status.js';
import {useDeviceUpdates} from './DeviceUpdates.jsx';
import {Icon} from './Icon.jsx';
import {Modal} from './Modal.jsx';
import './power-monitoring.css';

const format=(value,places=1,unit='')=>{
 if(!Number.isFinite(value))return tr('Unavailable');
 const rounded=Math.round(value*10**places)/10**places;
 return (Object.is(rounded,-0)?0:rounded).toFixed(places)+(unit?' '+unit:'');
};
const names={disabled:'Monitoring is off',error:'Reading failed',stale:'Reading is out of date','needs-setup':'Confirm sensor wiring',ok:'Live measurement',active:'PD contract active',attached:'Connected · no PD contract',detached:'USB-C source not connected',changing:'PD contract is changing'};
const savedSettings=value=>powerSettings({...powerSettings(value.settings),startup100W:value.startup100W??value.settings?.startup100W??false});

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
   <article aria-label={tr('Measured consumption')}><span>{tr('Measured consumption')}</span><strong>{format(live?.watts,1,'W')}</strong><p>{legacy?tr('External power telemetry'):<>INA228 · {tr(names[ina?.status]||'Power readings unavailable')}</>}</p><dl><dt>{tr('Supply voltage')}</dt><dd>{format(live?.volts,2,'V')}</dd><dt>{tr('Supply current')}</dt><dd>{format(live?.amps,3,'A')}</dd></dl>{current&&<small>{tr('Uses the original 15 mΩ shunt. This is consumption, not the PD power limit.')}</small>}{ina?.status==='disabled'&&<small>{tr('Turn on INA228 monitoring below to measure consumption.')}</small>}{ina?.status==='needs-setup'&&<div className="power-setup-hints">{ina.missingConfirmations?.includes('current-path')&&<small>{tr('Confirm that the supply current passes through VIN+ and VIN−.')}</small>}{ina.missingConfirmations?.includes('voltage-sense')&&<small>{tr('VBUS must be physically connected to the monitored positive rail. STEMMA QT alone does not provide voltage sense.')}</small>}</div>}</article>
   <article aria-label={tr('Negotiated PD capacity')}><span>{tr('Negotiated PD capacity')}</span><strong>{format(capacity,0,'W')}</strong><p>{legacy?tr('External power telemetry'):<>HUSB238 · {tr(names[pd?.status]||'PD contract unavailable')}</>}</p><dl><dt>{tr('Contract voltage')}</dt><dd>{format(contract?pd.volts:null,0,'V')}</dd><dt>{tr('Contract current')}</dt><dd>{format(contract?pd.amps:null,2,'A')}</dd></dl></article>
  </div>
  <div className="power-health" data-severity={health.severity} role="status"><Icon name={health.severity==='warning'?'alert':health.severity==='ok'?'check':'status'} size={26}/><span>{tr(health.title)}</span><small>{tr('Required')}: {health.required} W</small></div>
  {!!pd?.profiles?.length&&<div className="power-profiles"><h4>{tr('Profiles offered by the power supply')}</h4><ul aria-label={tr('Available power profiles')}>{pd.profiles.map(p=><li key={p.volts} data-active={contract&&pd.volts===p.volts&&pd.amps===p.amps}><strong>{p.volts} V</strong><span>{format(p.amps,2,'A')}</span><small>{format(p.watts,0,'W')}</small></li>)}</ul><p>{tr('Offered profiles describe capacity, not consumption. The 100 W setup requires an existing 20 V contract.')}</p></div>}
  {contract&&pd.volts===20&&pd.amps===1.25&&<p className="power-iset-hint">{tr('25 W is 20 V × 1.25 A. This matches the board’s closed-ISET startup setting; it is not a consumption reading.')}</p>}
  {[3,4,5].includes(pd?.responseCode)&&<p className="power-error" role="alert">{tr('The PD controller reports a failed previous request.')}</p>}
  {ina?.status==='error'&&<p className="power-error" role="alert">{tr('The INA228 measurement is unavailable. Check its connection, conversion mode and voltage sense wiring.')}</p>}
  {children}
 </section>;
}

export function PowerMonitoring({offline=false,onDirty,actionsRef,pending=false}){
 const device=useDeviceUpdates(),[info,setInfo]=useState(null),[base,setBase]=useState(null),[draft,setDraft]=useState(null),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const [setup,setSetup]=useState(false),[cable,setCable]=useState(false),[startup,setStartup]=useState(false),[requesting,setRequesting]=useState(false),[success,setSuccess]=useState(false);
 const generation=useRef(0),savingRef=useRef(false);
 const dirty=!!base&&!!draft&&JSON.stringify(base)!==JSON.stringify(draft);
 const token=device?.info?.controlToken;
 useEffect(()=>{const id=++generation.current;let live=true;
  if(offline||!token)return()=>{live=false;generation.current++;};
  setLoading(true);setError('');
  device.action('power-status').then(value=>{if(live&&id===generation.current){setInfo(value);if(value.error)throw Error(value.error);const settings=savedSettings(value);setBase(settings);setDraft({...settings});}}).catch(error=>{if(live)setError(!error.message||/Unsupported (device action|action)/.test(error.message)?'Power monitoring needs the complete device update.':error.message);}).finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;generation.current++;};
 },[offline,token,retry,device?.action]);
 useEffect(()=>{onDirty?.(dirty||requesting);},[dirty,requesting,onDirty]);
 useEffect(()=>()=>{onDirty?.(false);if(actionsRef)actionsRef.current=null;},[onDirty,actionsRef]);
 async function save(){
  if(savingRef.current)return false;
  if(!dirty)return true;
  if(offline||!token||!info?.supported||savingRef.current)return false;
  savingRef.current=true;setSaving(true);setError('');
  try{const request=powerSettings(draft);if(!info.negotiationSupported)delete request.startup100W;const value=await device.action('power-config',{settings:request}),settings=savedSettings(value);setInfo(value);setBase(settings);setDraft({...settings});onDirty?.(false);return true;}
  catch(e){setError(e.message);return false;}
  finally{savingRef.current=false;setSaving(false);}
 }
 function discard(){if(savingRef.current)return;if(base)setDraft({...base});setError('');onDirty?.(false);}
 if(actionsRef)actionsRef.current={save,discard,restore:()=>{if(!savingRef.current){setDraft({...powerDefaults});setError('');}}};
 const disabled=offline||loading||saving||requesting||pending||!info?.supported||!draft;
 const change=(key,value)=>{setError('');setSuccess(false);setDraft(old=>({...old,[key]:value,...(key==='husb238'&&!value?{startup100W:false}:{})}));};
 function closeSetup(){if(!savingRef.current){setSetup(false);if(error)setRetry(value=>value+1);}}
 async function request100W(){
  if(!cable||dirty||disabled||savingRef.current||!info?.negotiationSupported)return;
  savingRef.current=true;setRequesting(true);setError('');setSuccess(false);
  try{
   const value=await device.action('power-request-100w',{confirmed:true,cable5AVerified:true,startup});
   if(value.pd?.verified!==true||value.pd.volts!==20||value.pd.amps!==5)throw Error('The 20 V / 5 A contract was not confirmed. No automatic retry was queued.');
   const settings=savedSettings(value);setInfo(value);setBase(settings);setDraft({...settings});setSuccess(true);setSetup(false);
  }catch(e){setError(e.message);}
  finally{savingRef.current=false;setRequesting(false);}
 }
 return <div className="power-configuration" aria-label={tr('Power monitoring settings')}>
  <header><h4>{tr('Power monitoring')}</h4><button type="button" disabled={dirty||loading||saving||requesting||pending||offline||!token} onClick={()=>setRetry(v=>v+1)} aria-label={tr('Refresh power setup')}>{loading?<span className="ui-spinner"/>:<Icon name="update" size={22}/>}</button></header>
  {!offline&&!token&&<p role="status">{tr('Connecting to the device manager…')}</p>}
  {loading&&<p role="status">{tr('Reading power setup…')}</p>}
  {info?.simulated&&<p>{tr('Simulation: no power devices are connected.')}</p>}
  {!loading&&info&&!info.supported&&!info.simulated&&<p>{tr('Power monitoring needs the complete device update.')}</p>}
  <div className="power-config-grid"><label className="hub-check"><input type="checkbox" checked={!!draft?.ina228} disabled={disabled} onChange={e=>change('ina228',e.target.checked)}/>{tr('Read INA228 consumption')}</label><label className="hub-check"><input type="checkbox" checked={!!draft?.husb238} disabled={disabled} onChange={e=>change('husb238',e.target.checked)}/>{tr('Read HUSB238 PD contract')}</label></div>
  {draft?.ina228&&<div className="power-wiring"><p>{tr('Confirm the measurement wiring once. Unconfirmed measurements stay unavailable.')}</p><label className="hub-check"><input type="checkbox" checked={draft.currentPathVerified} disabled={disabled} onChange={e=>change('currentPathVerified',e.target.checked)}/>{tr('The monitored current flows through VIN+ and VIN−.')}</label><label className="hub-check"><input type="checkbox" checked={draft.voltageSenseVerified} disabled={disabled} onChange={e=>change('voltageSenseVerified',e.target.checked)}/>{tr('VBUS senses the monitored supply voltage.')}</label></div>}
  <p>{tr('Save to apply monitoring changes. Reading the PD contract does not change the supply voltage.')}</p>
  <div className="power-pd-setup"><div><h4>{tr('100 W power setup')}</h4><p>{tr('Request the offered 20 V / 5 A profile once, then verify the active contract. Ordinary monitoring never requests power.')}</p></div><button type="button" disabled={disabled||dirty||!token||!info?.negotiationSupported} onClick={()=>{setCable(false);setStartup(false);setError('');setSetup(true);}}>{tr('Set up 100 W')}</button>
   {dirty&&<p>{tr('Save or cancel your changes before starting the 100 W setup.')}</p>}
   {!loading&&info?.supported&&!info.negotiationSupported&&<p>{tr('Complete the device update to install the 100 W setup.')}</p>}
   {['interrupted','failed'].includes(info?.lastPdRequest)&&<p className="power-error">{tr('The previous power setup did not complete. Automatic requests are blocked until manual setup succeeds.')}</p>}
   {(info?.pdQualified||draft?.startup100W)&&<label className="hub-check"><input type="checkbox" checked={!!draft?.startup100W} disabled={disabled||!info?.pdQualified&&!draft?.startup100W} onChange={e=>change('startup100W',e.target.checked)}/>{tr('Repeat verified 100 W setup at startup')}</label>}
   {success&&<p className="power-pd-success" role="status"><Icon name="check" size={24}/>{tr('20 V / 5 A confirmed. 100 W is available capacity, not consumption.')}</p>}
  </div>
  {error&&!setup&&<p className="power-error" role="alert">{tr(error)}</p>}
  {setup&&<Modal label="100 W power setup" onCancel={closeSetup} className="power-pd-dialog"><h3>{tr('100 W power setup')}</h3><p>{tr('Pause music and remove TuneBox from its group first. The supply must already be at 20 V and offer 5 A on this port.')}</p><p>{tr('A new PD contract can briefly interrupt power and restart TuneBox. Only one request is sent; failures are never retried automatically.')}</p><label className="hub-check"><input type="checkbox" checked={cable} disabled={requesting||offline} onChange={e=>setCable(e.target.checked)}/>{tr('I verified a 100 W USB-C PD supply and a 5 A e-marked cable.')}</label><label className="hub-check"><input type="checkbox" checked={startup} disabled={requesting||offline} onChange={e=>setStartup(e.target.checked)}/>{tr('Repeat verified 100 W setup at startup')}</label><p>{tr('Automatic startup setup is saved only after the 20 V / 5 A contract is confirmed.')}</p>{requesting&&<p role="status" aria-live="polite"><span className="ui-spinner"/>{tr('Requesting and verifying 100 W…')}</p>}{error&&<p className="power-error" role="alert">{tr(error)}</p>}<div className="power-pd-actions"><button type="button" disabled={requesting} onClick={closeSetup}>{tr('Cancel')}</button><button type="button" disabled={!cable||requesting||offline||pending||!token} onClick={request100W}>{tr('Request and verify 100 W')}</button></div></Modal>}
 </div>;
}
