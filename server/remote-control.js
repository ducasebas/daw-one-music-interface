import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import {networkInterfaces} from 'node:os';
import {controlVolumeLimit} from '../shared/volume.js';
import {resolveTheme,themeVariables} from '../shared/themes.js';
import {sourceQuality} from '../shared/now-playing.js';

/**
 * Phone remote control. A phone pairs once by scanning a single-use QR code shown on
 * TuneBox and then keeps a revocable, hashed credential until it is forgotten on the
 * device. Remote phones only reach playback, volume and search; never settings.
 */
const hash=value=>createHash('sha256').update(value).digest('hex');
export const remoteLimits=Object.freeze({phones:8,pairMs:600000,volumeStep:10,nameLength:40});
export const remoteEvents=Object.freeze(['play','pause','next','previous','volume','mute']);
export const remoteQueueOptions=Object.freeze(['replace','next','add']);
const cleanName=value=>typeof value==='string'?value.replace(/[\x00-\x1f\x7f<>]/g,'').trim().slice(0,remoteLimits.nameLength):'';

export class RemoteAccess{
 constructor(directory,{now=Date.now}={}){
  this.directory=directory;this.path=join(directory,'remote.json');this.now=now;this.pair=null;this.invalid=false;this.phones=[];
  try{const raw=readFileSync(this.path,'utf8');if(raw.length>16384)throw Error();const data=JSON.parse(raw);if(!Array.isArray(data?.phones))throw Error();
   this.phones=data.phones.filter(p=>/^[a-f0-9]{16}$/.test(p?.id)&&/^[a-f0-9]{64}$/.test(p?.hash)).slice(0,remoteLimits.phones).map(p=>({id:p.id,hash:p.hash,name:cleanName(p.name)||'Phone',createdAt:Number(p.createdAt)||0,lastSeenAt:Number(p.lastSeenAt)||0}));}
  catch(e){this.invalid=e.code!=='ENOENT';this.phones=[];}
 }
 persist(){mkdirSync(this.directory,{recursive:true,mode:0o700});writeFileSync(this.path+'.tmp',JSON.stringify({phones:this.phones})+'\n',{mode:0o600});renameSync(this.path+'.tmp',this.path);this.invalid=false;}
 /** One active QR code at a time; showing a new code invalidates the previous one. */
 createPair(){if(this.phones.length>=remoteLimits.phones)throw Error('Forget a phone before pairing another one');const token=randomBytes(24).toString('hex');this.pair={key:hash(token),expires:this.now()+remoteLimits.pairMs};return {token,expiresAt:this.pair.expires};}
 cancelPair(){this.pair=null;}
 pairing(){return !!this.pair&&this.pair.expires>this.now();}
 complete(token,name){
  const key=hash(typeof token==='string'?token:'');
  if(!this.pair||this.pair.expires<=this.now()||key.length!==this.pair.key.length||!timingSafeEqual(Buffer.from(key),Buffer.from(this.pair.key)))throw Error('This remote code expired or was already used. Show a new code on TuneBox.');
  if(this.phones.length>=remoteLimits.phones)throw Error('Forget a phone before pairing another one');
  this.pair=null;const id=randomBytes(8).toString('hex'),secret=randomBytes(32).toString('hex'),at=this.now();
  this.phones.push({id,hash:hash(secret),name:cleanName(name)||'Phone',createdAt:at,lastSeenAt:at});this.persist();
  return {id,credential:id+'.'+secret};
 }
 credential(request){const c=request.headers?.cookie||'';return c.split(';').map(v=>v.trim()).find(v=>v.startsWith('tunebox_remote='))?.slice(15)||'';}
 phone(request){
  const match=/^([a-f0-9]{16})\.([a-f0-9]{64})$/.exec(this.credential(request));if(!match)return null;
  const phone=this.phones.find(p=>p.id===match[1]);if(!phone)return null;const given=hash(match[2]);
  if(!timingSafeEqual(Buffer.from(given),Buffer.from(phone.hash)))return null;
  // Throttle writes: last use is informational and must not wear the SD card.
  if(this.now()-phone.lastSeenAt>3600000){phone.lastSeenAt=this.now();try{this.persist();}catch{}}
  return phone;
 }
 cookie(credential){return `tunebox_remote=${credential}; HttpOnly; SameSite=Strict; Path=/; Max-Age=315360000`;}
 list(){return this.phones.map(({id,name,createdAt,lastSeenAt})=>({id,name,createdAt,lastSeenAt}));}
 forget(id){const before=this.phones.length;this.phones=this.phones.filter(p=>p.id!==id);if(this.phones.length===before)throw Error('This phone is no longer paired');this.persist();return this.list();}
 forgetAll(){this.phones=[];this.pair=null;this.persist();return [];}
}

/** The LAN address a phone can reach. The setup hotspot and loopback are never offered. */
export function remoteAddress(interfaces=networkInterfaces()){
 const rows=[];for(const [name,list] of Object.entries(interfaces))for(const row of list||[])if((row.family==='IPv4'||row.family===4)&&!row.internal&&row.address!=='10.42.0.1'&&!/^169\.254\./.test(row.address))rows.push({name,address:row.address});
 rows.sort((a,b)=>(/^(eth|en)/.test(a.name)?0:1)-(/^(eth|en)/.test(b.name)?0:1));
 return rows[0]?.address||null;
}

const text=(v,max=120)=>typeof v==='string'?v.slice(0,max):'';
function remoteNext(p,bluetooth){
 if(bluetooth||!Array.isArray(p.queue))return null;
 const next=p.queue[(p.index||0)+1];
 return next&&typeof next.title==='string'?{title:text(next.title),artist:text(next.artist)}:null;
}
/** The TuneBox skin colours and font family only, so the phone feels like the same device. */
export function remoteStyle(snapshot){
 try{
  const theme=resolveTheme(snapshot?.preferences?.themePreferences,{device:snapshot?.device,playback:snapshot?.playback});
  const v=themeVariables(theme);
  const choice=snapshot?.preferences?.prefs?.font||'inter';
  const font=choice==='inter'?'"Inter Variable", Inter, sans-serif':choice==='manrope-heavy'?'Manrope, sans-serif':v['--font'];
  return {skin:theme.id,background:v['--background'],surface:v['--surface'],text:v['--text'],muted:v['--muted'],accent:v['--accent'],font,weight:choice==='manrope-heavy'?'heavy':'normal',radius:v['--radius']};
 }catch{return null;}
}
/** Only what a remote needs. No settings, network names, telemetry or tokens. */
export function remoteView(snapshot,{notifications=[]}={}){
 const p=snapshot?.playback||{},track=Array.isArray(p.queue)?p.queue[p.index||0]:null,bluetooth=snapshot?.bluetooth?.active===true;
 const volume=bluetooth?(Number.isInteger(snapshot.bluetooth.volume)?snapshot.bluetooth.volume:null):Number.isFinite(p.volume)?p.volume:Number.isFinite(snapshot?.audio?.volume)?snapshot.audio.volume:null;
 const muted=bluetooth?volume===0:typeof p.muted==='boolean'?p.muted:snapshot?.audio?.muted===true;
 return {
  name:'TuneBox',language:snapshot?.preferences?.language==='nl'?'nl':'en',mode:snapshot?.mode==='music-assistant'?'music-assistant':'simulation',
  searchAvailable:snapshot?.mode==='music-assistant'&&snapshot?.musicAssistant?.status==='connected'&&!bluetooth,
  bluetooth,
  playback:{connected:p.connected===true,playing:p.playing===true,position:Number.isFinite(p.position)?p.position:0,observedAt:Number.isFinite(p.observedAt)?p.observedAt:0,
   title:typeof track?.title==='string'?track.title:'',artist:typeof track?.artist==='string'?track.artist:'',album:typeof track?.album==='string'?track.album:'',
   duration:Number.isFinite(track?.duration)?track.duration:null,artwork:typeof track?.artwork==='string'&&track.artwork.startsWith('/api/artwork/')?track.artwork:null,
   volume,muted,playerName:typeof p.playerName==='string'?p.playerName.slice(0,60):'',
   // GUI 3.11: the same calm presentation as the wall: what plays next and the source quality.
   next:remoteNext(p,bluetooth),quality:bluetooth?null:sourceQuality(p.sourceFormat)},
  style:remoteStyle(snapshot),
  // GUI 3.15: TuneBox notifications (update offer, Music Assistant offline, hardware) reach paired phones too.
  notifications:(Array.isArray(notifications)?notifications:[]).slice(0,6).filter(n=>typeof n?.id==='string'&&typeof n.title==='string').map(n=>({id:n.id.slice(0,40),title:n.title.slice(0,80),detail:typeof n.detail==='string'?n.detail.replace(/\{(\w+)\}/g,(all,k)=>n.params&&Object.hasOwn(n.params,k)?String(n.params[k]):all).slice(0,160):''})),
  volumeLimit:bluetooth&&Number.isInteger(snapshot.bluetooth.limit)?snapshot.bluetooth.limit:controlVolumeLimit(snapshot||{}),
 };
}

/**
 * Validates a remote playback command. Volume may only rise by a bounded step per
 * command, so a stray tap or slider jump on a phone can never leap to loud.
 */
export function remoteEvent(body,view){
 if(!body||typeof body!=='object'||Array.isArray(body)||!remoteEvents.includes(body.type))throw Error('This remote can only play, pause, skip and change volume');
 if(body.type==='volume'){
  if(Object.keys(body).some(k=>!['type','value'].includes(k))||!Number.isFinite(body.value))throw Error('Choose a volume level');
  const current=view.playback.volume,value=Math.max(0,Math.min(view.volumeLimit,Math.round(body.value)));
  if(!Number.isFinite(current))throw Error('Volume is not available right now');
  return {type:'volume',value:Math.min(value,current+remoteLimits.volumeStep)};
 }
 if(body.type==='mute'){if(Object.keys(body).some(k=>!['type','value'].includes(k))||typeof body.value!=='boolean')throw Error('Choose mute or unmute');return {type:'mute',value:body.value};}
 if(Object.keys(body).length!==1)throw Error('Unexpected remote argument');
 return {type:body.type};
}
