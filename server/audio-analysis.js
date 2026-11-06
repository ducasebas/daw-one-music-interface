import {spawn} from 'node:child_process';
import {existsSync,readFileSync,mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import {performance} from 'node:perf_hooks';
import {PcmAnalyser,FFT_SIZE} from '../shared/audio-analysis.js';
export class PcmPackets{
 constructor(){this.buffer=Buffer.alloc(0);}
 push(chunk){
  this.buffer=Buffer.concat([this.buffer,chunk]);if(this.buffer.length>8*(24+FFT_SIZE*4))this.buffer=this.buffer.subarray(-8*(24+FFT_SIZE*4));let last=null;
  while(this.buffer.length>=24){
   if(this.buffer.toString('ascii',0,4)!=='TBP1'){const next=this.buffer.indexOf('TBP1',1);this.buffer=next<0?this.buffer.subarray(-3):this.buffer.subarray(next);continue;}
   const rate=this.buffer.readUInt32LE(4),frames=this.buffer.readUInt32LE(8),status=this.buffer.readUInt32LE(12),sourceTime=this.buffer.readUInt32LE(20);
   if(status>5||frames!==(status===2?FFT_SIZE:0)||status===2&&(rate<8000||rate>1536000)){this.buffer=this.buffer.subarray(4);continue;}
   const length=24+frames*4;if(this.buffer.length<length)break;
   last={rate,status,sourceTime,samples:this.buffer.subarray(24,length)};this.buffer=this.buffer.subarray(length);
  }return last;
 }
}
const statuses=['source-missing','idle','pcm','stale','busy','incompatible'];
export class AudioAnalysis{
 constructor({reader=process.env.DAW_AUDIO_READER,directory=process.env.DAW_AUDIO_SHM_DIR,playerId=process.env.DAW_AUDIO_PLAYER_ID,stateDir=process.env.DAW_STATE_DIR||'.tunebox-state',onStatus=()=>{}}={}){
  this.reader=reader;this.directory=directory;this.playerId=playerId?.toLowerCase();this.stateDir=stateDir;this.onStatus=onStatus;this.analyser=new PcmAnalyser();this.enabled=false;this.child=null;this.latest=null;this.status='disabled';this.demandUntil=0;this.lastPacket=0;this.retryAt=0;
  try{const raw=readFileSync(join(stateDir,'audio-analysis.json'),'utf8');if(raw.length<1024)this.enabled=JSON.parse(raw).enabled===true;}catch{}
  this.clock=setInterval(()=>{if(this.child&&(Date.now()>this.demandUntil||!this.enabled))this.stop('inactive');},500);this.clock.unref();
 }
 get configured(){return !!(this.reader&&this.directory&&/^[a-f0-9]{2}(?::[a-f0-9]{2}){5}$/.test(this.playerId)&&existsSync(this.reader));}
 change(status){if(status!==this.status){this.status=status;this.onStatus(status);}}
 setEnabled(enabled){
  if(typeof enabled!=='boolean')throw Error('A boolean measurement setting is required');if(enabled&&!this.configured)throw Error('Install the native Squeezelite PCM reader first');
  mkdirSync(this.stateDir,{recursive:true,mode:0o700});const path=join(this.stateDir,'audio-analysis.json');writeFileSync(path+'.tmp',JSON.stringify({enabled})+'\n',{mode:0o600});renameSync(path+'.tmp',path);this.enabled=enabled;
  if(!enabled)this.stop('disabled');else this.change('inactive');
 }
 start(){
  if(this.child||Date.now()<this.retryAt||!this.enabled||!this.configured)return;
  this.retryAt=Date.now()+2000;const child=spawn(this.reader,[this.directory,this.playerId],{stdio:['ignore','pipe','ignore']});this.child=child;this.startedAt=Date.now();this.lastPacket=0;const packets=new PcmPackets();this.latest=null;this.change('starting');
  child.stdout.on('data',chunk=>{if(this.child!==child)return;const packet=packets.push(chunk);if(!packet)return;this.lastPacket=Date.now();
   if(packet.status!==2){this.latest=null;this.change(statuses[packet.status]);return;}
   const now=Date.now();if(packet.sourceTime*1000>now+2000||now-packet.sourceTime*1000>3000){this.latest=null;this.change('stale');return;}
   const before=performance.now();const data=this.analyser.analyse(packet.samples,packet.rate);this.latest={...data,capturedAt:now,sourceUpdatedAt:packet.sourceTime*1000,processingMs:Math.round((performance.now()-before)*100)/100};this.change(data.silent?'silence':'pcm');
  });
  const failed=()=>{if(this.child===child){this.child=null;this.latest=null;this.change('reader-error');}};child.on('error',failed);child.on('exit',failed);
 }
 stop(status='inactive'){const child=this.child;this.child=null;if(child){child.kill('SIGTERM');const kill=setTimeout(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');},500);kill.unref();child.once('exit',()=>clearTimeout(kill));}this.latest=null;this.demandUntil=0;this.change(this.enabled?status:'disabled');}
 get({watch=false,awake=true,selectedId}={}){
  if(!awake&&this.child)this.stop('sleeping');
  if(watch&&awake&&this.enabled&&this.configured){this.demandUntil=Date.now()+3000;this.start();}
  const fresh=this.child&&Date.now()-this.lastPacket<750;
  const status=!this.configured?'not-configured':!this.enabled?'disabled':!awake?'sleeping':this.child&&!fresh&&Date.now()-this.startedAt>750?'stale':this.status;
  return {enabled:this.enabled,configured:this.configured,status,source:'squeezelite-pcm',simulated:false,playerId:this.playerId||null,matchesSelected:!!selectedId&&selectedId.toLowerCase()===this.playerId,precisionBits:16,unit:'dBFS',measurement:['pcm','silence'].includes(status)&&fresh?this.latest:null};
 }
 close(){clearInterval(this.clock);this.stop();}
}
