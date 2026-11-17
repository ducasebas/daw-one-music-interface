import test from 'node:test';
import assert from 'node:assert/strict';
import {powerTelemetry,readPowerFile} from '../server/power-telemetry.js';
import {mkdtempSync,rmSync,writeFileSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {powerStatus} from '../shared/power-status.js';
import {powerDefaults,powerSettings} from '../shared/power-settings.js';
import {powerMonitoring} from '../deploy/manager/power-telemetry.mjs';
import {HostTelemetry} from '../server/host-telemetry.js';
import {settingsAttention} from '../shared/interface.js';
import {wallNotifications} from '../shared/wall.js';
import {validateRequest,DeviceManager} from '../shared/device-manager.js';
const now=10000;
function frame({volts=20,amps=2,contractAmps=5}={}){return {schema:2,observedAt:now,
 ina228:{status:'ok',source:'INA228',observedAt:now,volts,amps,watts:999,shuntOhms:.015,calibration:'nominal-shunt',dieTemperatureC:25},
 pd:{status:'active',source:'HUSB238',observedAt:now,attached:true,volts:20,amps:contractAmps,watts:999,responseCode:0,selectedVolts:20,profiles:[{volts:5,amps:3},{volts:20,amps:5}]}};}
test('INA consumption, PD contract and offered profiles are distinct and powers are recomputed',()=>{
 const p=powerTelemetry(frame({contractAmps:3}),now);
 assert.equal(p.watts,40);assert.equal(p.contractWatts,60);assert.equal(p.pd.profiles[1].watts,100);assert.equal(p.ina228.source,'INA228');assert.equal(p.simulated,false);
 assert.equal(powerStatus(p,100,now).reason,'capacity-low');
 assert.equal(powerStatus(powerTelemetry(frame({amps:.2}),now),100,now).severity,'ok');
});
test('zero measured load is a reading while absent or stale data is never a fabricated zero',()=>{
 assert.equal(powerTelemetry(frame({amps:0}),now).watts,0);
 assert.equal(powerTelemetry(frame(),now+7000),null);assert.equal(powerTelemetry(frame(),now-1001),null);
 const f=frame();f.ina228={status:'error',observedAt:now,error:'i2c-unavailable'};
 assert.equal(powerTelemetry(f,now).watts,null);assert.equal(powerTelemetry(f,now).contractWatts,100);
 f.pd.observedAt=100;assert.equal(powerTelemetry(f,now).contractWatts,null);
});
test('wrong source, unverified scaling, nonfinite values and unsupported contracts are rejected',()=>{
 for(const patch of [{source:'INA219'},{shuntOhms:.1},{calibration:'assumed'},{amps:NaN},{volts:Infinity}]){
  const f=frame();Object.assign(f.ina228,patch);assert.equal(powerTelemetry(f,now).watts,null);
 }
 for(const patch of [{source:'other'},{amps:3.2},{volts:48},{attached:false}]){
  const f=frame();Object.assign(f.pd,patch);assert.equal(powerTelemetry(f,now).contractWatts,null);
 }
});
test('detach clears an old contract and profiles never inherit untrusted reported powers',()=>{
 const f=frame();f.pd.status='detached';f.pd.attached=false;
 const value=powerTelemetry(f,now);assert.equal(value.contractWatts,null);assert.equal(value.pd.volts,undefined);assert.deepEqual(value.pd.profiles,[]);assert.equal(value.pd.selectedVolts,null);
 const next=frame();next.pd.profiles=[{volts:20,amps:5,watts:300},{volts:20,amps:3},{volts:48,amps:5}];
 assert.deepEqual(powerTelemetry(next,now).pd.profiles,[{volts:20,amps:5,watts:100}]);
});
test('voltage sense mismatch and reversed current cannot masquerade as a healthy power reading',()=>{
 const p=powerTelemetry(frame({volts:0}),now);assert.equal(p.watts,null);assert.equal(p.voltageMismatch,true);assert.equal(powerStatus(p,100,now).reason,'voltage-mismatch');
 const reverse=powerTelemetry(frame({amps:-2}),now);assert.equal(reverse.amps,-2);assert.equal(powerStatus(reverse,100,now).reason,'reverse-current');
 assert.equal(powerStatus(powerTelemetry(frame({amps:-.00001}),now),100,now).severity,'ok');
});
test('legacy external telemetry remains bounded and keeps its five-second expiry',()=>{
 const legacy={schema:1,observedAt:now,volts:20,amps:.2,watts:4,contractWatts:100};
 assert.equal(powerTelemetry(legacy,now).watts,4);assert.equal(powerTelemetry(legacy,now+5000),null);
 assert.equal(powerStatus(powerTelemetry(legacy,now),100,now+5000).severity,'unknown');
 assert.equal(powerTelemetry({...legacy,watts:'4',contractWatts:Infinity},now).watts,null);
});
test('host sampler reads the runtime file without device access and expires stopped readers',()=>{
 let time=now;const host=new HostTelemetry({now:()=>time,readFile:path=>path==='/run/daw-one-power/readings.json'?JSON.stringify(frame()):'',files:()=>[],execute:(_p,_a,_o,callback)=>callback(Error('not installed'))});
 assert.equal(host.value.power.contractWatts,100);assert.equal(host.value.power.watts,40);
 time+=7000;assert.equal(host.sample().power,null);
});
test('power attention links to Sensors and consumption alone never produces a low-PD warning',()=>{
 const snapshot={hostTelemetry:{power:powerTelemetry(frame({contractAmps:3}),now)},preferences:{dashboard:{requiredWatts:100}}};
 const item=settingsAttention(snapshot,{},{},now).find(i=>i.id==='power');assert.equal(item.section,'sensors');assert.equal(item.title,'Power supply below requirement');
 snapshot.hostTelemetry.power=powerTelemetry(frame({amps:.01}),now);assert.equal(settingsAttention(snapshot,{},{},now).some(i=>i.id==='power'),false);
 assert.equal(settingsAttention(snapshot,{},{},now+7000).some(i=>i.id==='power'),false);
});
test('hardware notification follows the live contract, required setting, faults and freshness',()=>{
 const snapshot={mode:'music-assistant',device:{faults:[]},hostTelemetry:{power:powerTelemetry(frame(),now)},preferences:{dashboard:{requiredWatts:100}}};
 const row=(offline=false,time=now)=>wallNotifications(snapshot,{},offline,time).find(r=>r.id==='hardware');
 assert.equal(row().attention,false);assert.equal(row().detail,'PD capacity meets requirement');assert.equal(row().action,'sensors');
 snapshot.hostTelemetry.power=powerTelemetry(frame({contractAmps:3}),now);
 assert.equal(row().attention,true);assert.equal(row().detail,'Power supply below requirement');
 snapshot.preferences.dashboard.requiredWatts=60;assert.equal(row().attention,false);
 assert.equal(row(true).attention,true);assert.match(row(false,now+7000).detail,/unavailable/);
 snapshot.device.faults=['thermal-alarm'];assert.equal(row().detail,'thermal-alarm');assert.equal(row().attention,true);
});
test('power protocol accepts only reader booleans, never voltages, addresses, paths or shell arguments',()=>{
 const valid={ina228:true,husb238:true,currentPathVerified:true,voltageSenseVerified:true};
 assert.deepEqual(validateRequest({command:'power-config',args:{settings:valid}}).args.settings,valid);
 for(const patch of [{requestVolts:20},{address:8},{path:'/etc/shadow'},{ina228:'yes'},{husb238:1}])assert.throws(()=>powerSettings({...valid,...patch}));
 assert.throws(()=>validateRequest({command:'power-config',args:{settings:valid,voltage:20}}));
 assert.throws(()=>validateRequest({command:'power-status',args:{address:8}}));
});
test('runtime file access is bounded and refuses symbolic links, directories and missing files',()=>{
 const dir=mkdtempSync(join(tmpdir(),'tunebox-power-read-'));
 try{
  const file=join(dir,'readings.json'),link=join(dir,'link');
  writeFileSync(file,'{"schema":2}');symlinkSync(file,link);
  assert.equal(readPowerFile(file),'{"schema":2}');assert.equal(readPowerFile(link),'');assert.equal(readPowerFile(dir),'');assert.equal(readPowerFile(join(dir,'missing')),'');
  writeFileSync(file,'x'.repeat(16385));assert.equal(readPowerFile(file),'');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('an unreadable existing configuration is an error rather than an invented disabled state',()=>{
 const f=powerMonitoring({exists:()=>true,read:(_path,fallback)=>fallback});assert.equal(f.status().settings,null);assert.equal(f.status().error,'Power configuration is unavailable');
});
function controller(){const files=new Map(),calls=[];let fail=false;const api=powerMonitoring({exists:path=>path!=='/etc/daw-one-power/settings.json'||files.has(path),read:(path,fallback)=>files.get(path)||fallback,write:(path,value)=>files.set(path,structuredClone(value)),run:async(program,args)=>{calls.push([program,args]);if(fail&&args[0]==='enable')throw Error('unit failed');}});return {api,calls,fail:()=>{fail=true;}};}
test('enabling monitoring only changes its reader service; hardware PD commands are absent',async()=>{
 const f=controller(),settings={...powerDefaults,ina228:true,husb238:true};
 assert.equal((await f.api.configure(settings)).saved,true);assert.deepEqual(f.api.status().settings,settings);
 assert.deepEqual(f.calls,[['/usr/bin/systemctl',['enable','--now','daw-one-power.service']]]);
});
test('reader activation failure restores the previous configuration and service preference',async()=>{
 const f=controller();f.fail();await assert.rejects(f.api.configure({...powerDefaults,ina228:true}),/Previous settings were restored/);
 assert.deepEqual(f.api.status().settings,powerDefaults);assert.deepEqual(f.calls.at(-1),['/usr/bin/systemctl',['disable','--now','daw-one-power.service']]);
});
test('read-only power status remains available while another manager action is busy',async()=>{
 let release;const manager=new DeviceManager({perform:async command=>command==='power-status'?{supported:true}:new Promise(r=>{release=r;})});
 const active=manager.request({command:'power-config',args:{settings:{}}});assert.deepEqual(await manager.request({command:'power-status'}),{supported:true});release({saved:true});await active;
});
