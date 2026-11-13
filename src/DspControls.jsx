import React from 'react';
import {tr} from '../shared/i18n.js';
import {dspSwitchValues,dspPreset,dspControlLabel,dspBandFrequency} from '../shared/dsp-settings.js';
export function DspControls({controls,onChange}){
 const equalizer=controls.find(c=>c.name==='Equalizer'),state=dspSwitchValues(equalizer);
 const set=(id,value)=>onChange(controls.map(c=>c.id===id?{...c,value}:c));
 return <section className="dsp-surface" aria-label={tr('Louder HAT DSP controls')}>
  {equalizer&&<div className="dsp-switch"><label className="hub-check"><input aria-label={tr('Equalizer')} type="checkbox" checked={!!state&&equalizer.value===state.on} disabled={!state} onChange={e=>set(equalizer.id,e.target.checked?state.on:state.off)}/>{tr('Equalizer')}</label><output aria-label={tr('Equalizer state')}>{tr(!state?'Unavailable':equalizer.value===state.on?'On':'Off')}</output></div>}
  {equalizer&&!state&&<p role="status">{tr('Equalizer labels are unavailable. Complete the device update to use DSP presets.')}</p>}
  {!equalizer&&<p>{tr('This driver does not expose an equalizer switch.')}</p>}
  <div className="dsp-presets"><button disabled={!state} onClick={()=>onChange(dspPreset(controls,'flat'))}>{tr('Flat')}</button><button disabled={!state} onClick={()=>onChange(dspPreset(controls,'soft'))}>{tr('Soft')}</button></div>
  <p>{tr('On enables the equalizer. Flat keeps all bands at 0 dB. Changes take effect when you save.')}</p>
  <div className="dsp-controls">{controls.filter(c=>c.name!=='Equalizer').map(c=><label key={c.id}><span>{tr(dspControlLabel(c))}</span><output>{c.value>0?'+':''}{c.value} dB</output><input aria-label={(dspBandFrequency(c)!==null?'EQ ':'')+tr(dspControlLabel(c))} type="range" min={c.min} max={c.max} step={1} value={c.value} onChange={e=>set(c.id,Number(e.target.value))}/></label>)}</div>
 </section>;
}
