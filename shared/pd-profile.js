/** The voltage is fixed. Current is chosen only from an actually offered 20 V PDO. */
export const pdRequestAmps=Object.freeze([3,3.25,3.5,4,4.5,5]);
export const validPdAmps=value=>typeof value==='number'&&pdRequestAmps.includes(value);
export function offeredPdProfile(pd){
 if(pd?.status!=='active'||!Array.isArray(pd.profiles))return null;
 const matches=pd.profiles.filter(p=>p.volts===20);
 const p=matches.length===1&&validPdAmps(matches[0].amps)?matches[0]:null;
 return p?{volts:20,amps:p.amps,watts:20*p.amps}:null;
}
export function maximumPdQualified(value){
 return qualifiedPdProfile(value)&&value.strategy==='maximum20v'&&value.sourceCapabilitiesQueried===true;
}
export function qualifiedPdProfile(value){
 return value?.status==='ready'&&value.qualified===true&&value.phase==='ready'&&value.source==='HUSB238'
  &&value.volts===20&&validPdAmps(value.amps)&&value.watts===20*value.amps
  &&typeof value.cable5AVerified==='boolean'&&(value.amps===3||value.cable5AVerified);
}
