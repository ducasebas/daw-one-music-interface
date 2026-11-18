import {openSync,fstatSync,readSync,closeSync,constants} from 'node:fs';
/** The reader owns its runtime directory: reject links, pipes and oversized files. */
export function readPowerFile(path='/run/daw-one-power/readings.json'){
 let fd;
 try{
  fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  const stat=fstatSync(fd);if(!stat.isFile()||stat.size>16384)return '';
  const bytes=Buffer.alloc(16385),size=readSync(fd,bytes,0,bytes.length,0);
  return size<=16384?bytes.toString('utf8',0,size):'';
 }catch{return '';}finally{if(fd!==undefined)closeSync(fd);}
}
const finite=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max?value:null;
const fresh=(at,now)=>Number.isFinite(at)&&at<=now+1000&&now-at<7000;
const states=new Set(['disabled','error','needs-setup','ok','active','attached','detached','changing']);
const voltages=new Set([5,9,12,15,18,20]);
const currents=new Set([.5,.7,1,1.25,1.5,1.75,2,2.25,2.5,2.75,3,3.25,3.5,4,4.5,5]);
function profile(value){
 if(!value||!voltages.has(value.volts)||!currents.has(value.amps))return null;
 return {volts:value.volts,amps:value.amps,watts:value.volts*value.amps};
}
function device(value,source,now){
 const status=states.has(value?.status)?value.status:'error';
 const live=fresh(value?.observedAt,now);
 return {status:status==='disabled'?'disabled':live?status:'stale',source,observedAt:live?value.observedAt:null,error:typeof value?.error==='string'&&/^[a-z-]{1,80}$/.test(value.error)?value.error:null};
}
/** Untrusted runtime JSON is reduced to a bounded, timestamped public DTO. */
export function powerTelemetry(value,now=Date.now()){
 if(!value||!fresh(value.observedAt,now))return null;
 if(value.schema===1){
  if(now-value.observedAt>=5000)return null;
  return {observedAt:value.observedAt,watts:finite(value.watts,0,500),volts:finite(value.volts,0,85),amps:finite(value.amps,0,20),contractWatts:finite(value.contractWatts,0,240),source:'External power telemetry',simulated:false};
 }
 if(value.schema!==2)return null;
 const ina228=device(value.ina228,'INA228',now),pd=device(value.pd,'HUSB238',now);
 if(ina228.status==='needs-setup')ina228.missingConfirmations=['current-path','voltage-sense'].filter(key=>Array.isArray(value.ina228.missingConfirmations)&&value.ina228.missingConfirmations.includes(key));
 const v=value.ina228;
 if(ina228.status==='ok'){
  const volts=finite(v.volts,0,85),amps=finite(v.amps,-20,20),watts=volts!==null&&amps!==null?volts*amps:null;
  if(v.source!=='INA228'||v.shuntOhms!==.015||v.calibration!=='nominal-shunt'||volts===null||amps===null||watts< -500||watts>500){ina228.status='error';ina228.error='invalid-measurement';}
  else Object.assign(ina228,{volts,amps,watts,shuntOhms:.015,calibration:'nominal-shunt',dieTemperatureC:finite(v.dieTemperatureC,-40,125)});
 }
 if(pd.status==='active'){
  const contract=value.pd.source==='HUSB238'&&value.pd.attached===true?profile(value.pd):null;
  if(!contract){pd.status='error';pd.error='invalid-contract';}
  else Object.assign(pd,contract);
 }
 if(!['disabled','stale','error'].includes(pd.status)){
  pd.attached=pd.status!=='detached'&&value.pd.attached===true;
  pd.responseCode=[0,1,3,4,5].includes(value.pd.responseCode)?value.pd.responseCode:null;
  pd.selectedVolts=voltages.has(value.pd.selectedVolts)?value.pd.selectedVolts:null;
  const seen=new Set();pd.profiles=(pd.attached&&Array.isArray(value.pd.profiles)?value.pd.profiles:[]).slice(0,6).map(profile).filter(p=>p&&!seen.has(p.volts)&&seen.add(p.volts)).sort((a,b)=>a.volts-b.volts);
  if(!pd.attached)pd.selectedVolts=null;
 }
 const mismatch=ina228.status==='ok'&&pd.status==='active'&&Math.abs(ina228.volts-pd.volts)>Math.max(.75,pd.volts*.1);
 return {observedAt:value.observedAt,source:'INA228 + HUSB238',simulated:false,ina228,pd,voltageMismatch:mismatch,
  watts:ina228.status==='ok'&&!mismatch?ina228.watts:null,volts:ina228.status==='ok'?ina228.volts:null,amps:ina228.status==='ok'?ina228.amps:null,
  contractWatts:pd.status==='active'?pd.watts:null};
}
