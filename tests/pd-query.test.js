import test from 'node:test';
import assert from 'node:assert/strict';
import {powerMonitoring,powerResponse} from '../deploy/manager/power-telemetry.mjs';
import {powerDefaults,powerSettings,startupPowerKeys} from '../shared/power-settings.js';
import {offeredPdProfile,maximumPdQualified} from '../shared/pd-profile.js';
import {validateRequest,DeviceManager} from '../shared/device-manager.js';
import {readFileSync} from 'node:fs';

const settingsPath='/etc/daw-one-power/settings.json',proofPath='/var/lib/daw-one-power/qualification.json',runtime='/run/daw-one-pd';
const args={confirmed:true,amps:3,cable5AVerified:false,startup:false};
const proof=(amps=3,cable=amps>3)=>({status:'ready',phase:'ready',qualified:true,cable5AVerified:cable,source:'HUSB238',volts:20,amps,watts:20*amps,observedAt:10000,requestId:'a'.repeat(32),strategy:'maximum20v',sourceCapabilitiesQueried:true});
const idle=()=>({mode:'music-assistant',device:{mode:'ready',amplifierEnabled:false,faults:[]},playback:{playing:false,connected:true},musicAssistant:{connected:true},activity:{localPlayback:false,localIndependent:true}});
const discovered=(amps=5)=>({status:'discovered',requestId:'a'.repeat(32),observedAt:10000,sourceCapabilitiesQueried:true,pd:{status:'active',source:'HUSB238',responseCode:1,volts:20,amps:1.25,profiles:[{volts:20,amps,watts:20*amps}]}});
function fixture({result=discovered(),savedProof,context=idle(),serviceFails=false}={}){
 const files=new Map(),calls=[],writes=[];
 if(savedProof)files.set(proofPath,savedProof);
 const api=powerMonitoring({exists:p=>p===settingsPath?files.has(p):true,read:(p,f)=>files.get(p)??f,write:(p,v)=>{writes.push([p,structuredClone(v)]);files.set(p,structuredClone(v));},now:()=>10000,id:()=> 'a'.repeat(32),context:async()=>context,
  run:async(program,argv)=>{calls.push([program,argv]);if(argv[0]==='start'){files.set(runtime+'/result.json',result);if(result.qualified)files.set(proofPath,result);if(serviceFails)throw Error('failed');}}});
 return {api,files,calls,writes};
}
test('discovery is an explicit no-argument action and maximum requests retain strict confirmation validation',()=>{
 assert.deepEqual(validateRequest({command:'power-discover-20v'}),{command:'power-discover-20v',args:{}});
 for(const extra of [{reset:true},{volts:5},{confirmed:true},{amps:5},{path:'/dev/i2c-1'}])assert.throws(()=>validateRequest({command:'power-discover-20v',args:extra}));
 assert.deepEqual(validateRequest({command:'power-request-max20v',args}).args,args);
 for(const patch of [{amps:2},{amps:'5'},{amps:5},{volts:5},{confirmed:false},{strategy:'maximum20v'},{reset:true},{startup:1}])assert.throws(()=>validateRequest({command:'power-request-max20v',args:{...args,...patch}}));
 assert.doesNotThrow(()=>validateRequest({command:'power-request-max20v',args:{...args,amps:5,cable5AVerified:true}}));
});
test('fresh discovery returns the offered capacity separately from the unchanged active 25W contract',async()=>{
 const f=fixture(),s=await f.api.discover();
 assert.equal(s.sourceCapabilitiesQueried,true);assert.deepEqual(offeredPdProfile(s.discoveredPd),{volts:20,amps:5,watts:100});assert.equal(s.discoveredPd.amps,1.25);
 assert.deepEqual(f.writes,[[runtime+'/request.json',{id:'a'.repeat(32),operation:'discover',expiresAt:30000}]]);
 assert.deepEqual(f.calls,[['/usr/bin/systemctl',['start','daw-one-pd-request.service']]]);
 assert.equal(s.pdProfileQualified,false);assert.equal(f.files.has(settingsPath),false);
});
test('stale, rejected and malformed discovery cannot claim a queried source or queue a PDO request',async()=>{
 for(const patch of [{status:'ready'},{requestId:'b'.repeat(32)},{observedAt:9999},{sourceCapabilitiesQueried:false},{pd:{...discovered().pd,volts:5}},{pd:{...discovered().pd,responseCode:0}},{pd:{...discovered().pd,profiles:[]}}]){
  const f=fixture({result:{...discovered(),...patch}});await assert.rejects(f.api.discover(),/not confirmed/);assert.equal(f.calls.length,1);assert.equal(f.files.has(settingsPath),false);
 }
 const f=fixture({result:{...discovered(),status:'error',error:'The PD controller rejected the source-capability query'},serviceFails:true});await assert.rejects(f.api.discover(),/rejected/);assert.equal(f.calls.length,1);
});
test('discovery and maximum setup obey the playback and independent-room gates',async()=>{
 for(const mutate of [s=>s.playback.playing=true,s=>s.activity.localIndependent=false,s=>s.activity.bluetoothActive=true,s=>s.activity.roomMeasurement=true,s=>s.activity.syncCalibration=true]){
  const s=idle();mutate(s);const f=fixture({context:s});await assert.rejects(f.api.discover());await assert.rejects(f.api.requestMaximum20V(args));assert.equal(f.writes.length,0);assert.equal(f.calls.length,0);
 }
});
test('maximum setup persists only the new explicit policy after exact readback and never confirms INA wiring',async()=>{
 const f=fixture({result:proof(3,true)});f.files.set(settingsPath,{...powerDefaults,ina228:true,currentPathVerified:true});
 const s=await f.api.requestMaximum20V({...args,cable5AVerified:true,startup:true});
 assert.equal(s.settings.startupMaximum20V,true);assert.equal(s.settings.startup20V,false);assert.equal(s.settings.startup100W,false);assert.equal(s.settings.voltageSenseVerified,false);
 assert.deepEqual(f.writes[0],[runtime+'/request.json',{id:'a'.repeat(32),confirmed:true,cable5AVerified:true,expiresAt:30000,amps:3,strategy:'maximum20v'}]);
 assert.equal(s.maximumProfileQualified,true);assert.deepEqual(s.pd,{volts:20,amps:3,watts:60,verified:true});
 assert.deepEqual(f.calls.at(-1),['/usr/bin/systemctl',['enable','daw-one-pd-startup.service']]);
});
test('legacy or changed proof cannot opt into maximum startup or silently change cable authorization',async()=>{
 for(const patch of [{strategy:'exact'},{sourceCapabilitiesQueried:false},{amps:5,watts:100,cable5AVerified:true},{cable5AVerified:true}]){
  const f=fixture({result:{...proof(),...patch}});await assert.rejects(f.api.requestMaximum20V({...args,startup:true}),/not confirmed/);assert.equal(f.files.has(settingsPath),false);
 }
 const f=fixture({savedProof:{...proof(),strategy:'exact'}});await assert.rejects(f.api.configure({...powerDefaults,husb238:true,startupMaximum20V:true}),/Complete maximum/);assert.equal(f.writes.length,0);
});
test('all three startup policies are exclusive and an older GUI preserves the newer opt-in',async()=>{
 for(const a of startupPowerKeys)for(const b of startupPowerKeys)if(a!==b)assert.throws(()=>powerSettings({husb238:true,[a]:true,[b]:true}),/one/);
 const f=fixture({savedProof:proof()});f.files.set(settingsPath,{...powerDefaults,husb238:true,startupMaximum20V:true});
 const old={ina228:true,husb238:true,currentPathVerified:true,voltageSenseVerified:false,startup100W:false,startup20V:false};
 const s=powerResponse(await f.api.configure(validateRequest({command:'power-config',args:{settings:old}}).args.settings));
 assert.equal(s.startupMaximum20V,true);assert.equal(Object.keys(s.settings).length,4);
 assert.equal(f.calls.some(([,a])=>a.at(-1)==='daw-one-pd-startup.service'),false);
 await f.api.configure({...old,husb238:false});assert.equal(f.api.status().settings.startupMaximum20V,false);
 assert.deepEqual(f.calls.at(-1),['/usr/bin/systemctl',['disable','daw-one-pd-startup.service']]);
});
test('queries and maximum setup serialize against other hardware actions, while status stays readable',async()=>{
 let finish;const m=new DeviceManager({perform:async c=>c==='power-status'?{}:new Promise(r=>{finish=r;})});
 const p=m.request({command:'power-discover-20v'});await assert.rejects(m.request({command:'power-request-max20v',args}),/already running/);await assert.rejects(m.request({command:'power-config',args:{settings:powerDefaults}}),/already running/);
 assert.deepEqual(await m.request({command:'power-status'}),{});finish({});await p;
 const root=readFileSync('deploy/manager/root-adapter.mjs','utf8');assert.match(root,/\['power-config','power-request-100w','power-request-20v','power-discover-20v','power-request-max20v'.*withUpdateLock/s);
});
test('ambiguous source offers and fake maximum qualification are rejected',()=>{
 assert.equal(offeredPdProfile({...discovered().pd,profiles:[{volts:20,amps:3},{volts:20,amps:5}]}),null);
 assert.equal(maximumPdQualified(proof()),true);assert.equal(maximumPdQualified({...proof(),sourceCapabilitiesQueried:false}),false);
});
