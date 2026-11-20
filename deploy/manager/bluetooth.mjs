import {existsSync,rmSync} from 'node:fs';
import {uptime} from 'node:os';
import {randomUUID} from 'node:crypto';
import {atomicJson,readJson} from './io.mjs';
import {dspController,blockingFaults} from './dsp.mjs';
import {bluetoothGainChanges} from '../../shared/bluetooth.js';
const units=['tunebox-player.service','squeezelite.service'];
export function bluetoothController({run,directory='/run/daw-one-bluetooth',journal='/var/lib/daw-one-manager/bluetooth-restore.json',configuration='/etc/daw-one/bluetooth.json',dsp=dspController({run}),write=atomicJson,read=readJson,remove=path=>rmSync(path,{force:true}),exists=existsSync}={}){
 const source=v=>write(directory+'/source.json',v,0o640);
 const service=(action,name)=>run('/usr/bin/systemctl',[action,name]);
 const adapter=(action,...args)=>run('/usr/bin/python3',['/usr/local/lib/daw-one-control/deploy/bluetooth/control.py',action,...args]);
 const session=()=>read(journal,null);
 async function closePairing(){remove(directory+'/window.json');remove(directory+'/decision.json');await adapter('close').catch(()=>{});}
 return {
  active:()=>!!session(),
  async start(limit){
   const config=read(configuration,{});if(!config.verified||config.output!=='plughw:CARD=LouderRaspberry,DEV=0')throw Error('Install and verify the local Bluetooth receiver first');
   if(session())throw Error('Bluetooth is active or needs restoration; switch back to Music Assistant first');
   const current=await dsp.get(),controls=current.controls;if(!current.supported||blockingFaults(current.faults).length)throw Error('Resolve amplifier faults first');
   const safe=bluetoothGainChanges(controls,controls,0,limit),saved={schema:1,sessionId:randomUUID(),units:[],controls:controls.filter(c=>/^Channel (Left|Right) Gain$/.test(c.name)),volume:0,limit};
   for(const unit of units)if((await service('is-active',unit).catch(()=>'')).trim()==='active')saved.units.push(unit);
   write(journal,saved);source({active:true,sessionId:saved.sessionId,phase:'starting',volume:0,limit});
   try{
    await dsp.set(safe);for(const unit of saved.units)await service('stop',unit);
    await service('start','daw-one-bluetooth-agent.service');await adapter('ready');
    await service('start','daw-one-bluealsa.service');await service('start','daw-one-bluetooth-audio.service');
    source({active:true,sessionId:saved.sessionId,phase:'active',volume:0,limit});return {active:true,volume:0};
   }catch{source({active:true,phase:'recovery-required',volume:0,limit});await this.stop().catch(()=>{});throw Error('Bluetooth could not start. Check the local receiver service before retrying.');}
  },
  async stop({restartPlayers=true}={}){
   const saved=session();await closePairing();
   await service('stop','daw-one-bluetooth-audio.service');await adapter('disconnect-all').catch(()=>{});
   await service('stop','daw-one-bluealsa.service');await service('stop','daw-one-bluetooth-agent.service');
   if(saved){
    if(saved.schema!==1||!Array.isArray(saved.units)||saved.units.some(u=>!units.includes(u)))throw Error('Bluetooth restore needs administrator attention');
    const current=await dsp.get();bluetoothGainChanges(current.controls,saved.controls,0,saved.limit);
    try{await dsp.set(saved.controls.map(({id,value})=>({id,value})));}catch(error){source({active:true,phase:'recovery-required',volume:0,limit:saved.limit});throw error;}
    if(restartPlayers)for(const unit of saved.units)await service('start',unit);
    remove(journal);
   }
   source({active:false,phase:'off',volume:0});return {active:false};
  },
  async volume(value,limit,sessionId){
   const saved=session();if(!saved||saved.sessionId!==sessionId)throw Error('Bluetooth source changed; adjust the current volume again');
   const ceiling=Math.min(saved.limit,limit),current=await dsp.get();if(blockingFaults(current.faults).length)throw Error('Resolve amplifier faults before increasing volume');
   await dsp.set(bluetoothGainChanges(current.controls,saved.controls,value,ceiling));
   write(journal,{...saved,volume:value,limit:ceiling});source({active:true,sessionId:saved.sessionId,phase:'active',volume:value,limit:ceiling});return {saved:true,volume:value};
  },
  async pair(){
   if(!session())throw Error('Choose the Bluetooth source first');
   const bootId=String(await run('/bin/cat',['/proc/sys/kernel/random/boot_id'])).trim();
   write(directory+'/window.json',{bootId,expiresBootSeconds:uptime()+120},0o640);await adapter('pair');return {pairing:true,seconds:120};
  },
  closePairing,
  async confirm(args){
   const pending=read(directory+'/pairing.json',{});if(!session()||pending.nonce!==args.nonce||pending.expiresAt<Date.now())throw Error('Pairing request expired');
   write(directory+'/decision.json',{nonce:args.nonce,accept:args.accept},0o600);return {confirmed:true};
  },
  async device(action,address){if(!session())throw Error('Choose the Bluetooth source first');await adapter(action,address);if(action==='forget')write(directory+'/forget.json',{address},0o600);return {saved:true};},
 };
}
