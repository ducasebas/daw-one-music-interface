import test from 'node:test';
import assert from 'node:assert/strict';
import {powerMonitoring,powerResponse,assertPdRequestIdle} from '../deploy/manager/power-telemetry.mjs';
import {powerDefaults,powerSettings} from '../shared/power-settings.js';
import {validateRequest,DeviceManager} from '../shared/device-manager.js';
import {readFileSync} from 'node:fs';

const settingsPath='/etc/daw-one-power/settings.json',proofPath='/var/lib/daw-one-power/qualification.json',runtime='/run/daw-one-pd';
const confirmed={confirmed:true,cable5AVerified:true,startup:false};
const idle=()=>({mode:'music-assistant',device:{mode:'ready',amplifierEnabled:false,faults:[]},playback:{playing:false,connected:true},musicAssistant:{connected:true},activity:{localPlayback:false,localIndependent:true}});
const verified=()=>({status:'ready',phase:'ready',qualified:true,cable5AVerified:true,source:'HUSB238',volts:20,amps:5,watts:100,observedAt:10000,requestId:'a'.repeat(32)});
function fixture({state=idle(),result=verified(),serviceFails=false,qualified=false,failStartup=false,hardwareIdle=false}={}){
 const files=new Map(),calls=[],writes=[];
 if(qualified)files.set(proofPath,verified());
 const api=powerMonitoring({exists:p=>p===settingsPath?files.has(p):true,read:(p,fallback)=>files.has(p)?files.get(p):fallback,
  write:(p,v,mode)=>{writes.push({path:p,value:structuredClone(v),mode});files.set(p,structuredClone(v));},
  now:()=>10000,id:()=> 'a'.repeat(32),context:async()=>state,hardwareIdle:()=>hardwareIdle,
  run:async(program,args)=>{
   calls.push([program,args]);
   if(args[0]==='start'){
    if(result){files.set(runtime+'/result.json',result);if(result.qualified)files.set(proofPath,result);}
    if(serviceFails)throw Error('service failed');
   }
   if(failStartup&&args[0]==='enable'&&args.at(-1)==='daw-one-pd-startup.service')throw Error('policy failed');
  }});
 return {api,files,calls,writes};
}

test('PD protocol allows only an explicitly confirmed fixed 100 W setup',()=>{
 assert.deepEqual(validateRequest({command:'power-request-100w',args:confirmed}),{command:'power-request-100w',args:confirmed});
 for(const change of [{confirmed:false},{cable5AVerified:false},{startup:1},{volts:20},{amps:5},{address:8},{register:9},{reset:true},{path:'/etc/shadow'}])assert.throws(()=>validateRequest({command:'power-request-100w',args:{...confirmed,...change}}));
 assert.throws(()=>validateRequest({command:'power-request-100w'}));
 assert.equal(powerDefaults.startup100W,false);
 assert.throws(()=>powerSettings({startup100W:true}));
});
test('100 W setup is blocked during playback, grouping, capture, faults or disconnected state',()=>{
 assert.doesNotThrow(()=>assertPdRequestIdle(idle()));
 for(const mutate of [s=>s.playback.playing=true,s=>s.playback.connected=false,s=>s.musicAssistant.connected=false,s=>s.device.faults.push('fault'),s=>s.device.amplifierEnabled=true,s=>s.activity.localPlayback=true,s=>s.activity.localPlayback=null,s=>s.activity.roomMeasurement=true,s=>s.activity.syncCalibration=true,s=>s.activity.bluetoothActive=true,s=>s.activity.roomControl=true,s=>s.activity.localIndependent=false,s=>delete s.activity.localIndependent]){
  const s=idle();mutate(s);assert.throws(()=>assertPdRequestIdle(s));
 }
 assert.throws(()=>assertPdRequestIdle(null));
 assert.throws(()=>assertPdRequestIdle({...idle(),mode:'simulation'}));
 assert.doesNotThrow(()=>assertPdRequestIdle({...idle(),mode:'simulation'},true));
});
test('an authorized request verifies the nonce and actual contract while preserving INA wiring confirmations',async()=>{
 const f=fixture();f.files.set(settingsPath,{...powerDefaults,ina228:true,currentPathVerified:true});
 const value=await f.api.request100W(confirmed);
 assert.deepEqual(value.pd,{volts:20,amps:5,watts:100,verified:true});
 assert.deepEqual(value.settings,{...powerDefaults,ina228:true,husb238:true,currentPathVerified:true});
 assert.deepEqual(f.writes[0],{path:runtime+'/request.json',value:{id:'a'.repeat(32),confirmed:true,cable5AVerified:true,expiresAt:30000},mode:0o644});
 assert.deepEqual(f.calls,[['/usr/bin/systemctl',['start','daw-one-pd-request.service']],['/usr/bin/systemctl',['enable','--now','daw-one-power.service']]]);
});
test('automatic startup is saved only after verified negotiation and enable never requests power now',async()=>{
 const f=fixture();const value=await f.api.request100W({...confirmed,startup:true});
 assert.equal(value.settings.startup100W,true);assert.equal(value.pdQualified,true);
 assert.deepEqual(f.calls.at(-1),['/usr/bin/systemctl',['enable','daw-one-pd-startup.service']]);
 assert.equal(f.calls.filter(([,args])=>args[0]==='start').length,1);
});
test('a stale, different, unqualified or merely acknowledged result never claims success or saves policy',async()=>{
 for(const patch of [{requestId:'b'.repeat(32)},{observedAt:9999},{observedAt:11001},{observedAt:'10000'},{amps:1.25},{volts:5},{qualified:false},{source:'simulated'},{phase:'requesting'},{status:'error'},{cable5AVerified:false}]){
  const f=fixture({result:{...verified(),...patch}});
  await assert.rejects(f.api.request100W({...confirmed,startup:true}),/not confirmed/);
  assert.equal(f.files.has(settingsPath),false);assert.equal(f.calls.length,1);
 }
 for(const options of [{result:null},{serviceFails:true}]){
  const f=fixture(options);await assert.rejects(f.api.request100W(confirmed),/not confirmed/);assert.equal(f.files.has(settingsPath),false);
 }
});
test('worker failure reports its bounded error without queuing a second request',async()=>{
 const f=fixture({result:{...verified(),qualified:false,status:'error',phase:'failed',error:'The connected supply and cable do not offer a 20 V / 5 A profile'},serviceFails:true});
 await assert.rejects(f.api.request100W(confirmed),/do not offer/);assert.equal(f.calls.length,1);
});
test('ordinary save can enable monitoring but cannot opt into an unqualified startup request',async()=>{
 const f=fixture();await assert.rejects(f.api.configure({...powerDefaults,husb238:true,startup100W:true}),/successfully/);
 assert.equal(f.writes.length,0);assert.equal(f.calls.length,0);
 await f.api.configure({...powerDefaults,husb238:true});
 assert.deepEqual(f.calls,[['/usr/bin/systemctl',['enable','--now','daw-one-power.service']]]);
});
test('a rolled-back GUI can read and save its four reader settings without erasing the verified startup policy',async()=>{
 const f=fixture({qualified:true});f.files.set(settingsPath,{...powerDefaults,husb238:true,startup100W:true});
 const legacy={ina228:true,husb238:true,currentPathVerified:false,voltageSenseVerified:false};
 const request=validateRequest({command:'power-config',args:{settings:legacy}});
 assert.deepEqual(request.args.settings,legacy);
 const saved=powerResponse(await f.api.configure(request.args.settings));
 assert.deepEqual(saved.settings,legacy);assert.equal(saved.startup100W,true);
 assert.equal(f.calls.some(([,args])=>args.at(-1)==='daw-one-pd-startup.service'),false);
 await f.api.configure({...legacy,husb238:false});assert.equal(f.api.status().settings.startup100W,false);
});
test('interrupted setup remains visible and startup can be disabled without claiming hardware proof',async()=>{
 const f=fixture();f.files.set(proofPath,{phase:'requesting',qualified:false});
 f.files.set(settingsPath,{...powerDefaults,husb238:true,startup100W:true});
 assert.equal(f.api.status().lastPdRequest,'interrupted');assert.equal(f.api.status().pdQualified,false);
 await f.api.configure({...powerDefaults,husb238:true});
 assert.deepEqual(f.calls.at(-1),['/usr/bin/systemctl',['disable','daw-one-pd-startup.service']]);
 assert.equal(f.calls.some(([,args])=>args[0]==='start'),false);
});
test('startup enable failure restores the previous settings and opt-in without changing audio units',async()=>{
 const f=fixture({qualified:true,failStartup:true});
 await assert.rejects(f.api.configure({...powerDefaults,husb238:true,startup100W:true}),/Previous settings were restored/);
 assert.deepEqual(f.api.status().settings,powerDefaults);
 assert.deepEqual(f.calls.at(-1),['/usr/bin/systemctl',['disable','daw-one-pd-startup.service']]);
 assert.equal(f.calls.some(([,args])=>args.some(a=>/player|kiosk|music-assistant/.test(a))),false);
});
test('verified power and a failed policy save are reported as distinct outcomes',async()=>{
 const f=fixture({failStartup:true});
 await assert.rejects(f.api.request100W({...confirmed,startup:true}),/was confirmed, but.*could not be saved/);
 assert.equal(f.api.status().pdQualified,true);assert.equal(f.api.status().settings.startup100W,false);
 assert.equal(f.calls.filter(([,args])=>args[0]==='start').length,1);
});
test('the manager serializes power requests with audio mutations but allows read-only status',async()=>{
 let finish;const manager=new DeviceManager({perform:async command=>command==='power-status'?{readOnly:true}:new Promise(resolve=>{finish=resolve;})});
 const request=manager.request({command:'power-request-100w',args:confirmed});
 await assert.rejects(manager.request({command:'power-request-100w',args:confirmed}),/already running/);
 await assert.rejects(manager.request({command:'power-config',args:{settings:powerDefaults}}),/already running/);
 assert.deepEqual(await manager.request({command:'power-status'}),{readOnly:true});finish({saved:true});await request;
});
test('appliance wiring installs the dedicated worker and guards boot without live renegotiation',()=>{
 const install=readFileSync('deploy/install-power.sh','utf8'),manager=readFileSync('deploy/install-manager.sh','utf8'),root=readFileSync('deploy/manager/root-adapter.mjs','utf8');
 for(const file of ['pd_request.py','player_power_guard.py'])assert.ok(install.includes(file));
 assert.match(install,/d \/run\/daw-one-pd 0755 dawpower dawsensors/);
 assert.match(install,/Wants=daw-one-pd-startup.service\nAfter=daw-one-pd-startup.service/);
 assert.match(install,/RemainAfterExit=yes/);
 assert.doesNotMatch(install,/systemctl (?:start|restart|enable --now) daw-one-pd|systemctl (?:start|restart) tunebox-player/);
 assert.match(manager,/ReadWritePaths=[^\n]*\/run\/daw-one-pd/);
 assert.match(root,/\['power-config','power-request-100w',[^\n]*withUpdateLock/);
 assert.match(root,/command==='power-request-100w'.*bluetooth.active\(\).*measurement.status.*sync.status/s);
});
