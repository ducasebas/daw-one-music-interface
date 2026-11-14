import React from 'react';
import {tr} from '../shared/i18n.js';
import {DspControls} from './DspControls.jsx';
import {Icon} from './Icon.jsx';

export function LouderDsp({value,controls,onChange,loading,error,offline,waiting,onRetry,dirty,pending}){
 return <section className="louder-dsp" aria-label={tr('Amplifier controls')} aria-busy={!offline&&(loading||waiting)}>
  <div className="louder-dsp-heading"><h3>{tr('Louder HAT DSP')}</h3><button aria-label={tr('Refresh amplifier controls')} disabled={offline||waiting||loading||dirty||pending} onClick={onRetry}><Icon name="update"/>{tr('Refresh')}</button></div>
  {offline?<p role="status">{tr('Reconnect to read amplifier controls.')}</p>:waiting||loading?<p className="dsp-reading" role="status"><Icon name="update"/>{tr(waiting?'Connecting to the device manager…':'Reading amplifier controls…')}</p>:error?<p role="alert">{tr(error)}</p>:!value?.supported?<p>{tr('Louder ALSA controls are unavailable. Connect and configure the HAT to enable DSP controls.')}</p>:<>
   <p>{tr('Changes apply through ALSA when you save. Positive EQ gains automatically reserve digital headroom. Playback routing and electrical modes are unchanged.')}</p>
   <DspControls controls={controls||[]} onChange={onChange}/>
   {value.faults?.filter(f=>f.active).map(f=><p role="alert" key={f.name}>{tr(f.name)}</p>)}
  </>}
 </section>;
}
