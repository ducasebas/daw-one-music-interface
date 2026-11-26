import {readFileSync} from 'node:fs';
import {uptime} from 'node:os';
export const restartBlocksControls=(value,current)=>!!current&&value?.commit===current&&['countdown','rebooting'].includes(value.phase);
export function updateRestart(path='/var/lib/daw-one-update-status/reboot.json',currentBoot){
 try{const raw=readFileSync(path,'utf8');if(raw.length>4096)return null;const v=JSON.parse(raw);if(v.schema!==1||!/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(v.bootId)||!/^[a-f0-9]{40}$/.test(v.commit)||!['waiting','await-screen','countdown','rebooting','required','complete','cancelled'].includes(v.phase)||typeof v.release!=='string'||v.release.length>100)return null;
  const boot=currentBoot??readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim();
  const limit=v.phase==='waiting'?780:v.phase==='await-screen'?120:60;
  const expired=['waiting','await-screen','countdown','rebooting'].includes(v.phase)&&Number.isFinite(v.updatedUptime)&&uptime()-v.updatedUptime>limit;
  const phase=boot!==v.bootId?'complete':expired?'required':v.phase;
  return {phase,commit:v.commit,release:v.release,...(phase==='countdown'&&Number.isFinite(v.deadlineUptime)?{remainingSeconds:Math.max(0,Math.min(10,Math.ceil(v.deadlineUptime-uptime())))}:{})};
 }catch{return null;}
}
const commit=v=>/^[a-f0-9]{40}$/.test(v)?v:null;
const text=(v,max=100)=>typeof v==='string'?v.slice(0,max):null;
const version=v=>v&&typeof v==='object'?{release:text(v.release),label:text(v.label,80),commit:commit(v.commit),notes:text(v.notes,500)}:null;
const maintenanceLabels=Object.freeze({checking:'Checking system components',unchanged:'System components are already current',tools:'Updating the software updater',progress:'Updating the update screen',browser:'Updating browser settings',display:'Updating display services',network:'Updating system settings',manager:'Updating device services',measurement:'Updating measurement services',complete:'System maintenance complete',interrupted:'System maintenance was interrupted',failed:'System maintenance failed'});
export function publicMaintenance(value){
 if(!value||!Object.hasOwn(maintenanceLabels,value.step)||!['running','complete','failed','interrupted'].includes(value.status))return null;
 return {step:value.step,status:value.status,label:maintenanceLabels[value.step],failedStep:Object.hasOwn(maintenanceLabels,value.failedStep)?value.failedStep:null};
}
const failurePhases=Object.freeze({startup:'startup',checking:'the update check',downloading:'the download',verifying:'verification',preparing:'preparation',installing:'installation',restarting:'restart','checking-health':'the startup check','rolling-back':'recovery','system-maintenance':'system maintenance'});
/** Raw child-process errors may contain private arguments. Derive public copy only from fixed phase codes. */
function publicError(value,maintenance){
 if(value.status!=='error')return null;
 if(maintenance&&['failed','interrupted'].includes(maintenance.status)){
  const label=maintenanceLabels[maintenance.failedStep];
  return label?'System maintenance stopped: '+label+'. The previous app has been kept.':'System maintenance was interrupted. Check the device before trying a system update again.';
 }
 return Object.hasOwn(failurePhases,value.failedPhase)?'The update stopped during '+failurePhases[value.failedPhase]+'. Review the device status before trying again.':null;
}
export function publicUpdateStatus(v={}) {
 const maintenance=publicMaintenance(v.maintenance),error=publicError(v,maintenance);
 return {status:text(v.status,40)||'unknown',channel:['preview','stable'].includes(v.channel)?v.channel:null,commit:commit(v.commit),release:text(v.release),checkedAt:typeof v.checkedAt==='string'&&Number.isFinite(Date.parse(v.checkedAt))?v.checkedAt:null,percent:typeof v.percent==='number'&&Number.isFinite(v.percent)?Math.min(100,Math.max(0,Math.floor(v.percent))):null,downloadedBytes:Number.isSafeInteger(v.downloadedBytes)?Math.max(0,v.downloadedBytes):null,totalBytes:Number.isSafeInteger(v.totalBytes)?Math.max(0,v.totalBytes):null,current:version(v.current),available:version(v.available),startedAt:typeof v.startedAt==='string'&&Number.isFinite(Date.parse(v.startedAt))?v.startedAt:null,typicalSeconds:Number.isInteger(v.typicalSeconds)&&v.typicalSeconds>0&&v.typicalSeconds<7200?v.typicalSeconds:null,...(error?{error}:{}),failedPhase:Object.hasOwn(failurePhases,v.failedPhase)?v.failedPhase:null,maintenance};
}
export function updateStatus(path='/var/lib/daw-one-update-status/status.json'){
 try{const raw=readFileSync(path,'utf8');if(raw.length>4096)throw Error();return {...publicUpdateStatus(JSON.parse(raw)),restart:updateRestart()};}catch{return publicUpdateStatus({status:'not-configured'});}
}
export function deploymentCommit(){try{const v=JSON.parse(readFileSync(new URL('../deployment-ota.json',import.meta.url),'utf8'));return commit(v.commit);}catch{return null;}}
