/**
 * After a reboot (not an app restart) TuneBox leaves any multiroom group and controls its own player again, for
 * stability. The owner then sees a notice and can group the rooms again by hand. Runs once per boot.
 */
import {readFileSync} from 'node:fs';
import {atomicJson,readJson} from '../deploy/manager/io.mjs';
import {join} from 'node:path';
export const bootId=()=>{try{return readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim();}catch{return null;}};
export class BootRooms{
 constructor({multiroom,directory,currentBoot=bootId(),now=Date.now,read=readJson,write=atomicJson,waitMs=180000}){
  Object.assign(this,{multiroom,now,read,write,waitMs});this.path=join(directory,'rooms-boot.json');this.currentBoot=currentBoot;
  const saved=read(this.path,{});this.state=saved&&typeof saved==='object'?saved:{};this.running=false;this.startedAt=now();
 }
 /** A notice for this boot when TuneBox left a group by itself. */
 notice(){return this.state.bootId===this.currentBoot&&this.state.changed===true?{at:this.state.at,left:this.state.left||[]}:null;}
 pending(){return !!this.currentBoot&&this.state.bootId!==this.currentBoot;}
 /** Call when Music Assistant data changes; acts once when the local player is visible. */
 async check(){
  if(!this.pending()||this.running)return null;
  const status=this.multiroom.status();
  if(!status.connected){if(this.now()-this.startedAt>this.waitMs)this.finish({changed:false,skipped:'not-connected'});return null;}
  const local=status.rooms.find(r=>r.id===status.localId);
  if(!local?.available){if(this.now()-this.startedAt>this.waitMs)this.finish({changed:false,skipped:'player-missing'});return null;}
  if(!status.controlEnabled)return this.finish({changed:false,skipped:'read-only'});
  this.running=true;const left=[];
  try{
   let state=status;
   if(local.parentId){await this.multiroom.act({action:'leave',playerId:local.id,revision:state.revision,confirmed:true});left.push('group');state=await this.multiroom.read();}
   const me=state.rooms.find(r=>r.id===state.localId);
   const dynamic=(me?.members||[]).filter(id=>!(me.staticMembers||[]).includes(id));
   if(me&&!me.parentId&&dynamic.length&&me.canGroup){await this.multiroom.act({action:'group',playerId:me.id,revision:state.revision,members:me.members.filter(id=>!dynamic.includes(id)),confirmed:true});left.push('members');state=await this.multiroom.read();}
   if(state.selectedId!==state.localId){await this.multiroom.act({action:'select',playerId:state.localId,revision:state.revision});left.push('select');}
   return this.finish({changed:left.some(x=>x!=='select'),left});
  }catch(error){return this.finish({changed:false,error:String(error?.message||error).slice(0,160)});}
  finally{this.running=false;}
 }
 finish(result){this.state={bootId:this.currentBoot,at:new Date(this.now()).toISOString(),...result};try{this.write(this.path,this.state);}catch{}return this.state;}
}
