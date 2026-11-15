export const speakerDefaults=()=>({impedanceOhms:null,rmsWatts:null,sensitivity:'normal',voicing:'warm'});
export function speakerSettings(value={}){
 const defaults=speakerDefaults();
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!Object.hasOwn(defaults,key)))throw Error('Invalid speaker settings');
 const result={...defaults,...value};
 if(result.impedanceOhms!==null&&![4,6,8,16].includes(result.impedanceOhms)||result.rmsWatts!==null&&(!Number.isFinite(result.rmsWatts)||result.rmsWatts<1||result.rmsWatts>1000)||!['gentle','normal'].includes(result.sensitivity)||!['warm','flat','keep'].includes(result.voicing))throw Error('Enter optional speaker impedance and RMS power within the supported range');
 return result;
}
/** Interaction guidance only. Digital percent is not a calibrated watt limit. */
export function speakerRecommendation(value){
 const settings=speakerSettings(value);
 return {sensitivity:settings.rmsWatts===null||settings.rmsWatts<=30||settings.impedanceOhms===4?'gentle':'normal',ceiling:40};
}
