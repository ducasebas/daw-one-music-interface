import {createHash,verify} from 'node:crypto';
export const repository='ducasebas/daw-one-music-interface';
export function verifyManifest(raw,signature,key,channel,lastSequence=0){
 if(raw.length>8192||!verify(null,raw,key,signature))throw Error('Invalid OTA signature');
 const m=JSON.parse(raw.toString('utf8'));
 if(m.schema!==1||m.repository!==repository||m.channel!==channel||!['preview','stable'].includes(channel)||!Number.isSafeInteger(m.sequence)||m.sequence<=lastSequence||!/^[a-f0-9]{40}$/.test(m.commit)||!/^[a-f0-9]{64}$/.test(m.sha256)||typeof m.release!=='string'||!m.release||m.release.length>100||(m.notes!==undefined&&(typeof m.notes!=='string'||m.notes.length>500))||!Number.isInteger(m.bytes)||m.bytes<1||m.bytes>33554432)throw Error('Invalid, replayed or incompatible OTA manifest');
 return m;
}
export function verifyArchive(bytes,m){if(bytes.length!==m.bytes||createHash('sha256').update(bytes).digest('hex')!==m.sha256)throw Error('OTA archive integrity failed');}
export function canUpdate(state){
 if(state?.activity?.roomMeasurement===true||state?.activity?.roomControl===true||state?.activity?.localPlayback===true||state?.activity?.localPlayback===null)return false;
 if(!state||!['simulation','music-assistant'].includes(state.mode)||!['ready','standby'].includes(state.device?.mode)||state.device.amplifierEnabled!==false||!Array.isArray(state.device.faults)||state.device.faults.length||state.playback?.playing!==false)return false;
 return state.mode==='simulation'||(state.musicAssistant?.connected===true&&state.playback.connected===true);
}
/** App activation is journalled before switching. Opted-in appliance maintenance is a separate, signed host step. */
export async function activate(host,m,progress=()=>{}){
 const previous=await host.current();await host.journal({previous,candidate:m.commit});
 try{
  await progress('installing');await host.stop();await host.select(m.commit);
  await progress('restarting');await host.start();await progress('checking-health');
  if(!await host.healthy(m))throw Error('Candidate unhealthy');
  await host.commit(m);await host.clearJournal();return 'installed';
 }catch(error){
  await progress('rolling-back');await host.stop();await host.select(previous);await host.start();
  const recovered=await host.healthy(null);
  if(!recovered)throw Error('Rollback selected but previous app is unhealthy; manual recovery required');
  await host.clearJournal();throw Error('Update failed; previous application restored');
 }
}
export async function restorePrevious(host,previous,progress=()=>{}){
 const current=await host.current();await host.journal({previous:current,candidate:previous});
 try{
  await progress('rolling-back');await host.stop();await host.select(previous);await host.start();
  if(!await host.healthy(null))throw Error('Previous version unhealthy');
  await host.commitRollback(current,previous);await host.clearJournal();return 'rolled-back';
 }catch(error){
  await host.stop();await host.select(current);await host.start();
  if(!await host.healthy(null))throw Error('Recovery requires manual repair');
  await host.clearJournal();throw Error('Rollback failed; current application restored');
 }
}
/** Keep current, previous, and two recent spare slots; ignore unfamiliar names. */
export function prunableSlots(entries,current,previous){
 const spare=entries.filter(e=>/^(?:[a-f0-9]{40}|legacy-[0-9]+)$/.test(e.name)&&e.name!==current&&e.name!==previous).sort((a,b)=>b.modified-a.modified);
 return spare.slice(2).map(e=>e.name);
}
