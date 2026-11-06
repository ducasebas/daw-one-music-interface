import {readFileSync} from 'node:fs';
/** Validate each real measurement independently; stale or bad data is never zero. */
export function sensorTelemetry(data, now=Date.now()) {
 const timestamp=data?.observedAt;
 const fresh=data?.schema===1&&Number.isFinite(timestamp)&&timestamp<=now+1000&&now-timestamp<=15000;
 const metric=(key,unit,min,max)=>{
  const m=data?.[key];
  const ok=fresh&&m?.status==='ok'&&Number.isFinite(m.value)&&m.value>=min&&m.value<=max;
  return {status:ok?'ok':!fresh?'stale':'error',value:ok?m.value:null,unit,source:key==='temperatureC'?'PCT2075 · I2C 1 / 0x37':'TSL2591 · I2C 1 / 0x29',simulated:false,observedAt:fresh?timestamp:null};
 };
 return {enabled:true,temperature:metric('temperatureC','°C',-55,125),light:metric('lux','lux',0,10000000),amplifierVerified:false};
}
export function readSensorTelemetry(path,now=Date.now()) {
 if(!path)return {enabled:false,amplifierVerified:false};
 try {const raw=readFileSync(path,'utf8');if(raw.length>4096)throw Error();return sensorTelemetry(JSON.parse(raw),now);}
 catch {return {enabled:true,temperature:{status:'unavailable',value:null,unit:'°C',simulated:false},light:{status:'unavailable',value:null,unit:'lux',simulated:false},amplifierVerified:false};}
}
