import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {atomicJson,readJson} from '../deploy/manager/io.mjs';
import {roomLeader,roomOutputs} from '../shared/multiroom.js';
import {presentationTiming} from '../shared/presentation-timing.js';

export function playbackRoute(read=path=>readFileSync(path,'utf8')){
  let pcm;try{pcm=read('/proc/asound/pcm');}catch{return null;}
  const rows=[];
  for(const line of pcm.split('\n').slice(0,64)){
    const m=line.match(/^(\d{2})-(\d{2}): (.{1,160}?) : .*playback \d+/);if(!m)continue;
    const base=`/proc/asound/card${Number(m[1])}/pcm${Number(m[2])}p/sub0`;
    try{if(!/^state:\s+RUNNING/m.test(read(base+'/status')))continue;const params=read(base+'/hw_params').slice(0,2048);if(!/\brate:\s*\d+/.test(params))continue;rows.push({name:m[3],params:params.replace(/\s+/g,' ').trim()});}catch{}
  }
  return rows.length?createHash('sha256').update(JSON.stringify(rows.sort((a,b)=>a.name.localeCompare(b.name)))).digest('hex'):null;
}
export function synchronizationContext({rooms,playback,audio,route,connected,bluetooth=false,busy=false}={}){
  const local=rooms?.rooms?.find(p=>p.id===rooms.localId),leader=local&&roomLeader(rooms.rooms,local.id),outputs=leader?roomOutputs(rooms.rooms,leader.id):[];
  const sampleRate=audio?.measurement?.sampleRate||audio?.sampleRate||null;
  const descriptor=local&&leader&&route&&sampleRate?{local:local.id,leader:leader.id,outputs:outputs.map(p=>p.id).sort(),route,sampleRate}:null;
  const key=descriptor?createHash('sha256').update(JSON.stringify(descriptor)).digest('hex'):null;
  return {key,ready:!!key&&connected===true&&rooms.selectedId===local.id&&local.available&&leader.available&&outputs.every(p=>p.available)&&!bluetooth&&!busy,playing:playback?.playing===true,trackKey:playback?.queue?.[0]?.mediaKey||null,position:playback?.position??null,observedAt:playback?.observedAt??null,sampleRate,windowMs:audio?.measurement?.windowMs??null,localId:local?.id||null,localName:local?.name||'TuneBox',rooms:outputs.map(p=>({id:p.id,name:p.name})),volume:local?.volume??null,muted:local?.muted??null,pcmReady:['pcm','silence'].includes(audio?.status)&&audio?.enabled===true,source:'squeezelite-pcm'};
}
export function validSyncResult(result){
  if(!result||result.valid!==true||result.method!=='pcm-microphone-energy'||! /^[a-f0-9]{64}$/.test(result.contextKey)||! /^[-a-f0-9]{36}$/.test(result.id)||!Number.isFinite(result.correlation)||result.correlation<.6||result.correlation>1||!Number.isFinite(result.uncertaintyMs)||result.uncertaintyMs>120||result.uncertaintyMs<0||!Number.isFinite(result.delayMs)||result.delayMs<0||result.delayMs>2500||!Number.isFinite(Date.parse(result.measuredAt)))return false;
  return JSON.stringify(presentationTiming(result.timing))===JSON.stringify(result.timing);
}
export class SyncProfiles {
  constructor(directory,{read=readJson,write=atomicJson,now=()=>Date.now()}={}){
    Object.assign(this,{read,write,now});this.path=join(directory,'sync-profiles.json');
    const saved=read(this.path,{});this.profiles=Array.isArray(saved.profiles)?saved.profiles.filter(validSyncResult).slice(0,16):[];
  }
  list(){return this.profiles.map(p=>({...p}));}
  persist(profiles){
    const stored=profiles.slice();
    // Keep the complete file inside the bounded JSON reader's restart limit.
    while(stored.length>1&&Buffer.byteLength(JSON.stringify({schema:1,profiles:stored}))>30000)stored.pop();
    if(Buffer.byteLength(JSON.stringify({schema:1,profiles:stored}))>30000)throw Error('The timing profile is too large to save');
    this.write(this.path,{schema:1,profiles:stored});this.profiles=stored;
  }
  active(context){return context?.key&&context.ready?this.profiles.find(p=>p.contextKey===context.key)||null:null;}
  save(result,context,{useVideo=false,fineMs=0}={}){
    if(!validSyncResult(result)||result.contextKey!==context?.key||!context.ready||this.now()-Date.parse(result.measuredAt)>86400000||Date.parse(result.measuredAt)>this.now()+60000||typeof useVideo!=='boolean'||!Number.isFinite(fineMs)||Math.abs(fineMs)>250||Math.abs(result.timing.visualizerTrimMs+fineMs)>500)throw Error('The measurement or output changed. Repeat synchronization before saving.');
    const profile={...result,useVideo,fineMs,localName:context.localName,rooms:context.rooms,savedAt:new Date(this.now()).toISOString()};
    this.persist([profile,...this.profiles.filter(p=>p.contextKey!==context.key)].slice(0,16));return profile;
  }
  adjust(context,{fineMs,useVideo}){
    const current=this.active(context);
    if(!current||!context.ready||!Number.isFinite(fineMs)||Math.abs(fineMs)>250||Math.abs(current.timing.visualizerTrimMs+fineMs)>500||typeof useVideo!=='boolean')throw Error('The current output or timing adjustment changed. Reopen synchronization.');
    const profile={...current,fineMs,useVideo};this.persist([profile,...this.profiles.filter(p=>p.contextKey!==context.key)]);return profile;
  }
  clear(){this.persist([]);}
}
