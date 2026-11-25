import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {atomicJson,readJson} from '../deploy/manager/io.mjs';
import {bootId} from './boot-rooms.js';

/** The amplifier's standby record survives an app/OTA restart. Retain its UI state for
 * that same kernel boot; a cold boot has separate hardware initialization. No gains are stored here. */
export class LocalPauseStore {
 constructor({directory,currentBoot=bootId(),read=readJson,write=atomicJson}){
  Object.assign(this,{directory,currentBoot,write});this.path=join(directory,'local-pause.json');
  const saved=read(this.path,{});this.value=!!currentBoot&&saved?.schema===1&&saved.bootId===currentBoot&&saved.standby===true;
 }
 save(standby){
  if(!this.currentBoot)return false;
  try{mkdirSync(this.directory,{recursive:true,mode:0o700});this.write(this.path,{schema:1,bootId:this.currentBoot,standby:standby===true});this.value=standby===true;return true;}catch{return false;}
 }
}

/** Loss of Music Assistant silences this amplifier once, without sending a room/queue command.
 * Reconnecting never restores the amplifier level automatically. */
export class MusicRecovery {
 constructor({context,pause,onChange=()=>{}}){Object.assign(this,{context,pauseLocal:pause,onChange});this.phase='idle';this.attempted=false;this.pending=null;this.closed=false;}
 status(){return {phase:this.phase};}
 update(){
  if(this.closed)return;
  const c=this.context();
  if(!c.configured||c.status==='connected'){this.attempted=false;if(!this.pending)this.phase='idle';return;}
  if(c.blocked){if(!this.pending)this.phase='unaffected';return;}
  if(c.standby){if(!this.pending)this.phase='paused';return;}
  // An ordinary initial handshake is not a lost connection. Once a failure occurs,
  // automatic reconnect attempts belong to the same outage, not new pause requests.
  if(!this.attempted&&c.status==='disconnected'&&c.failed)void this.pause().catch(()=>{});
 }
 pause(){
  if(this.pending)return this.pending;
  const c=this.context();
  if(this.closed||!c.configured||c.status==='connected'||c.blocked)return Promise.reject(Error('Local pause is not available for the current audio source.'));
  if(c.standby){this.phase='paused';return Promise.resolve();}
  this.attempted=true;this.phase='pausing';this.onChange();
  this.pending=Promise.resolve().then(()=>this.pauseLocal()).then(()=>{this.phase='paused';},()=>{this.phase='failed';throw Error('Automatic local pause failed. Try again.');}).finally(()=>{this.pending=null;if(!this.closed)this.onChange();});
  return this.pending;
 }
 close(){this.closed=true;}
}
