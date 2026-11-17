import {createHash} from 'node:crypto';
import {normalizeMusic} from './ma-service.js';
import {roomLeader} from '../shared/multiroom.js';
import {trackGenres} from '../shared/automatic-dsp.js';

/** Automatic voicing follows this amplifier, even while the UI views another room. */
export class LocalAudio {
 constructor(music,multiroom,{onChange=()=>{}}={}){Object.assign(this,{music,multiroom,onChange});this.hint=null;this.cached=null;this.generation=0;this.closed=false;}
 inspect(){
  const m=this.music,rooms=this.multiroom.status(),local=rooms.rooms.find(p=>p.id===rooms.localId),raw=m?.players?.find(p=>p.player_id===rooms.localId),leader=local&&roomLeader(rooms.rooms,local.id);
  return {m,rooms,local,raw,leader,rawLeader:m?.players?.find(p=>p.player_id===leader?.id)};
 }
 get(){
  const {m,local,raw,leader}=this.inspect();
  if(m?.status!=='connected'||!local?.available||!leader?.available)return {available:false,playing:false,trackKey:null,genres:[]};
  const direct=m.playerId===local.id&&m.playback.connected?m.playback.queue?.[0]:null,track=direct||this.cached;
  return {available:true,playing:this.multiroom.localPlayback()===true,localId:local.id,trackKey:track?.mediaKey||null,genres:trackGenres(track?.genres),ready:!!direct||!!this.cached};
 }
 refresh(enabled){
  if(this.closed||!enabled)return;
  const {m,local,raw,leader,rawLeader}=this.inspect();if(!m||m.status!=='connected'||!local?.available||!leader?.available)return;
  const own=raw?.current_media,media=own&&(own.uri||own.title||own.name)?own:rawLeader?.current_media||{},source=raw?.active_source||raw?.synced_to||raw?.active_group||leader.id;
  const hint=createHash('sha256').update(JSON.stringify([local.id,leader.id,source,media.uri||media.title||media.name||null,media.artist||null])).digest('hex');
  if(m.playerId===local.id){this.hint=hint;this.cached=m.playback.connected?m.playback.queue?.[0]:null;this.generation++;return;}
  if(hint===this.hint)return;this.hint=hint;this.cached=null;const generation=++this.generation;
  // One bounded read per changed local track. No extra queue-item poll.
  void m.transport.command('player_queues/all',{}, {maxItems:256}).then(queues=>{
    if(this.closed||generation!==this.generation)return;
    const queue=Array.isArray(queues)?queues.find(q=>q.queue_id===source)||(!raw?.active_source||source===local.id||source===leader.id?queues.find(q=>q.queue_id===leader.id):null):null;
    this.cached=normalizeMusic({player:raw,queue,items:[]}).queue[0];this.onChange();
  }).catch(()=>{if(!this.closed&&generation===this.generation){this.cached={mediaKey:hint,genres:[]};this.onChange();}});
 }
 close(){this.closed=true;this.generation++;}
}
