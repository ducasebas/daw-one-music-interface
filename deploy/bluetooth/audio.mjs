import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
export function approvedPhones(value){return Array.isArray(value)?[...new Set(value.filter(v=>typeof v==='string'&&/^([A-F0-9]{2}:){5}[A-F0-9]{2}$/.test(v)&&!['00:00:00:00:00:00','FF:FF:FF:FF:FF:FF'].includes(v)))].sort().slice(0,16):[];}
const options=['--dbus=TuneBox','--profile-a2dp','--single-audio','--volume=software','--pcm=plughw:CARD=LouderRaspberry,DEV=0','--pcm-buffer-time=300000','--pcm-period-time=100000','--loglevel=warning'];
export function audioArguments(value){const phones=approvedPhones(value);return phones.length?[...options,...phones]:null;}
if(process.argv[1]?.endsWith('/bluetooth/audio.mjs')){
 let child=null,key='',busy=false,stopping=false;
 const stop=()=>new Promise(resolve=>{if(!child){resolve();return;}const old=child;child=null;const timer=setTimeout(()=>old.kill('SIGKILL'),2000);old.once('exit',()=>{clearTimeout(timer);resolve();});old.kill('SIGTERM');});
 const poll=async()=>{if(busy||stopping)return;busy=true;try{let phones=[];try{const raw=readFileSync('/run/daw-one-bluetooth/audio-phones.json','utf8');if(raw.length<4096)phones=JSON.parse(raw);}catch{}
  const args=audioArguments(phones),next=JSON.stringify(args);if(next!==key){await stop();key=next;if(args&&!stopping){child=spawn('/usr/bin/bluealsa-aplay',args,{stdio:'ignore'});const own=child;own.on('error',()=>{if(child===own){child=null;key='';}});own.on('exit',()=>{if(child===own){child=null;key='';}});}}
 }finally{busy=false;}};
 const timer=setInterval(poll,1000);poll();
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{stopping=true;clearInterval(timer);await stop();process.exit(0);});
}
