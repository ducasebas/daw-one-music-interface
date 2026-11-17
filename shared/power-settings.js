/** Reader configuration only; this protocol never selects a PD voltage. */
export const powerDefaults=Object.freeze({ina228:false,husb238:false,currentPathVerified:false,voltageSenseVerified:false});
export function powerSettings(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!Object.hasOwn(powerDefaults,k)))throw Error('Invalid power monitoring settings');
 const settings={...powerDefaults,...input};
 if(Object.values(settings).some(v=>typeof v!=='boolean'))throw Error('Invalid power monitoring settings');
 return settings;
}
