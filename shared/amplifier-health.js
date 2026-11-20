/** Louder HAT (TAS5825M) fault flags grouped into plain checks. "Fault Clock" means no audio clock: normal while nothing plays. */
const groups=[
 ['overcurrent','Overcurrent protection',/\bOC\b|Overcurrent|CBC/i],
 ['dc','DC on the speaker outputs',/\bDC\b/],
 ['temperature','Temperature',/Temperature|Thermal|\bOT\b/i],
 ['supply','Supply voltage (PVDD)',/PVDD|voltage/i],
 ['clock','Audio clock',/Clock/i],
 ['memory','DSP memory and boot',/BQ|EEPROM|OTP|CRC|DSP\/Memory|Memory/i],
];
export function amplifierHealth(faults){
 if(!Array.isArray(faults))return {known:false,checks:[],blocking:0};
 const checks=groups.map(([id,label,pattern])=>{const flags=faults.filter(f=>pattern.test(String(f?.name)));const active=flags.filter(f=>f.active).map(f=>f.name);
  return {id,label,flags:flags.length,active,state:!flags.length?'unknown':!active.length?'ok':id==='clock'?'idle':'fault'};});
 return {known:faults.length>0,checks,blocking:checks.filter(c=>c.state==='fault').length};
}
