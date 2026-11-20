import React from 'react';
import {tr} from '../shared/i18n.js';
import {DspControls} from './DspControls.jsx';
import {Icon} from './Icon.jsx';
import {AmplifierHealth} from './AmplifierHealth.jsx';

export function LouderDsp({value,controls,onChange,loading,error,offline,waiting,onRetry,dirty,pending,automatic=false}){
 return <section className="louder-dsp" aria-label={tr('Amplifier controls')} aria-busy={!offline&&(loading||waiting)}>
  <div className="louder-dsp-heading"><h3>{tr('Louder HAT DSP')}</h3><button aria-label={tr('Refresh amplifier controls')} disabled={offline||waiting||loading||dirty||pending} onClick={onRetry}><Icon name="update"/>{tr('Refresh')}</button></div>
  {offline?<p role="status">{tr('Reconnect to read amplifier controls.')}</p>:waiting||loading?<p className="dsp-reading" role="status"><Icon name="update"/>{tr(waiting?'Connecting to the device manager…':'Reading amplifier controls…')}</p>:error?<p role="alert">{tr(error)}</p>:!value?.supported?<p>{tr('Louder ALSA controls are unavailable. Connect and configure the HAT to enable DSP controls.')}</p>:<>
   <p>{tr('Changes apply through ALSA when you save. Positive EQ gains automatically reserve digital headroom. Playback routing and electrical modes are unchanged.')}</p>
   {automatic&&<p>{tr('Automatic sound is active. Switch to manual sound before editing the reference EQ.')}</p>}<fieldset disabled={automatic} className="dsp-auto-guard"><DspControls controls={controls||[]} onChange={onChange}/></fieldset>
   {value.faults?.filter(f=>f.active&&f.name!=='Fault Clock').map(f=><p role="alert" key={f.name}>{tr(f.name)}</p>)}<AmplifierHealth faults={value.faults} compact/>
  </>}
 </section>;
}
