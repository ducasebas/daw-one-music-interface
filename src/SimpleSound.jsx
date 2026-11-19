import React from 'react';
import {tr,translateFormat} from '../shared/i18n.js';
import {soundCurve,soundSettings} from '../shared/dsp-settings.js';

/** GUI 3.14 SOUND: the everyday layer over the Louder DSP. Every control says what it does;
 * changes apply on Save through the same headroom-protected, verified path as Advanced. */
export function SimpleSound({controls,sound,onChange,automatic,roomProfile,onRoom}){
 const value=soundSettings(sound);
 let available=true;try{if(controls?.length)soundCurve(controls,value);else available=false;}catch{available=false;}
 if(!available)return <section className="simple-sound" aria-label={tr('Sound')}><p role="status">{tr('Simple sound controls need readable amplifier controls. Use Advanced below, or complete the device update.')}</p></section>;
 const set=patch=>{const next=soundSettings({...value,...patch});onChange(next,soundCurve(controls,next));};
 const slider=(key,label,hint)=><label className="simple-sound-slider"><span><strong>{tr(label)}</strong><output>{value[key]>0?'+':''}{value[key]} dB</output></span><input type="range" min={-6} max={6} step={1} value={value[key]} aria-label={tr(label)} disabled={automatic} onChange={e=>set({[key]:Number(e.target.value)})}/><small>{tr(hint)}</small></label>;
 return <section className="simple-sound" aria-label={tr('Sound')}>
  {automatic&&<p role="status">{tr('Automatic sound is active. Switch it to manual to use these controls.')}</p>}
  <div className="simple-sound-presets" role="radiogroup" aria-label={tr('Sound preset')}>
   {[['flat','Flat','Neutral: the music as recorded.'],['warm','Warm','Slightly softer highs for long listening.'],['soft','Soft','Everything a little quieter and gentler.']].map(([id,name,hint])=><button key={id} role="radio" aria-checked={value.preset===id} disabled={automatic} onClick={()=>set({preset:id})}><strong>{tr(name)}</strong><span>{tr(hint)}</span></button>)}
  </div>
  {slider('bass','Bass','More or less low end (below 250 Hz).')}
  {slider('treble','Treble','More or less sparkle and detail (above 4 kHz).')}
  <label className="hub-check simple-sound-check"><input type="checkbox" checked={value.loudness} disabled={automatic} onChange={e=>set({loudness:e.target.checked})}/><span><strong>{tr('Loudness')}</strong><small>{tr('Adds a little bass and air so quiet listening still sounds full.')}</small></span></label>
  <div className="simple-sound-room"><span><strong>{tr('Room correction')}</strong><small>{tr(roomProfile?'A room profile exists. Measure again or undo it under Room measurement.':'Off. Measure your room once to correct its strongest resonances.')}</small></span><button onClick={onRoom}>{tr('Room measurement')}</button></div>
  <p className="simple-sound-safety">{translateFormat('Changes apply when you save. Positive boosts automatically reserve headroom, and every change can be undone with Cancel or Restore defaults.',{})}</p>
 </section>;
}
