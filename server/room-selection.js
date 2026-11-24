import {createHash} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {atomicJson,readJson} from '../deploy/manager/io.mjs';
import {bootId} from './boot-rooms.js';

const playerId=value=>typeof value==='string'&&value.length>0&&value.length<=200&&!/[\u0000-\u001f\u007f]/.test(value)?value:null;
const scope=({serverUrl,localId})=>createHash('sha256').update(JSON.stringify([serverUrl||'',localId||''])).digest('hex');

/** Preserve the control-room choice across app/OTA restarts, never across a new Pi boot. */
export class RoomSelection {
 constructor({directory,currentBoot=bootId(),read=readJson,write=atomicJson}={}){
  Object.assign(this,{directory,currentBoot,write});this.path=join(directory,'rooms-selection.json');
  const value=read(this.path,{});this.saved=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
 }
 initial(context){
  if(this.currentBoot&&this.saved.schema===1&&this.saved.bootId===this.currentBoot&&this.saved.scope===scope(context)&&playerId(this.saved.playerId))return this.saved.playerId;
  return playerId(context.localId)||playerId(context.fallbackId);
 }
 save(context,id){
  if(!this.currentBoot||!playerId(id))return false;
  const next={schema:1,bootId:this.currentBoot,scope:scope(context),playerId:id};
  if(JSON.stringify(next)===JSON.stringify(this.saved))return true;
  try{mkdirSync(this.directory,{recursive:true,mode:0o700});this.write(this.path,next);this.saved=next;return true;}catch{return false;}
 }
}
