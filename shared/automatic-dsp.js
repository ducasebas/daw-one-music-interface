import {dspBandFrequency,dspSwitchValues} from './dsp-settings.js';

export const automaticDspProfiles=Object.freeze({neutral:'Reference',warm:'Warm',bass:'Bass focus',vocal:'Vocal clarity'});
export const automaticDspDefaults=()=>({enabled:false,mode:'genre',fallback:'warm',strength:.7});
export function automaticDspSettings(input={}){
  const d=automaticDspDefaults();
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!Object.hasOwn(d,k)))throw Error('Invalid automatic sound settings');
  const s={...d,...input};
  if(typeof s.enabled!=='boolean'||!['genre','fixed'].includes(s.mode)||!Object.hasOwn(automaticDspProfiles,s.fallback)||!Number.isFinite(s.strength)||s.strength<0||s.strength>1)throw Error('Automatic sound is outside its supported range');
  return s;
}
export function trackGenres(value){
  return [...new Set((Array.isArray(value)?value:[]).filter(g=>typeof g==='string').map(g=>g.replace(/[\x00-\x1f\x7f]/g,'').trim().slice(0,60)).filter(Boolean))].slice(0,16);
}
export function automaticDspChoice(settings,genres=[]){
  const s=automaticDspSettings(settings),tags=trackGenres(genres),text=tags.join(' ').toLowerCase();
  if(s.mode==='fixed')return {profile:s.fallback,reason:'Fixed listening preference',genres:tags};
  const votes={bass:0,vocal:0,warm:0,neutral:0};
  for(const tag of tags){
    if(/hip.?hop|electronic|dance|techno|house|drum|dub|rap|r&b/i.test(tag))votes.bass++;
    if(/vocal|acoustic|singer|folk|spoken|podcast/i.test(tag))votes.vocal++;
    if(/ambient|jazz|chill|lounge|soul/i.test(tag))votes.warm++;
    if(/classical|orchestral|chamber/i.test(tag))votes.neutral++;
  }
  const ranked=Object.entries(votes).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
  const definite=ranked.length&&(!ranked[1]||ranked[0][1]>ranked[1][1]);
  return {profile:definite?ranked[0][0]:s.fallback,reason:definite?'Current track genre':'No clear genre: using your fallback',genres:tags};
}
/** Relative voicing only: at most 3 dB attenuation, never positive boost. */
export function voicingCut(hz,profile,strength=1){
  if(!Number.isFinite(hz)||hz<20||hz>24000||!Object.hasOwn(automaticDspProfiles,profile)||!Number.isFinite(strength)||strength<0||strength>1)throw Error('Invalid voicing band');
  const db=profile==='neutral'?0:profile==='warm'?(hz<250?0:hz<1000?-1:hz<4000?-2:-3):profile==='bass'?(hz<180?0:hz<1000?-2:-3):(hz<300?-3:hz>6000?-2:0);
  return Math.round(db*strength);
}
export function dspEqSnapshot(controls){
  if(!Array.isArray(controls))throw Error('Read the Louder equalizer first');
  const eq=controls.find(c=>c.name==='Equalizer'),state=dspSwitchValues(eq),bands=controls.filter(c=>dspBandFrequency(c)!==null);
  if(!state||bands.length!==15||new Set(bands.map(c=>c.id)).size!==15||bands.some(c=>!Number.isInteger(c.id)||!Number.isInteger(c.value)||c.value<c.min||c.value>c.max))throw Error('A complete supported Louder equalizer is required');
  return [...bands,eq].map(c=>({id:c.id,name:c.name,value:c.value}));
}
export function sameDspEq(controls,saved){
  try{const actual=dspEqSnapshot(controls);return Array.isArray(saved)&&actual.length===saved.length&&actual.every(c=>saved.some(v=>v.id===c.id&&v.name===c.name&&v.value===c.value));}catch{return false;}
}
export function effectiveDspBaseline(controls){
  const values=dspEqSnapshot(controls),eq=controls.find(c=>c.name==='Equalizer'),on=dspSwitchValues(eq).on;
  return values.map(c=>({...c,value:c.name==='Equalizer'?on:eq.value===on?c.value:0}));
}
export function automaticDspProposal(controls,baseline,settings,genres=[]){
  const config=automaticDspSettings(settings),choice=automaticDspChoice(config,genres);dspEqSnapshot(controls);
  if(!Array.isArray(baseline)||baseline.length!==16)throw Error('Saved sound baseline is unavailable');
  const changes=baseline.map(saved=>{
    const c=controls.find(c=>c.id===saved.id&&c.name===saved.name);
    if(!c||!Number.isInteger(saved.value)||saved.value<c.min||saved.value>c.max)throw Error('The amplifier control layout changed');
    const hz=dspBandFrequency(c),value=hz===null?dspSwitchValues(c).on:Math.max(c.min,Math.min(c.max,saved.value+voicingCut(hz,choice.profile,config.strength)));
    return {id:c.id,value};
  });
  return {...choice,changes};
}
/** One integer dB per frame. Attenuations are written before increases. */
export function dspRamp(controls,changes){
  let current=controls.map(c=>({...c}));const frames=[];
  for(let step=0;step<4;step++){
    const next=changes.map(t=>{const c=current.find(c=>c.id===t.id);if(!c)throw Error('Unknown DSP control');return {id:c.id,value:c.name==='Equalizer'?t.value:c.value+Math.sign(t.value-c.value)};}).filter(t=>current.find(c=>c.id===t.id).value!==t.value).sort((a,b)=>(a.value-current.find(c=>c.id===a.id).value)-(b.value-current.find(c=>c.id===b.id).value));
    if(!next.length)return frames;
    frames.push(next);current=current.map(c=>({...c,value:next.find(t=>t.id===c.id)?.value??c.value}));
  }
  if(changes.some(t=>current.find(c=>c.id===t.id)?.value!==t.value))throw Error('Automatic voicing exceeds the bounded ramp');
  return frames;
}
