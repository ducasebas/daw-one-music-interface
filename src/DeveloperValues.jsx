import React,{useEffect,useState} from 'react';
import {tr} from '../shared/i18n.js';
import {useDeviceUpdates} from './DeviceUpdates.jsx';
import {presentationTiming,visualizerDelay,calibratedPresentation} from '../shared/presentation-timing.js';
import {referenceTiming} from '../shared/timing-reference.js';

const ms=v=>Number.isFinite(v)?`${Math.round(v)} ms`:'—';
const when=v=>{const t=Date.parse(v);return Number.isFinite(t)?new Date(t).toLocaleString():'—';};
const watts=p=>p&&Number.isFinite(p.volts)&&Number.isFinite(p.amps)?`${p.volts} V · ${p.amps} A · ${Math.round(p.volts*p.amps)} W`:'—';
const responses={0:'No response yet',1:'Accepted',3:'Rejected',4:'Not supported',5:'Busy'};
function Facts({rows}){return <dl className="system-facts">{rows.map(([k,v])=><React.Fragment key={k}><dt>{tr(k)}</dt><dd>{typeof v==='string'?tr(v):v}</dd></React.Fragment>)}</dl>;}
/** Read-only values for troubleshooting: the timing TuneBox actually uses and the power contract it reads. */
export function DeveloperValues({snapshot,offline}){
 const device=useDeviceUpdates();
 const [sync,setSync]=useState(null),[power,setPower]=useState(null),[manager,setManager]=useState(null),[error,setError]=useState(''),[round,setRound]=useState(0);
 useEffect(()=>{if(offline)return;let live=true;setError('');
  fetch('/api/sync/profiles',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(Error('Unlock settings to read the timing profiles'))).then(v=>{if(live)setSync(v);}).catch(e=>{if(live)setError(e.message);});
  fetch('/api/power',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(v=>{if(live)setPower(v?.power||null);}).catch(()=>{});
  device?.action?.('power-status').then(v=>{if(live)setManager(v);}).catch(()=>{});
  return()=>{live=false;};},[offline,round]);
 const prefs=snapshot.preferences?.prefs||{};
 const active=sync?.profiles?.find(p=>p.contextKey===sync?.context?.key)||null;
 const effective=calibratedPresentation(prefs,active&&sync?.context?.ready?{...active,valid:true}:null);
 const used=presentationTiming(effective.timing);
 const pd=power?.pd||null;
 return <div className="developer-values">
  <div className="developer-values-head"><p>{tr('Read-only. Nothing here changes audio, timing or power.')}</p><button type="button" disabled={offline} onClick={()=>setRound(n=>n+1)}>{tr('Read again')}</button></div>
  {error&&<p role="alert" className="settings-note">{tr(error)}</p>}
  <h4>{tr('Picture & meter sync')}</h4>
  <Facts rows={[
   ['Automatic sync',prefs.syncAutomatic?'On':'Off'],
   ['In use: screen delay',ms(used.screenDelayMs)],
   ['In use: visualizer trim',ms(used.visualizerTrimMs)],
   ['In use: visualizer delay',ms(visualizerDelay(used))],
   ['Source of these values',active&&prefs.syncAutomatic&&sync?.context?.ready?'Measured profile for this output':'Manual settings'],
   ['Manual: screen delay / visualizer trim',`${ms(presentationTiming(prefs.timing).screenDelayMs)} / ${ms(presentationTiming(prefs.timing).visualizerTrimMs)}`],
   ['Reference timing for new TuneBoxes',`${ms(referenceTiming.timing.screenDelayMs)} / ${ms(referenceTiming.timing.visualizerTrimMs)}`],
   ['Saved profiles',String(sync?.profiles?.length??'—')],
   ['Current output ready',sync?.context?sync.context.ready?'Yes':'No':'—'],
  ]}/>
  {active&&<Facts rows={[
   ['Measured',when(active.measuredAt)],
   ['Measured delay',ms(active.delayMs)],
   ['Fine adjustment',ms(active.fineMs)],
   ['Video uses this timing',active.useVideo?'Yes':'No'],
   ['Correlation',Number.isFinite(active.correlation)?active.correlation.toFixed(3):'—'],
   ['Uncertainty',Number.isFinite(active.uncertaintyMs)?`± ${Math.round(active.uncertaintyMs)} ms`:'—'],
   ['Method',active.method||'—'],
   ['Rooms',(active.rooms||[]).join(', ')||active.localName||'—'],
  ]}/>}
  <h4>{tr('USB-C power (PD)')}</h4>
  <Facts rows={[
   ['Contract now',pd?.status==='active'?watts(pd):pd?.status||'Not reported'],
   ['Offered by the supply',pd?.profiles?.length?pd.profiles.map(watts).join(' | '):'—'],
   ['Last response',pd&&Number.isInteger(pd.responseCode)?responses[pd.responseCode]||String(pd.responseCode):'—'],
   ['Measured at the input',power?.ina228?.status==='ok'?`${power.ina228.volts?.toFixed(2)} V · ${Number.isFinite(power.ina228.watts)?power.ina228.watts.toFixed(1)+' W':'—'}`:power?.ina228?.status||'—'],
   ['Highest contract seen on this TuneBox',snapshot.powerHistory?.highestWatts?`${snapshot.powerHistory.highestWatts} W · ${when(snapshot.powerHistory.highestAt)}`:'—'],
   ['All offers limited to 3 A',pd?.profiles?.length?pd.profiles.every(p=>p.amps<=3)?'Yes':'No':'—'],
   ['Verified profile on this TuneBox',manager?.verifiedProfile?watts(manager.verifiedProfile):'None'],
   ['Last power setup',manager?.lastPdRequest||'—'],
   ['Request at startup',manager?.settings?(manager.settings.startup100W?'100 W':manager.settings.startupMaximum20V?'Highest 20 V offer':manager.settings.startup20V?'Verified 20 V profile':'Off'):'—'],
   ['Read at',power?.observedAt?new Date(power.observedAt).toLocaleTimeString():'—'],
  ]}/>
 </div>;
}
