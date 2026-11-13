import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {networkStatus,assertConnectionChange,networkController} from '../deploy/manager/network.mjs';
import {DeviceManager,validateRequest} from '../shared/device-manager.js';
import {canUpdate} from '../deploy/ota/policy.mjs';
import {PreferencesStore} from '../server/preferences-store.js';
const state={mode:'music-assistant',device:{mode:'ready',amplifierEnabled:false,faults:[]},musicAssistant:{connected:false},playback:{connected:false,playing:false}};
test('Ethernet is an existing local connection even when Wi-Fi is disconnected',async()=>{
 const calls=[];const status=await networkStatus({run:async(p,a)=>{calls.push([p,a]);return 'eth0:ethernet:connected\nwlan0:wifi:disconnected\nlo:loopback:connected (externally)\n';}});
 assert.equal(status.connected,true);assert.equal(status.type,'ethernet');assert.equal(status.interface,'eth0');assert.equal(status.wifiConnected,false);assert.equal(status.signal,null);assert.equal(calls.length,1);assert.equal(status.simulated,false);
});
test('Wi-Fi status retains an escaped SSID when iw is unavailable and never fabricates signal',async()=>{
 const run=async(p,a)=>{if(p.endsWith('/iw'))throw Error('not installed');if(a.includes('DEVICE,TYPE,STATE'))return 'wlan0:wifi:connected\n';return '*:83:Room\\:one\n';};
 const s=await networkStatus({run});assert.equal(s.connected,true);assert.equal(s.type,'wifi');assert.equal(s.ssid,'Room:one');assert.equal(s.signal,83);
 const unknown=await networkStatus({run:async()=>{throw Error('no manager');}});assert.equal(unknown.connected,null);assert.equal(unknown.signal,null);
});
test('a device without Wi-Fi can continue using Ethernet without a failing scan',async()=>{
 const calls=[];const n=networkController({run:async(p,a)=>{calls.push(a);return 'eth0:ethernet:connected\n';}});const s=await n.scan('wlan0');assert.equal(s.supported,false);assert.deepEqual(s.networks,[]);assert.equal(calls.length,1);
});
test('network and server recovery do not require Music Assistant connectivity or OTA readiness',()=>{
 assert.equal(canUpdate(state),false);assert.doesNotThrow(()=>assertConnectionChange(state));assert.doesNotThrow(()=>assertConnectionChange(state,{kind:'music'}));
 assert.throws(()=>assertConnectionChange({...state,playback:{playing:true}}),/Confirm/);
 assert.doesNotThrow(()=>assertConnectionChange({...state,playback:{playing:true}},{confirmed:true}));
 assert.throws(()=>assertConnectionChange({...state,activity:{roomMeasurement:true}},{confirmed:true}),/room measurement/);
 assert.throws(()=>assertConnectionChange({...state,device:{mode:'shutting-down'}},{confirmed:true}),/shutdown/);
 assert.throws(()=>assertConnectionChange(null,{confirmed:true}),/unavailable/);
});
test('connection confirmation is boolean and never broadens the device command protocol',()=>{
 assert.equal(validateRequest({command:'wifi',args:{interface:'wlan0',ssid:'Studio',password:'testpass',confirmed:true}}).args.confirmed,true);
 for(const confirmed of ['yes',1,null])assert.throws(()=>validateRequest({command:'wifi',args:{interface:'wlan0',ssid:'Studio',password:'testpass',confirmed}}));
 assert.throws(()=>validateRequest({command:'wifi',args:{interface:'wlan0',ssid:'Studio',password:'testpass',confirmed:true,exec:'anything'}}));
});
test('network status polling does not hold the mutation lock or make scan/join randomly busy',async()=>{
 let release;const pending=new Promise(r=>release=r);const m=new DeviceManager({status:()=>({}),perform:(c)=>c==='network'?{connected:true}:pending});
 const mutation=m.request({command:'check'});assert.deepEqual(await m.request({command:'network'}),{connected:true});await assert.rejects(m.request({command:'wifi-scan'}),/already running/);release({queued:true});await mutation;assert.equal(m.busy,false);
});
test('deferred setup persists separately from completion, survives preference reset and clears on factory reset',()=>{
 const dir=mkdtempSync(join(tmpdir(),'tb-deferred-'));
 try{const store=new PreferencesStore(dir);const saved=store.save(0,{setupDeferred:true});assert.equal(saved.setupCompleted,false);assert.equal(new PreferencesStore(dir).get().setupDeferred,true);assert.equal(store.reset().setupDeferred,true);const factory=store.reset({setup:true});assert.equal(factory.setupDeferred,false);assert.equal(factory.setupCompleted,false);assert.throws(()=>store.save(factory.revision,{setupDeferred:'true'}));}finally{rmSync(dir,{recursive:true,force:true});}
});

test('a failed Wi-Fi switch removes only its candidate and restores the prior connection',async()=>{
 const previous='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',files=new Map([['previous-profile','keep']]),calls=[];
 const network=networkController({write:(p,v)=>files.set(p,v),remove:p=>files.delete(p),run:async(p,a)=>{
  calls.push(a);if(a.includes('DEVICE,TYPE,STATE'))return 'wlan0:wifi:connected\n';if(a.includes('GENERAL.CON-UUID'))return previous;
  if(a.includes('up')&&a.includes('uuid')&&!a.includes(previous))throw Error('wrong password');return '';
 }});
 await assert.rejects(network.connect({interface:'wlan0',ssid:'New network',password:'testpass'}),/previous profiles were retained/);
 assert.deepEqual([...files],[['previous-profile','keep']]);assert.ok(calls.some(a=>a.join(' ')==='connection up uuid '+previous));
});
