const bandPattern=/^(?:EQ )?(\d{5})(?: Hz)?$/;
export function dspBandFrequency(control){const match=control?.name?.match(bandPattern);return match?Number(match[1]):null;}
/** Enum order belongs to the ALSA driver; never assume that 1 means On. */
export function dspSwitchValues(control){
 if(control?.type==='BOOLEAN')return {on:1,off:0};
 if(control?.type!=='ENUMERATED'||!Array.isArray(control.options))return null;
 const find=label=>control.options.find(o=>String(o.label).trim().toLowerCase()===label&&Number.isInteger(o.value)&&o.value>=control.min&&o.value<=control.max)?.value;
 const on=find('on'),off=find('off');return on!==undefined&&off!==undefined&&on!==off?{on,off}:null;
}
const clamp=(control,value)=>Math.max(control.min,Math.min(control.max,value));
export function dspPreset(controls,preset){
 if(!['flat','soft','warm'].includes(preset))throw Error('Unknown DSP preset');
 const equalizer=controls.find(c=>c.name==='Equalizer'),state=dspSwitchValues(equalizer);
 if(!state)throw Error('Equalizer labels are unavailable. Complete the device update to use DSP presets.');
 const warm=hz=>hz<250?0:hz<1000?-1:hz<4000?-2:-3;
 return controls.map(c=>({...c,value:c===equalizer?state.on:dspBandFrequency(c)!==null?clamp(c,preset==='soft'?-3:preset==='warm'?warm(dspBandFrequency(c)):0):preset==='flat'&&/^Channel (Left|Right) Gain$/.test(c.name)?clamp(c,0):c.value}));
}
/** Warm defaults without gain boost; preserve unknown enum metadata. */
export function resetDspControls(controls){
 if(dspSwitchValues(controls.find(c=>c.name==='Equalizer')))return dspPreset(controls,'warm').map(c=>({...c,value:/^Channel (Left|Right) Gain$/.test(c.name)?clamp(c,0):c.value}));
 return controls.map(c=>({...c,value:c.name==='Equalizer'?(dspSwitchValues(c)?.on??c.value):dspBandFrequency(c)!==null||/^Channel (Left|Right) Gain$/.test(c.name)?clamp(c,0):c.value}));
}
/** First setup may initialize a neutral EQ, but never replace a custom curve. */
export function startingDspControls(controls,choice='warm'){
 if(choice==='keep'||controls.some(c=>dspBandFrequency(c)!==null&&c.value!==0))return controls;
 return dspPreset(controls,choice);
}
export function dspControlLabel(control){const hz=dspBandFrequency(control);return hz===null?control.name:hz>=1000?`${Number((hz/1000).toFixed(2))} kHz`:`${hz} Hz`;}
