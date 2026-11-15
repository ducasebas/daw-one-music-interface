import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateRequest} from '../shared/device-manager.js';
import {bluetoothGainChanges} from '../shared/bluetooth.js';
import {bluetoothController} from '../deploy/manager/bluetooth.mjs';
import {bluetoothState} from '../server/bluetooth-state.js';
import {canUpdate} from '../deploy/ota/policy.mjs';
import {audioArguments,approvedPhones} from '../deploy/bluetooth/audio.mjs';
const gains=()=>[{id:2,name:'Channel Left Gain',type:'INTEGER',min:-110,max:0,value:-6},{id:3,name:'Channel Right Gain',type:'INTEGER',min:-110,max:0,value:-6}];
test('receiver never starts with an empty or wildcard MAC list and plays only approved peers',()=>{
 assert.equal(audioArguments([]),null);assert.equal(audioArguments(['00:00:00:00:00:00','FF:FF:FF:FF:FF:FF','--pcm=other']),null);
 const args=audioArguments(['AA:BB:CC:DD:EE:FF','AA:BB:CC:DD:EE:FF']);assert.deepEqual(args.slice(-1),['AA:BB:CC:DD:EE:FF']);assert.ok(args.includes('--volume=software'));assert.ok(args.includes('--pcm=plughw:CARD=LouderRaspberry,DEV=0'));assert.deepEqual(approvedPhones({}),[]);
});
function fixture(){
 const files=new Map([['config',{verified:true,output:'plughw:CARD=LouderRaspberry,DEV=0'}]]),calls=[],controls=gains();let failRestore=false;
 const dsp={get:async()=>({supported:true,controls,faults:[]}),set:async changes=>{calls.push(['gain',...changes.map(c=>c.value)]);if(failRestore&&changes.every(c=>c.value===-6))throw Error('Unavailable');for(const c of changes)controls.find(v=>v.id===c.id).value=c.value;}};
 const bt=bluetoothController({directory:'/runtime',journal:'journal',configuration:'config',read:(p,f)=>files.get(p)??f,write:(p,v)=>files.set(p,structuredClone(v)),remove:p=>files.delete(p),run:async(p,a)=>{calls.push([p,...a]);return a[0]==='is-active'&&a[1]==='tunebox-player.service'?'active':'';},dsp});
 return {bt,files,calls,controls,failRestore:()=>{failRestore=true;}};
}
test('Bluetooth starts muted before stopping the local player and retains EQ headroom',async()=>{
 const f=fixture();await f.bt.start(40);const saved=f.files.get('journal');assert.equal(f.files.get('/runtime/source.json').active,true);assert.deepEqual(f.calls.find(c=>c[0]==='gain'),['gain',-110,-110]);
 assert.ok(f.calls.findIndex(c=>c[0]==='gain')<f.calls.findIndex(c=>c.includes('stop')));
 assert.deepEqual(saved.units,['tunebox-player.service']);assert.ok(!JSON.stringify(f.calls).includes('Rivo'));
 await f.bt.volume(40,40,saved.sessionId);assert.deepEqual(f.controls.map(c=>c.value),[-42,-42]);
 await assert.rejects(f.bt.volume(41,40,saved.sessionId));await assert.rejects(f.bt.volume(10,40,'old-source'));
 await f.bt.stop();assert.deepEqual(f.controls.map(c=>c.value),[-6,-6]);assert.equal(f.files.has('journal'),false);assert.ok(f.calls.some(c=>c[0]==='/usr/bin/systemctl'&&c[1]==='start'&&c[2]==='tunebox-player.service'));
});
test('Bluetooth failed restore preserves the journal and cannot reopen Squeezelite',async()=>{
 const f=fixture();await f.bt.start(40);f.calls.length=0;f.failRestore();await assert.rejects(f.bt.stop());assert.ok(f.files.has('journal'));assert.equal(f.calls.some(c=>c[1]==='start'&&c[2]==='tunebox-player.service'),false);
});
test('Bluetooth pairing accepts only an unexpired matching request and bounded arguments',async()=>{
 const f=fixture();await assert.rejects(f.bt.pair());await f.bt.start(40);
 f.files.set('/runtime/pairing.json',{nonce:'a'.repeat(32),expiresAt:Date.now()+1000});await assert.rejects(f.bt.confirm({nonce:'b'.repeat(32),accept:true}));await f.bt.confirm({nonce:'a'.repeat(32),accept:false});assert.equal(f.files.get('/runtime/decision.json').accept,false);
 for(const input of [{command:'bluetooth-start',args:{confirmed:false}},{command:'bluetooth-forget',args:{address:'00:11:22:33:44:55',confirmed:false}},{command:'bluetooth-disconnect',args:{address:'; rm -rf /'}},{command:'bluetooth-confirm',args:{nonce:'x',accept:true}},{command:'bluetooth-volume',args:{value:100,sessionId:'old'}}])assert.throws(()=>validateRequest(input));
 assert.throws(()=>bluetoothGainChanges(gains(),gains(),100,40));
});
test('Bluetooth telemetry expires without implicitly switching or exposing raw BlueZ fields',()=>{
 const dir=mkdtempSync(join(tmpdir(),'tunebox-bluetooth-'));try{
  writeFileSync(join(dir,'config'),JSON.stringify({verified:true}));writeFileSync(join(dir,'source.json'),JSON.stringify({active:true,volume:0,limit:40}));
  writeFileSync(join(dir,'telemetry.json'),JSON.stringify({available:true,observedAt:100,devices:[{address:'AA:BB:CC:DD:EE:FF',name:'Phone\u0000',connected:true,token:'private'}]}));
  const fresh=bluetoothState({directory:dir,configuration:join(dir,'config'),now:100});assert.equal(fresh.devices[0].name,'Phone');assert.equal(JSON.stringify(fresh).includes('private'),false);
  const stale=bluetoothState({directory:dir,configuration:join(dir,'config'),now:11000});assert.equal(stale.active,true);assert.equal(stale.available,false);assert.deepEqual(stale.devices,[]);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('OTA does not interrupt a selected Bluetooth source, including a paused phone',()=>{
 const s={mode:'simulation',device:{mode:'ready',faults:[],amplifierEnabled:false},playback:{playing:false},activity:{bluetoothActive:true}};assert.equal(canUpdate(s),false);s.activity.bluetoothActive=false;assert.equal(canUpdate(s),true);
});
