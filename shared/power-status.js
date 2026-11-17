/** Capacity is a PD readback; it is never inferred from measured consumption. */
export const powerLifetime=power=>power?.source==='External power telemetry'?5000:7000;
export const powerIsFresh=(power,now=Date.now())=>!!power&&Number.isFinite(power.observedAt)&&now-power.observedAt<powerLifetime(power)&&power.observedAt<=now+1000;
export function powerStatus(power,requiredWatts=100,now=Date.now()){
 const required=Number.isInteger(requiredWatts)&&requiredWatts>=15&&requiredWatts<=240?requiredWatts:100;
 if(!powerIsFresh(power,now))return {severity:'unknown',reason:'unavailable',title:'Power readings unavailable',required};
 if(power.voltageMismatch)return {severity:'warning',reason:'voltage-mismatch',title:'Check voltage sense wiring',required};
 if(Number.isFinite(power.amps)&&power.amps<-.02)return {severity:'warning',reason:'reverse-current',title:'Check current sensor direction',required};
 const capacity=power.contractWatts;
 if(Number.isFinite(capacity)&&capacity>=0)return {severity:capacity<required?'warning':'ok',reason:capacity<required?'capacity-low':'capacity-ok',title:capacity<required?'Power supply below requirement':'PD capacity meets requirement',required,capacity};
 return {severity:'unknown',reason:'no-contract',title:'PD contract unavailable',required};
}
