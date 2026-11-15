import React from 'react';
import {tr} from '../shared/i18n.js';
import {speakerSettings,speakerRecommendation} from '../shared/speaker-settings.js';
import {KeyboardField} from './TouchKeyboard.jsx';

export function SpeakerSettings({value,onChange,ceiling,onCeiling}){
 const settings=speakerSettings(value),change=(key,next)=>onChange({...settings,[key]:next});
 return <section className="speaker-settings"><h3>{tr('Speakers')}</h3><p>{tr('Speaker details are optional. You can fill them in later.')}</p><div className="hub-fields">
  <label>{tr('Nominal impedance')}<select aria-label={tr('Nominal impedance')} value={settings.impedanceOhms??''} onChange={event=>change('impedanceOhms',event.target.value===''?null:Number(event.target.value))}><option value="">{tr('Unknown / skip')}</option>{[4,6,8,16].map(ohms=><option key={ohms} value={ohms}>{ohms} Ω</option>)}</select></label>
  <KeyboardField label="Speaker RMS power (W per channel)" numeric value={settings.rmsWatts===null?'':String(settings.rmsWatts)} maxLength={4} onChange={raw=>{const number=Number(raw);if(raw==='')change('rmsWatts',null);else if(Number.isFinite(number)&&number>=1&&number<=1000)change('rmsWatts',number);}}/>
  <label>{tr('Volume sensitivity')}<select aria-label={tr('Volume sensitivity')} value={settings.sensitivity} onChange={event=>change('sensitivity',event.target.value)}><option value="gentle">{tr('Gentle')}</option><option value="normal">{tr('Normal')}</option></select></label>
  <label>{tr('Starting sound')}<select aria-label={tr('Starting sound')} value={settings.voicing} onChange={event=>change('voicing',event.target.value)}><option value="warm">{tr('Warm')}</option><option value="flat">{tr('Flat')}</option><option value="keep">{tr('Keep current DSP')}</option></select></label>
  <label>{tr('Speaker volume ceiling')}<input aria-label={tr('Speaker volume ceiling')} type="range" min="1" max="100" step="1" value={ceiling} onChange={event=>onCeiling(Number(event.target.value))}/><output>{ceiling}%</output></label>
  <button onClick={()=>{const advice=speakerRecommendation(settings);onChange({...settings,sensitivity:advice.sensitivity});onCeiling(Math.min(ceiling,advice.ceiling));}}>{tr('Use conservative controls')}</button>
 </div><p>{tr('Speaker ratings guide the controls. A digital volume ceiling is not a calibrated watt limiter.')}</p><p>{tr('The warm starting curve only reduces upper frequencies. Existing custom EQ is kept unless you explicitly choose a preset.')}</p></section>;
}
