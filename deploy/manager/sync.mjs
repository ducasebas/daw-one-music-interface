import {existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {usbMicrophones} from '../measurement/devices.mjs';
import {atomicJson,readJson} from './io.mjs';

export function syncController({run,context,microphones=usbMicrophones,read=readJson,write=atomicJson,exists=existsSync,dir='/var/lib/daw-one-sync'}={}){
  return {
    async status(){const active=(await run('/usr/bin/systemctl',['is-active','daw-one-sync.service']).catch(()=>'')).trim();const history=read(dir+'/history.json',[]);return {...read(dir+'/status.json',{}),history:Array.isArray(history)?history.slice(-5).map(e=>({at:String(e?.at||'').slice(0,30),outcome:['complete','failed','cancelled'].includes(e?.outcome)?e.outcome:'unknown',...(typeof e?.error==='string'?{error:e.error.slice(0,180)}:{}),...(Number.isFinite(e?.delayMs)?{delayMs:e.delayMs}:{}),...(Number.isFinite(e?.uncertaintyMs)?{uncertaintyMs:e.uncertaintyMs}:{})})):[],supported:exists('/etc/systemd/system/daw-one-sync.service')&&exists('/usr/bin/arecord'),microphones:microphones(),running:['active','activating','deactivating'].includes(active)};},
    async start(args){
      const current=await this.status(),ctx=await context();
      if(!current.supported||!current.microphones.some(p=>p.id===args.microphone))throw Error('Connect a USB microphone and install synchronization support first');
      if(current.running)throw Error('Synchronization is already running');
      if(!ctx.ready||!ctx.playing||!ctx.pcmReady||ctx.muted)throw Error('Play music on the local TuneBox with real PCM analysis enabled before measuring synchronization');
      const id=randomUUID();write(dir+'/request.json',{...args,id,context:ctx});await run('/usr/bin/chown',['dawaudiotest:dawone',dir+'/request.json']);await run('/usr/bin/chmod',['640',dir+'/request.json']);
      write(dir+'/status.json',{phase:'queued',id,percent:0,observedAt:Date.now()});await run('/usr/bin/chown',['dawaudiotest:dawone',dir+'/status.json']);await run('/usr/bin/chmod',['640',dir+'/status.json']);
      await run('/usr/bin/systemctl',['start','--no-block','daw-one-sync.service']);return {queued:true,id};
    },
    async stop(){await run('/usr/bin/systemctl',['stop','daw-one-sync.service']);return {stopped:true};},
  };
}
