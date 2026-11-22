/**
 * Crossfade lives in Music Assistant's player settings. Versions differ: older ones have a `crossfade` switch,
 * newer ones `smart_fades_mode`; both use `crossfade_duration` (whole or decimal seconds within a range).
 * TuneBox only offers what the connected Music Assistant reports, and never changes it unasked.
 */
export const crossfadeDefaultSeconds=1.2;
const entries=config=>{const v=config?.values;if(Array.isArray(v))return Object.fromEntries(v.filter(e=>e?.key).map(e=>[e.key,e]));return v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,e])=>[k,{key:k,...(e&&typeof e==='object'?e:{value:e})}])):{};};
const current=e=>e?.value!==undefined&&e?.value!==null?e.value:e?.default_value;
export function crossfadeState(config){
 const all=entries(config),mode=all.smart_fades_mode,toggle=all.crossfade,duration=all.crossfade_duration;
 if(!duration||!(mode||toggle))return {supported:false};
 const range=Array.isArray(duration.range)&&duration.range.length===2&&duration.range.every(Number.isFinite)?duration.range:[1,10];
 const decimal=duration.type==='float';
 const seconds=Number(current(duration));
 return {supported:true,kind:mode?'smart-fades':'switch',enabled:mode?String(current(mode))!=='disabled':current(toggle)===true,seconds:Number.isFinite(seconds)?seconds:null,min:range[0],max:range[1],step:decimal?0.1:1};
}
/** The values to save for a request, clamped to what Music Assistant accepts. */
export function crossfadeValues(state,{enabled,seconds}){
 if(!state?.supported)throw Error('Crossfade is not available for this player');
 if(typeof enabled!=='boolean')throw Error('Choose crossfade on or off');
 const wanted=Number.isFinite(seconds)?seconds:crossfadeDefaultSeconds;
 const rounded=state.step===1?Math.round(wanted):Math.round(wanted*10)/10;
 const value=Math.min(state.max,Math.max(state.min,rounded));
 return state.kind==='smart-fades'?{smart_fades_mode:enabled?'standard_crossfade':'disabled',...(enabled?{crossfade_duration:value}:{})}:{crossfade:enabled,...(enabled?{crossfade_duration:value}:{})};
}
