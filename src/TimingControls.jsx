import React from 'react';
import {tr,translateFormat} from '../shared/i18n.js';
import {presentationTiming,visualizerDelay} from '../shared/presentation-timing.js';

export function TimingControls({value,onChange,disabled=false}){
 const timing=presentationTiming(value);
 const change=(key,v)=>onChange(presentationTiming({...timing,[key]:Number(v)}));
 return <fieldset className="timing-controls" disabled={disabled}>
  <legend>{tr('Timing & sync')}</legend>
  <p>{tr('Match the picture and meters to the sound you hear. These controls only delay the screen; your music stays unchanged.')}</p>
  <label>{tr('Screen delay')}<output>{timing.screenDelayMs} ms</output><input aria-label={tr('Screen delay')} type="range" min="0" max="2000" step="10" value={timing.screenDelayMs} onChange={e=>change('screenDelayMs',e.target.value)}/><span><small>{tr('Earlier')}</small><small>{tr('Later')}</small></span></label>
  <label>{tr('Visualizer fine adjustment')}<output>{timing.visualizerTrimMs>0?'+':''}{timing.visualizerTrimMs} ms</output><input aria-label={tr('Visualizer fine adjustment')} type="range" min="-500" max="500" step="10" value={timing.visualizerTrimMs} onChange={e=>change('visualizerTrimMs',e.target.value)}/><span><small>{tr('Earlier')}</small><small>{tr('Later')}</small></span></label>
  <p className="timing-result">{translateFormat('Video: {video} ms · meters: {meters} ms extra delay',{video:timing.screenDelayMs,meters:visualizerDelay(timing)})}</p>
  {timing.screenDelayMs+timing.visualizerTrimMs<0&&<p>{tr('The meters are already showing the newest available audio. They cannot move further ahead.')}</p>}
  <p>{tr('Start with both controls at zero. If the picture and meters arrive before the sound, increase Screen delay. Then fine-tune the meters. A video intro is corrected separately for that track.')}</p>
 </fieldset>;
}
