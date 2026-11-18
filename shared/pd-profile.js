/** The voltage is fixed. Current is chosen only from an actually offered 20 V PDO. */
export const pdRequestAmps=Object.freeze([3,3.25,3.5,4,4.5,5]);
export const validPdAmps=value=>typeof value==='number'&&pdRequestAmps.includes(value);
export function offeredPdProfile(pd){
 if(pd?.status!=='active'||pd.volts!==20||!Array.isArray(pd.profiles))return null;
 const p=pd.profiles.find(p=>p.volts===20&&validPdAmps(p.amps));
 return p?{volts:20,amps:p.amps,watts:20*p.amps}:null;
}
export function qualifiedPdProfile(value){
 return value?.status==='ready'&&value.qualified===true&&value.phase==='ready'&&value.source==='HUSB238'
  &&value.volts===20&&validPdAmps(value.amps)&&value.watts===20*value.amps
  &&typeof value.cable5AVerified==='boolean'&&(value.amps===3||value.cable5AVerified);
}
