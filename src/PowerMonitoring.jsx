import React,{useEffect,useRef,useState} from 'react';
import {tr,translateFormat} from '../shared/i18n.js';
import {powerDefaults,powerSettings} from '../shared/power-settings.js';
import {offeredPdProfile} from '../shared/pd-profile.js';
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
const savedSettings=value=>powerSettings({...powerSettings(value.settings),startup100W:value.startup100W??value.settings?.startup100W??false,startup20V:value.startup20V??value.settings?.startup20V??false,startupMaximum20V:value.startupMaximum20V??value.settings?.startupMaximum20V??false});
const cableLabel=amps=>amps===5?'I verified a 100 W USB-C PD supply and a 5 A e-marked cable.':amps>3?'I verified a 5 A e-marked cable and a supply rated for this profile.':'I verified a USB-C PD supply and cable rated for at least 60 W.';

export function usePowerReadings(power,offline=false){
 const [,expire]=useState(0);
 useEffect(()=>{
  if(offline||!powerIsFresh(power))return;
  const timer=setTimeout(()=>expire(v=>v+1),Math.max(0,power.observedAt+powerLifetime(power)-Date.now())+1);
  return()=>clearTimeout(timer);
 },[offline,power?.observedAt,power?.source]);
 return !offline&&powerIsFresh(power)?power:null;
}

export function PowerReadouts({power,requiredWatts=100,offline=false,advanced=true,children}){
 const live=usePowerReadings(power,offline),ina=live?.ina228,pd=live?.pd,health=powerStatus(live,requiredWatts);
 const legacy=!!live&&!ina&&!pd;
 const capacity=Number.isFinite(live?.contractWatts)?live.contractWatts:null;
 const current=ina?.status==='ok',contract=pd?.status==='active';
 const offered=pd?.profiles?.filter(p=>p.volts===20&&Number.isFinite(p.amps)&&p.amps>0&&p.amps<=5);
 const maximum=offered?.length?20*Math.max(...offered.map(p=>p.amps)):null;
 return <section className="power-monitoring" aria-label={tr('Power supply status')}>
  <header><Icon name="hardware" size={32}/><h3>{tr('Power supply')}</h3></header>
  <div className="power-reading-pair">
   <article aria-label={tr('Measured consumption')}><span>{tr('Measured consumption')}</span><strong>{format(live?.watts,1,'W')}</strong><p>{legacy?tr('External power telemetry'):<>INA228 · {tr(names[ina?.status]||'Power readings unavailable')}</>}</p><dl><dt>{tr('Supply voltage')}</dt><dd>{format(live?.volts,2,'V')}</dd><dt>{tr('Supply current')}</dt><dd>{format(live?.amps,3,'A')}</dd></dl>{current&&<small>{tr('Uses the original 15 mΩ shunt. This is consumption, not the PD power limit.')}</small>}{ina?.status==='disabled'&&<small>{tr('Turn on INA228 monitoring below to measure consumption.')}</small>}{ina?.status==='needs-setup'&&<div className="power-setup-hints">{ina.missingConfirmations?.includes('current-path')&&<small>{tr('Confirm that the supply current passes through VIN+ and VIN−.')}</small>}{ina.missingConfirmations?.includes('voltage-sense')&&<small>{tr('VBUS must be physically connected to the monitored positive rail. STEMMA QT alone does not provide voltage sense.')}</small>}</div>}</article>
   <article aria-label={tr('Negotiated PD capacity')}><span>{tr('Active PD contract')}</span><strong>{format(capacity,0,'W')}</strong><p>{legacy?tr('External power telemetry'):<>HUSB238 · {tr(names[pd?.status]||'PD contract unavailable')}</>}</p><dl><dt>{tr('Contract voltage')}</dt><dd>{format(contract?pd.volts:null,0,'V')}</dd><dt>{tr('Contract current')}</dt><dd>{format(contract?pd.amps:null,2,'A')}</dd><dt>{tr('Maximum offered at 20 V')}</dt><dd data-offered-watts={maximum??''}>{format(maximum,0,'W')}</dd></dl><small>{tr('Offered capacity and the active contract are separate from measured consumption.')}</small></article>
  </div>
  <div className="power-health" data-severity={health.severity} role="status"><Icon name={health.severity==='warning'?'alert':health.severity==='ok'?'check':'status'} size={26}/><span>{tr(health.title)}</span><small>{tr('Required')}: {health.required} W</small></div>
  {advanced&&!!pd?.profiles?.length&&<div className="power-profiles"><h4>{tr('Profiles offered by the power supply')}</h4><ul aria-label={tr('Available power profiles')}>{pd.profiles.map(p=><li key={p.volts} data-active={contract&&pd.volts===p.volts&&pd.amps===p.amps}><strong>{p.volts} V</strong><span>{format(p.amps,2,'A')}</span><small>{format(p.watts,0,'W')}</small></li>)}</ul><p>{tr('Offered profiles describe capacity, not consumption. Power setup keeps the existing 20 V rail.')}</p></div>}
  {advanced&&contract&&pd.volts===20&&pd.amps===1.25&&<p className="power-iset-hint">{tr('25 W is 20 V × 1.25 A. This matches the board’s closed-ISET startup setting; it is not a consumption reading.')}</p>}
  {[3,4,5].includes(pd?.responseCode)&&<p className="power-error" role="alert">{tr('The PD controller reports a failed previous request.')}</p>}
  {ina?.status==='error'&&<p className="power-error" role="alert">{tr('The INA228 measurement is unavailable. Check its connection, conversion mode and voltage sense wiring.')}</p>}
  {children}
 </section>;
}

export function PowerMonitoring({power,offline=false,onDirty,actionsRef,pending=false,onVerifiedWatts,advanced=false,onOpenAdvanced}){
 const device=useDeviceUpdates(),[info,setInfo]=useState(null),[base,setBase]=useState(null),[draft,setDraft]=useState(null),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const [setup,setSetup]=useState(null),[cable,setCable]=useState(false),[cable5A,setCable5A]=useState(false),[startup,setStartup]=useState(false),[threshold,setThreshold]=useState(true),[requesting,setRequesting]=useState(false),[discovering,setDiscovering]=useState(false),[discovered,setDiscovered]=useState(null),[failure,setFailure]=useState(''),[success,setSuccess]=useState(null);
 const generation=useRef(0),savingRef=useRef(false);
 const dirty=!!base&&!!draft&&JSON.stringify(base)!==JSON.stringify(draft);
 const token=device?.info?.controlToken,live=usePowerReadings(power,offline),queried=usePowerReadings(discovered,offline);
 const pd=queried&&queried.observedAt>(live?.pd?.observedAt??live?.observedAt??0)?queried:live?.pd,profile=offeredPdProfile(pd);
 const supportedProfile=profile&&(info?.profileRequestSupported||info?.negotiationSupported&&profile.amps===5);
 const canDiscover=info?.sourceDiscoverySupported&&pd?.status==='active'&&pd.volts===20;
 const profileChanged=!!setup&&(!profile||profile.amps!==setup.amps);
 useEffect(()=>{const id=++generation.current;let live=true;
  if(offline||!token)return()=>{live=false;generation.current++;};
  setLoading(true);setError('');
  device.action('power-status').then(value=>{if(live&&id===generation.current){setInfo(value);if(value.error)throw Error(value.error);const settings=savedSettings(value);setBase(settings);setDraft({...settings});}}).catch(error=>{if(live)setError(!error.message||/Unsupported (device action|action)/.test(error.message)?'Power monitoring needs the complete device update.':error.message);}).finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;generation.current++;};
 },[offline,token,retry,device?.action]);
 useEffect(()=>{onDirty?.(dirty||requesting||discovering);},[dirty,requesting,discovering,onDirty]);
 useEffect(()=>()=>{onDirty?.(false);if(actionsRef)actionsRef.current=null;},[onDirty,actionsRef]);
 async function save(){
  if(savingRef.current)return false;
  if(!dirty)return true;
  if(offline||!token||!info?.supported||savingRef.current)return false;
  savingRef.current=true;setSaving(true);setError('');
  try{
   const request=powerSettings(draft);
   if(!info.negotiationSupported)delete request.startup100W;
   if(!info.profileRequestSupported)delete request.startup20V;
   if(!info.maximumRequestSupported)delete request.startupMaximum20V;
   const value=await device.action('power-config',{settings:request}),settings=savedSettings(value);
   setInfo(value);setBase(settings);setDraft({...settings});onDirty?.(false);return true;
  }catch(e){setError(e.message);return false;}
  finally{savingRef.current=false;setSaving(false);}
 }
 function discard(){if(savingRef.current)return;if(base)setDraft({...base});setError('');onDirty?.(false);}
 if(actionsRef)actionsRef.current={save,discard,restore:()=>{if(!savingRef.current){setDraft({...powerDefaults});setError('');}}};
 const disabled=offline||loading||saving||requesting||discovering||pending||!info?.supported||!draft;
 const change=(key,value)=>{setError('');setSuccess(null);setDraft(old=>({...old,[key]:value,...(key==='husb238'&&!value?{startup100W:false,startup20V:false,startupMaximum20V:false}:{})}));};
 function closeSetup(){if(!savingRef.current){setSetup(null);if(error)setRetry(value=>value+1);}}
 async function readFailureInfo(){try{setInfo(await device.action('power-status'));}catch{/* Keep the original actionable failure. */}}
 async function openSetup(){
  // Never refuse silently: say why the setup cannot start.
  if(dirty){setError('Save or cancel your changes before starting power setup.');return;}
  if(!token){setError('Reload TuneBox before power setup.');return;}
  if(disabled||savingRef.current){setError('Power setup is busy or unavailable right now. Wait a moment and try again.');return;}
  setCable(false);setCable5A(false);setStartup(false);setThreshold(true);setError('');
  // The helper may have been installed after this page opened: read its capabilities again first.
  let current=info;try{current=await device.action('power-status');setInfo(current);}catch{}
  if(!current?.supported){setError('Power monitoring needs the complete device update.');return;}
  if(!current.sourceDiscoverySupported){if(supportedProfile)setSetup({...profile});else setError(current.negotiationSupported?'This helper supports 100 W only. Complete the device update to set up a lower offered profile.':'Complete the device update to install power setup.');return;}
  if(!canDiscover){setError(pd?.status!=='active'?'The power contract is not readable right now. Check that HUSB238 reading is on and the adapter is connected.':'The adapter is not delivering 20 V at the moment, so the offers cannot be checked.');return;}
  savingRef.current=true;setDiscovering(true);
  try{
   const value=await device.action('power-discover-20v'),target=offeredPdProfile(value.discoveredPd);
   if(value.sourceCapabilitiesQueried!==true||!target||!powerIsFresh(value.discoveredPd))throw Error('Source capabilities were not confirmed; no power request was sent');
   setDiscovered(value.discoveredPd);setInfo(value);setSetup(target);
  }catch(e){setError(e.message);setFailure(e.message);await readFailureInfo();}
  finally{savingRef.current=false;setDiscovering(false);}
 }
 async function requestPower(){
  if(!cable||!setup||profileChanged||dirty||disabled||savingRef.current||!supportedProfile)return;
  const target={...setup},useThreshold=threshold;
  savingRef.current=true;setRequesting(true);setError('');setSuccess(null);
  try{
   const command=info.maximumRequestSupported?'power-request-max20v':info.profileRequestSupported?'power-request-20v':'power-request-100w';
   const args={confirmed:true,cable5AVerified:!!(target.amps>3||info.maximumRequestSupported&&startup&&cable5A),startup,...(info.profileRequestSupported?{amps:target.amps}:{})};
   const value=await device.action(command,args);
   if(value.pd?.verified!==true||value.pd.volts!==20||value.pd.amps!==target.amps||value.pd.watts!==target.watts)throw Error('The selected 20 V power contract was not confirmed. No automatic retry was queued.');
   const settings=savedSettings(value);setInfo(value);setBase(settings);setDraft({...settings});setSuccess(value.pd);setSetup(null);
   if(useThreshold)onVerifiedWatts?.(target.watts);
  }catch(e){setError(e.message);await readFailureInfo();}
  finally{savingRef.current=false;setRequesting(false);}
 }
 const automatic=draft?.startup20V||draft?.startup100W||draft?.startupMaximum20V,canRepeat=info?.pdProfileQualified||info?.pdQualified;
 const maximumStartup=!!(draft?.startupMaximum20V||!draft?.startup20V&&!draft?.startup100W&&info?.maximumProfileQualified);
 const startupLabel='Keep these settings after restart';
 return <div className="power-configuration" aria-label={tr('Power monitoring settings')}>
  <header><h4>{tr('Power monitoring')}</h4><button type="button" disabled={dirty||loading||saving||requesting||discovering||pending||offline||!token} onClick={()=>setRetry(v=>v+1)} aria-label={tr('Refresh power setup')}>{loading?<span className="ui-spinner"/>:<Icon name="update" size={22}/>}</button></header>
  {!offline&&!token&&<p role="status">{tr('Connecting to the device manager…')}</p>}
  {loading&&<p role="status">{tr('Reading power setup…')}</p>}
  {info?.simulated&&<p>{tr('Simulation: no power devices are connected.')}</p>}
  {!loading&&info&&!info.supported&&!info.simulated&&<p>{tr('Power monitoring needs the complete device update.')}</p>}
  {advanced&&<><div className="power-config-grid"><label className="hub-check"><input type="checkbox" checked={!!draft?.ina228} disabled={disabled} onChange={e=>change('ina228',e.target.checked)}/>{tr('Read INA228 consumption')}</label><label className="hub-check"><input type="checkbox" checked={!!draft?.husb238} disabled={disabled} onChange={e=>change('husb238',e.target.checked)}/>{tr('Read HUSB238 PD contract')}</label></div>
  {draft?.ina228&&<div className="power-wiring"><p>{tr('Confirm the measurement wiring once. Unconfirmed measurements stay unavailable.')}</p><label className="hub-check"><input type="checkbox" checked={draft.currentPathVerified} disabled={disabled} onChange={e=>change('currentPathVerified',e.target.checked)}/>{tr('The monitored current flows through VIN+ and VIN−.')}</label><label className="hub-check"><input type="checkbox" checked={draft.voltageSenseVerified} disabled={disabled} onChange={e=>change('voltageSenseVerified',e.target.checked)}/>{tr('VBUS senses the monitored supply voltage.')}</label></div>}
  <p>{tr('Save to apply monitoring changes. Reading the PD contract does not change the supply voltage.')}</p></>}
  {!advanced&&onOpenAdvanced&&<p>{tr('Sensor installation and wiring options are in Developer.')}{' '}<button type="button" disabled={disabled} onClick={onOpenAdvanced}>{tr('Open hardware setup')}</button></p>}
  <div className="power-pd-setup">
   <div><h4>{tr('20 V power setup')}</h4><p>{tr('Request the offered 20 V profile once, then verify the active voltage and current. A 60 W profile does not require a 100 W offer.')}</p>{profile&&<p className="power-pd-target">{translateFormat('{watts} W offered at 20 V / {amps} A',profile)}</p>}</div>
   <button type="button" disabled={disabled||dirty||!token||!(canDiscover||supportedProfile)} onClick={openSetup}>{tr('Set up offered power')}</button>
   {!loading&&!dirty&&info?.supported&&!(canDiscover||supportedProfile)&&<p className="power-setup-blocked" role="status">{tr(!token?'Reload TuneBox before power setup.':!info.negotiationSupported?'Complete the device update to install power setup.':pd?.status!=='active'?'The power contract is not readable right now. Check that HUSB238 reading is on and the adapter is connected.':pd.volts!==20?'The adapter is not delivering 20 V at the moment, so the offers cannot be checked.':'Waiting for a fresh active 20 V rail with an offered profile of at least 60 W.')} <button type="button" disabled={offline||loading} onClick={()=>setRetry(v=>v+1)}>{tr('Check again')}</button></p>}
   {info?.sourceDiscoverySupported&&<p>{tr('Power setup queries the connected source again before choosing its highest offered 20 V current.')}</p>}
   {dirty&&<p>{tr('Save or cancel your changes before starting power setup.')}</p>}
   {!loading&&info?.supported&&!info.profileRequestSupported&&<p>{tr(info.negotiationSupported?'This helper supports 100 W only. Complete the device update to set up a lower offered profile.':'Complete the device update to install power setup.')}</p>}
   {!loading&&info?.supported&&info.profileRequestSupported&&!profile&&<p>{tr('Waiting for a fresh active 20 V rail with an offered profile of at least 60 W.')}</p>}
   {['interrupted','failed'].includes(info?.lastPdRequest)&&<p className="power-error">{tr('The previous power setup did not complete. Automatic requests are blocked until manual setup succeeds.')}</p>}
   {(canRepeat||automatic)&&<><label className="hub-check"><input type="checkbox" checked={!!automatic} disabled={disabled||!canRepeat&&!automatic} onChange={e=>{setError('');setDraft(old=>({...old,startupMaximum20V:maximumStartup&&e.target.checked,startup20V:!maximumStartup&&!!info.profileRequestSupported&&e.target.checked,startup100W:!maximumStartup&&!info.profileRequestSupported&&e.target.checked}));}}/>{tr(startupLabel)}</label><p>{tr(maximumStartup?'After restarting, TuneBox checks the adapter again and uses the highest available power at 20 V. The wattage can change if you use a different adapter or cable.':'After restarting, TuneBox checks and restores this verified power setting. If the adapter changes, run power setup again.')}</p></>}
   {success&&<p className="power-pd-success" role="status"><Icon name="check" size={24}/>{translateFormat('Verified {watts} W at 20 V / {amps} A. This is capacity, not consumption.',success)}</p>}
  </div>
  {error&&!setup&&<p className="power-error" role="alert">{tr(error)}</p>}
  {failure&&!discovering&&!setup&&<Modal label="Power setup could not start" onCancel={()=>setFailure('')} className="power-pd-dialog"><header><h3>{tr('Power setup could not start')}</h3></header><div className="power-pd-body"><p role="alert">{tr(failure)}</p><p>{tr('No power request was sent. The supply keeps its current contract.')}</p></div><footer><button onClick={()=>setFailure('')}>{tr('OK')}</button></footer></Modal>}
  {discovering&&<Modal label="20 V power setup" className="power-pd-dialog"><header><h3>{tr('20 V power setup')}</h3></header><div className="power-pd-body"><p role="status" aria-live="polite"><span className="ui-spinner"/>{tr('Querying the connected power supply…')}</p><p>{tr('No power profile is selected during discovery.')}</p></div></Modal>}
  {setup&&<Modal label="20 V power setup" onCancel={closeSetup} className="power-pd-dialog">
   <header><h3>{tr('20 V power setup')}</h3><p className="power-pd-target">{translateFormat('Verify {watts} W at 20 V / {amps} A',setup)}</p></header>
   <div className="power-pd-body">
   <p>{tr('Pause music and remove TuneBox from its group first. The supply must already be at 20 V and offer this exact current on this port.')}</p>
   <p>{tr('A new PD contract can briefly interrupt power and restart TuneBox. Only one request is sent; failures are never retried automatically.')}</p>
   <label className="hub-check"><input type="checkbox" checked={cable} disabled={requesting||offline} onChange={e=>setCable(e.target.checked)}/>{tr(cableLabel(setup.amps))}</label>
   <label className="hub-check"><input type="checkbox" checked={startup} disabled={requesting||offline} onChange={e=>setStartup(e.target.checked)}/>{tr(startupLabel)}</label>
   <p>{tr(info?.maximumRequestSupported?'After restarting, TuneBox checks the adapter again and uses the highest available power at 20 V. The wattage can change if you use a different adapter or cable.':'After restarting, TuneBox checks and restores this verified power setting. If the adapter changes, run power setup again.')}</p>
   {info?.maximumRequestSupported&&startup&&setup.amps===3&&<label className="hub-check"><input type="checkbox" checked={cable5A} disabled={requesting||offline} onChange={e=>setCable5A(e.target.checked)}/>{tr('My cable is also 5 A e-marked, allowing future 20 V offers above 60 W.')}</label>}
   {onVerifiedWatts&&<><label className="hub-check"><input type="checkbox" checked={threshold} disabled={requesting||offline} onChange={e=>setThreshold(e.target.checked)}/>{tr('Use verified capacity as the power warning threshold')}</label><p>{tr('After successful verification, Save applies this warning threshold. This does not limit amplifier power or volume.')}</p></>}
   {profileChanged&&<p role="alert">{tr('The offered profile changed or expired. Close this dialog and check power setup again.')}</p>}
   {requesting&&<p role="status" aria-live="polite"><span className="ui-spinner"/>{tr('Requesting and verifying the selected power profile…')}</p>}
   {error&&<p className="power-error" role="alert">{tr(error)}</p>}
   </div>
   <div className="power-pd-actions"><button type="button" disabled={requesting} onClick={closeSetup}>{tr('Cancel')}</button><button type="button" disabled={!cable||requesting||profileChanged||offline||pending||!token} onClick={requestPower}>{tr('Request and verify power')}</button></div>
  </Modal>}
 </div>;
}
