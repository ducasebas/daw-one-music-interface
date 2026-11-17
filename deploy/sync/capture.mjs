import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {atomicJson,boundedJson} from '../manager/io.mjs';
import {usbMicrophones} from '../measurement/devices.mjs';
import {measureSynchronization} from './session.mjs';
const directory='/var/lib/daw-one-sync';
let child,cancelled=false;
const stop=()=>{cancelled=true;child?.kill('SIGTERM');};process.on('SIGTERM',stop);process.on('SIGINT',stop);
const report=value=>atomicJson(directory+'/status.json',{...value,observedAt:Date.now()},0o640);
async function local(path){const response=await fetch('http://127.0.0.1:3001'+path,{signal:AbortSignal.timeout(2000)});if(!response.ok)throw Error('Local analysis is unavailable');return boundedJson(response,65536);}
function openCapture(microphone){
 child=spawn('/usr/bin/arecord',['-q','-D',microphone.replace(/^hw:/,'plughw:'),'-t','raw','-f','S16_LE','-r','48000','-c','1','--buffer-time=20000','--period-time=5000','-d','12','-'],{stdio:['ignore','pipe','ignore']});
 const state={ended:false,failed:false,onData:fn=>child.stdout.on('data',fn),stop:()=>child.kill('SIGTERM')};
 child.once('error',()=>{state.failed=true;state.ended=true;});child.once('close',code=>{state.failed=code!==0;state.ended=true;});return state;
}
try{
 const raw=readFileSync(directory+'/request.json','utf8');if(raw.length>16384)throw Error('Synchronization request is too large');const job=JSON.parse(raw);
 if(!usbMicrophones().some(p=>p.id===job.microphone)||!/^[-a-f0-9]{36}$/.test(job.id)||! /^[a-f0-9]{64}$/.test(job.context?.key))throw Error('Invalid microphone or synchronization request');
 const result=await measureSynchronization({job,getContext:()=>local('/api/sync/context'),getAudio:()=>local('/api/audio?watch=1'),openCapture,report,cancelled:()=>cancelled});
 report({phase:'complete',id:job.id,percent:100,result});
}catch(error){report({phase:cancelled?'cancelled':'failed',error:cancelled?null:String(error.message).slice(0,180)});if(!cancelled)process.exitCode=1;}
finally{child?.kill('SIGTERM');}
