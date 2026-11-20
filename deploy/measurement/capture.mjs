import {readFileSync,writeFileSync,renameSync,rmSync,statSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {roomProfile,measuredBaseline,measurementSetupKey} from '../../shared/room-measurement.js';
import {usbMicrophones} from './devices.mjs';
import {sweep,sweepLevels,wav,analyse,cutProposal,rate,captureSeconds} from './signal.mjs';
const dir='/var/lib/daw-one-measurement';
const status=v=>{writeFileSync(dir+'/status.tmp',JSON.stringify({...v,observedAt:Date.now()})+'\n',{mode:0o640});renameSync(dir+'/status.tmp',dir+'/status.json');};
const settleSeconds=.4,children=new Set();let cancelled=false;
const kill=()=>{for(const p of children)p.kill('SIGTERM');};
process.on('SIGTERM',()=>{cancelled=true;kill();});process.on('SIGINT',()=>{cancelled=true;kill();});
function run(program,args){
 const p=spawn(program,args,{stdio:['ignore','ignore','ignore']});children.add(p);
 const done=new Promise((resolve,reject)=>{p.once('error',reject);p.once('exit',code=>{children.delete(p);code===0?resolve():reject(Error('Audio capture or output failed'));});});
 done.catch(()=>{});return {p,done};
}
async function captureReady(capture){
 // Wait for real samples, not a fixed sleep that can play before a slow USB device opens. A USB
 // microphone also needs a moment to settle after opening (DC offset, gain), so wait for 0.4 s of audio.
 for(let i=0;i<60;i++){
  if(cancelled)throw Error('Cancelled');if(capture.p.exitCode!==null)throw Error('Microphone failed to start');
  try{if(statSync(dir+'/capture.raw').size>=rate*settleSeconds*2)return;}catch{}
  await delay(50);
 }
 throw Error('Microphone did not start in time');
}
try{
 const job=JSON.parse(readFileSync(dir+'/request.json','utf8')),config=JSON.parse(readFileSync('/etc/daw-one/measurement.json','utf8')),profile=roomProfile(job.profile);
 if(!usbMicrophones().some(m=>m.id===job.microphone)||!['plughw:CARD=Headphones,DEV=0','plughw:CARD=LouderRaspberry,DEV=0'].includes(config.output)||config.verified!==true)throw Error('Verified output and a supported USB capture device are required');
 let baseline=null;
 if(job.verifyCorrection===true){try{baseline=JSON.parse(readFileSync(dir+'/baseline.json','utf8'));}catch{}if(!measuredBaseline(baseline)||measurementSetupKey(baseline)!==measurementSetupKey({profile,output:config.output,microphone:job.microphone}))throw Error('Record a valid flat baseline with this microphone and setup before verification.');}
 const level=job.levelDbfs===undefined?-36:job.levelDbfs;if(!sweepLevels.includes(level))throw Error('Unsupported sweep level');
 const signal=sweep(level),channels=[];
 for(let channel=0;channel<2;channel++){
  if(cancelled)throw Error('Cancelled');
  status({phase:channel?'measuring-right':'measuring-left',percent:channel?50:5,output:config.output,estimatedEndAt:Date.now()+(channel?9500:19000)});
  writeFileSync(dir+'/sweep.wav',wav(signal,channel),{mode:0o600});rmSync(dir+'/capture.raw',{force:true});
  const t0=Date.now(),capture=run('/usr/bin/arecord',['-q','-D',job.microphone.replace(/^hw:/,'plughw:'),'-t','raw','-f','S16_LE','-r',String(rate),'-c','1','-d',String(captureSeconds),dir+'/capture.raw']);
  await captureReady(capture);if(cancelled)throw Error('Cancelled');
  // Timing for the diagnosis: when the player started relative to the microphone, and how long it ran.
  const t1=Date.now(),player=run('/usr/bin/aplay',['-q','-D',config.output,dir+'/sweep.wav']);let t2=null;player.done.then(()=>{t2=Date.now();},()=>{t2=Date.now();});await Promise.all([capture.done,player.done]);
  const timing={microphoneReadyMs:t1-t0,playerStartMs:t1-t0,playerRunMs:t2?t2-t1:null,captureMs:Date.now()-t0};
  if(cancelled)throw Error('Cancelled');
  const raw=readFileSync(dir+'/capture.raw');if(raw.length>rate*2*8.5)throw Error('Recording exceeds bounded capture size');
  const samples=new Float32Array(Math.floor(raw.length/2));for(let i=0;i<samples.length;i++)samples[i]=raw.readInt16LE(i*2)/32768;
  status({phase:'analysing',percent:channel?85:35,estimatedEndAt:Date.now()+(channel?1500:9000)});{const r=analyse(signal,samples,profile.calibration);channels.push({...r,diagnostics:{...r.diagnostics,timing,level},channel:channel?'right':'left'});}
  rmSync(dir+'/capture.raw',{force:true});
 }
 const result={channels,proposal:cutProposal(channels),profile,output:config.output,microphone:job.microphone,measuredAt:new Date().toISOString(),levelDbfs:level,baseline:job.verifyCorrection===true?'current-dsp':config.output.includes('Louder')?'flat-eq':'verified-output',...(baseline?{baselineChannels:baseline.channels}:{}),applied:false,absoluteSpl:false};
 if(measuredBaseline(result)){writeFileSync(dir+'/baseline.tmp',JSON.stringify(result)+'\n',{mode:0o640});renameSync(dir+'/baseline.tmp',dir+'/baseline.json');}
 status({phase:'complete',percent:100,output:config.output,result});
}catch(error){
 status(cancelled?{phase:'cancelled'}:{phase:'failed',error:error.message==='Record a valid flat baseline with this microphone and setup before verification.'?error.message:'Measurement failed. Check the USB microphone, ALSA ownership and verified output; no correction was applied.'});
 if(!cancelled)process.exitCode=1;
}finally{
 kill();for(const file of ['sweep.wav','capture.raw'])rmSync(dir+'/'+file,{force:true});
}
