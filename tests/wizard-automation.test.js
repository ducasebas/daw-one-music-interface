import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setupConnectionStatus} from '../shared/setup-journeys.js';
import {validateRequest,DeviceManager} from '../shared/device-manager.js';
import {calibratedPresentation,visualizerDelay} from '../shared/presentation-timing.js';
import {canUpdate} from '../deploy/ota/policy.mjs';
import {AutomaticSound} from '../server/automatic-sound.js';
import {syncController} from '../deploy/manager/sync.mjs';
import {playbackHardwareIdle} from '../deploy/manager/audio-idle.mjs';
import {SyncProfiles,synchronizationContext,playbackRoute} from '../server/sync-profiles.js';

test('network, Bluetooth and Music Assistant readiness are independent and can all be true',()=>{
 const snapshot={mode:'music-assistant',musicAssistant:{connected:true},playback:{connected:true},bluetooth:{supported:true,active:true,devices:[{connected:true}]},automaticDsp:{settings:{enabled:true}},sync:{active:{valid:true}},remoteControl:{phones:1}};
 const all=setupConnectionStatus(snapshot,{connected:true,interfaces:[{type:'ethernet',state:'connected'}]});assert.deepEqual(all,{network:true,ethernet:true,bluetooth:true,bluetoothConnected:true,music:true,automaticSound:true,sync:true,remote:true});
 assert.equal(setupConnectionStatus({...snapshot,mode:'simulation'},{}).bluetoothConnected,true);assert.equal(setupConnectionStatus({...snapshot,bluetooth:{supported:false}},{}).music,true);
 const empty=setupConnectionStatus();assert.equal(empty.remote,false);assert.equal(empty.music,false);assert.equal(empty.network,false);assert.equal(empty.bluetoothConnected,false);
});

test('automation and microphone commands require fixed arguments and explicit confirmation',()=>{
 assert.equal(validateRequest({command:'dsp-auto-config',args:{settings:{enabled:true},confirmed:true}}).args.settings.fallback,'warm');
 assert.equal(validateRequest({command:'sync-start',args:{microphone:'hw:3,0',settings:{},confirmed:true}}).args.settings.inputLatencyMs,0);
 for(const value of [{command:'dsp-auto-config',args:{settings:{enabled:true}}},{command:'dsp-auto-config',args:{settings:{enabled:true,gain:12},confirmed:true}},{command:'sync-start',args:{microphone:'hw:3,0',confirmed:false}},{command:'sync-start',args:{microphone:'/etc/passwd',confirmed:true}},{command:'sync-start',args:{microphone:'hw:3,0',settings:{inputLatencyMs:5000},confirmed:true}},{command:'sync-stop',args:{pid:1}},{command:'dsp-auto-update',args:{genres:['fake'],gain:100}}])assert.throws(()=>validateRequest(value));
});

test('new read-only status commands remain available without allowing concurrent mutations',async()=>{
 let release;const wait=new Promise(r=>release=r);const manager=new DeviceManager({status:async()=>({}),perform:async command=>command==='dsp-set'?wait:{readOnly:command}});
 const pending=manager.request({command:'dsp-set',args:{controls:[{id:1,value:0}]}});
 for(const command of ['sync-status','measurement-status','dsp-auto-status'])assert.equal((await manager.request({command})).readOnly,command);
 assert.equal((await manager.request({command:'probe-music',args:{url:'http://localhost:8095'}})).readOnly,'probe-music');
 await assert.rejects(manager.request({command:'sync-start',args:{microphone:'hw:3,0',confirmed:true}}),/already running/);release({saved:true});await pending;
});

test('automatic sound dispatch is event-driven, coalesces track updates and ignores unrelated remote or paused views',async()=>{
 const c={enabled:true,settings:{mode:'genre'},connected:true,localSelected:true,playing:true,bluetooth:false,trackKey:'one'};let calls=0;
 const service=new AutomaticSound({context:()=>c,perform:async()=>{calls++;},delay:2,retryDelay:2});
 try{for(let i=0;i<30;i++)service.schedule();await new Promise(r=>setTimeout(r,20));assert.equal(calls,1);for(let i=0;i<30;i++)service.schedule();await new Promise(r=>setTimeout(r,10));assert.equal(calls,1);
  for(const patch of [{localSelected:false},{playing:false},{enabled:false}]){Object.assign(c,{enabled:true,localSelected:true,playing:true,bluetooth:false,trackKey:'next'},patch);service.schedule();await new Promise(r=>setTimeout(r,10));assert.equal(calls,1);}
  Object.assign(c,{enabled:true,localSelected:true,playing:true,bluetooth:false,trackKey:'last'});service.schedule();await new Promise(r=>setTimeout(r,20));assert.equal(calls,2);
 }finally{service.close();}
});

test('a Bluetooth source transition dispatches its fallback without requiring Music Assistant',async()=>{
 const c={enabled:true,settings:{mode:'genre'},connected:false,localSelected:false,playing:false,bluetooth:true,trackKey:null};let calls=0;
 const service=new AutomaticSound({context:()=>c,perform:async()=>{calls++;},delay:2,retryDelay:2});
 try{for(let i=0;i<20;i++)service.schedule();await new Promise(r=>setTimeout(r,20));assert.equal(calls,1);c.trackKey='stale-MA-track';service.schedule();await new Promise(r=>setTimeout(r,10));assert.equal(calls,1);
  Object.assign(c,{bluetooth:false,connected:true,localSelected:true,playing:true});service.schedule();await new Promise(r=>setTimeout(r,20));assert.equal(calls,2);
 }finally{service.close();}
});

test('automatic dispatcher retries a failed root action once and closes without leaking timers',async()=>{
 let calls=0;const service=new AutomaticSound({context:()=>({enabled:true,connected:true,localSelected:true,playing:true,trackKey:'one'}),perform:async()=>{calls++;throw Error('busy');},delay:1,retryDelay:1});service.schedule();await new Promise(r=>setTimeout(r,30));assert.equal(calls,2);service.close();service.schedule();await new Promise(r=>setTimeout(r,10));assert.equal(calls,2);
});

test('standalone Bluetooth never treats running, unknown or unreadable ALSA as idle',()=>{
 const pcm='03-00: Louder : playback 1\n';
 assert.equal(playbackHardwareIdle(p=>p==='/proc/asound/pcm'?pcm:'closed\n'),true);
 for(const status of ['state: RUNNING\n','state: XRUN\n','unrecognized'])assert.equal(playbackHardwareIdle(p=>p==='/proc/asound/pcm'?pcm:status),false);
 assert.equal(playbackHardwareIdle(()=>{throw Error('unreadable');}),false);
});

function context(){return synchronizationContext({rooms:{localId:'tb',selectedId:'tb',rooms:[{id:'tb',name:'TuneBox',available:true,type:'player',members:['rivo'],volume:20,muted:false},{id:'rivo',name:'Rivo',available:true,type:'player',members:[],parentId:'tb'}]},playback:{playing:true,queue:[{mediaKey:'track'}],position:10,observedAt:1000},audio:{enabled:true,status:'pcm',measurement:{sampleRate:48000,windowMs:85.33}},route:'route-one',connected:true});}
function result(ctx){return {valid:true,id:'12345678-1234-1234-1234-123456789abc',method:'pcm-microphone-energy',contextKey:ctx.key,measuredAt:new Date().toISOString(),correlation:.9,uncertaintyMs:55,delayMs:200,timing:{screenDelayMs:280,visualizerTrimMs:-80},rawAudioRetained:false};}

test('sync contexts bind group, local output and sample rate without depending on track/volume',()=>{
 const ctx=context();assert.equal(ctx.ready,true);assert.match(ctx.key,/^[a-f0-9]{64}$/);assert.deepEqual(ctx.rooms.map(p=>p.name),['TuneBox','Rivo']);
 const p=playbackRoute(path=>path==='/proc/asound/pcm'?'03-00: Louder : playback 1\n':path.endsWith('status')?'state: RUNNING\n':'format: S16_LE\nrate: 48000\nbuffer_size: 2048\n');assert.match(p,/^[a-f0-9]{64}$/);
 assert.equal(playbackRoute(()=>{throw Error('offline');}),null);
});

test('sync profiles persist bounded measurements and per-output fine adjustments, rejecting stale/different paths',()=>{
 const dir=mkdtempSync(join(tmpdir(),'tunebox-sync-profile-'));const ctx=context();
 try{const profiles=new SyncProfiles(dir);profiles.save(result(ctx),ctx,{useVideo:false});assert.equal(new SyncProfiles(dir).active(ctx).delayMs,200);
  const fine=profiles.adjust(ctx,{fineMs:25,useVideo:true});const prefs={syncAutomatic:true,timing:{screenDelayMs:900,visualizerTrimMs:100}};const resolved=calibratedPresentation(prefs,fine);assert.equal(visualizerDelay(resolved.timing),225);assert.equal(resolved.videoTiming.screenDelayMs,280);
  assert.equal(calibratedPresentation({...prefs,syncAutomatic:false},fine).timing.screenDelayMs,900);
  assert.equal(profiles.active({...ctx,key:'b'.repeat(64)}),null);
  assert.equal(profiles.active({...ctx,ready:false}),null,'never use local timing while viewing a remote player or Bluetooth');
  assert.throws(()=>profiles.save(result(ctx),{...ctx,key:'b'.repeat(64)}));assert.throws(()=>profiles.save({...result(ctx),measuredAt:'2020-01-01T00:00:00Z'},ctx));assert.throws(()=>profiles.save({...result(ctx),correlation:.2},ctx));assert.throws(()=>profiles.adjust(ctx,{fineMs:300,useVideo:true}));
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('sync start uses only the whitelisted capture service and rejects missing microphone, busy or changed playback',async()=>{
 const calls=[],files=new Map(),ctx=context();let microphones=[{id:'hw:3,0',name:'USB mic'}],active='inactive';
 const controller=syncController({context:async()=>ctx,microphones:()=>microphones,exists:()=>true,read:(p,f)=>files.get(p)||f,write:(p,v)=>files.set(p,v),run:async(program,args)=>{calls.push({program,args});return args[0]==='is-active'?active:'';}});
 const value=await controller.start({microphone:'hw:3,0',settings:{},confirmed:true});assert.equal(value.queued,true);assert.equal(calls.filter(c=>c.args[0]==='start').length,1);assert.ok(calls.every(c=>['/usr/bin/chown','/usr/bin/chmod','/usr/bin/systemctl'].includes(c.program)));
  microphones=[];await assert.rejects(controller.start({microphone:'hw:3,0'}));microphones=[{id:'hw:3,0'}];active='active';await assert.rejects(controller.start({microphone:'hw:3,0'}));active='inactive';ctx.playing=false;await assert.rejects(controller.start({microphone:'hw:3,0'}));
});

test('all updater paths retain their idle gate while microphone synchronization runs',()=>{
 const state={mode:'simulation',device:{mode:'ready',amplifierEnabled:false,faults:[]},playback:{playing:false},activity:{localPlayback:false,syncCalibration:true}};assert.equal(canUpdate(state),false);state.activity.syncCalibration=false;assert.equal(canUpdate(state),true);
});

test('profile storage stays restart-readable and a failed disk write cannot activate an unsaved correction',()=>{
 const dir=mkdtempSync(join(tmpdir(),'tunebox-sync-bound-')),ctx=context();
 try{
  const profiles=new SyncProfiles(dir);
  for(let i=0;i<16;i++){const c={...ctx,key:i.toString(16).padStart(64,'0'),rooms:Array.from({length:40},(_,j)=>({id:String(j),name:'x'.repeat(150)}))};profiles.save(result(c),c);}
  assert.ok(profiles.list().length<16);assert.deepEqual(new SyncProfiles(dir).list(),profiles.list());
  const before=profiles.list();profiles.write=()=>{throw Error('disk full');};const fresh={...ctx,key:'f'.repeat(64)};assert.throws(()=>profiles.save(result(fresh),fresh),/disk full/);assert.deepEqual(profiles.list(),before);assert.equal(profiles.active(fresh),null);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('3.16: a sync result measured from onsets can be saved like an energy result',()=>{
 const dir=mkdtempSync(join(tmpdir(),'tunebox-sync-onsets-'));const ctx=context();
 try{const profiles=new SyncProfiles(dir);profiles.save({...result(ctx),method:'pcm-microphone-onsets'},ctx);assert.equal(new SyncProfiles(dir).active(ctx).method,'pcm-microphone-onsets');
  assert.throws(()=>profiles.save({...result(ctx),method:'guess'},ctx));}
 finally{rmSync(dir,{recursive:true,force:true});}
});
