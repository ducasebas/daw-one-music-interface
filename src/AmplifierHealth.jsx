import React,{useEffect,useState} from 'react';
import {useDeviceUpdates} from './DeviceUpdates.jsx';
import {amplifierHealth} from '../shared/amplifier-health.js';
import {tr} from '../shared/i18n.js';
const stateText={ok:'OK',fault:'Fault',idle:'No audio clock — normal while nothing plays',unknown:'Not reported by this driver'};
/** Louder HAT health: every protection the amplifier reports, read live from its ALSA flags. */
export function AmplifierHealth({faults,offline=false,compact=false}){
 const device=useDeviceUpdates(),[value,setValue]=useState(faults?{supported:true,faults}:null),[error,setError]=useState('');
 async function read(){setError('');try{setValue(await device.action('dsp'));}catch(e){setError(e.message);}}
 useEffect(()=>{if(faults){setValue({supported:true,faults});return;}if(!offline)read();},[faults,offline]);
 const health=amplifierHealth(value?.faults);
 if(compact)return value?.supported&&health.known?<p className="amp-summary" data-state={health.blocking?'fault':'ok'} role={health.blocking?'alert':'status'}>{tr(health.blocking?'Amplifier protection active: check the hardware overview in Developer → Hardware.':'Amplifier checks: all OK.')}</p>:null;
 return <section className="amp-health" aria-label={tr('Louder HAT health')}>
  <h3>{tr('Louder HAT health')}</h3>
  {error?<p role="alert">{tr(error)}</p>:!value?<p role="status">{tr('Reading amplifier controls…')}</p>:!value.supported?<p>{tr('Louder ALSA controls are unavailable. Connect and configure the HAT to enable DSP controls.')}</p>:!health.known?<p>{tr('This driver reports no fault flags.')}</p>:<>
   <ul className="amp-checks">{health.checks.map(c=><li key={c.id} data-state={c.state}><strong>{tr(c.label)}</strong><span>{tr(stateText[c.state])}</span>{c.active.length>0&&c.state==='fault'&&<small>{c.active.join(', ')}</small>}</li>)}</ul>
   <p>{tr(health.blocking?'A real fault blocks measurements, Bluetooth volume increases and automatic sound until it clears. Turn the volume down, check the speaker wiring and the power supply.':'Measurements, Bluetooth and automatic sound may use the amplifier.')}</p>
  </>}
  <button disabled={offline||device.pending} onClick={read}>{tr('Check again')}</button>
 </section>;
}
