import test from 'node:test';
import assert from 'node:assert/strict';
import {offeredPdProfile,qualifiedPdProfile,pdRequestAmps} from '../shared/pd-profile.js';
import {validateRequest,DeviceManager} from '../shared/device-manager.js';
import {powerDefaults,powerSettings} from '../shared/power-settings.js';
import {powerMonitoring,powerResponse} from '../deploy/manager/power-telemetry.mjs';
import {existsSync,readFileSync} from 'node:fs';
const settingsPath='/etc/daw-one-power/settings.json',proofPath='/var/lib/daw-one-power/qualification.json',runtime='/run/daw-one-pd';
const args={confirmed:true,amps:3,cable5AVerified:false,startup:false};
const proof=(amps=3)=>({status:'ready',phase:'ready',qualified:true,cable5AVerified:amps>3,source:'HUSB238',volts:20,amps,watts:20*amps,observedAt:10000,requestId:'a'.repeat(32)});
const state=()=>({mode:'music-assistant',device:{mode:'ready',amplifierEnabled:false,faults:[]},playback:{playing:false,connected:true},musicAssistant:{connected:true},activity:{localPlayback:false,localIndependent:true}});
function fixture({result=proof(),savedProof,failStartup=false,context=state()}={}){
 const files=new Map(),calls=[],writes=[];
 if(savedProof)files.set(proofPath,savedProof);
 const api=powerMonitoring({exists:p=>p===settingsPath?files.has(p):true,read:(p,f)=>files.get(p)??f,
  write:(p,v)=>{writes.push([p,structuredClone(v)]);files.set(p,structuredClone(v));},now:()=>10000,id:()=> 'a'.repeat(32),context:async()=>context,
  run:async(program,argv)=>{calls.push([program,argv]);if(argv[0]==='start'&&result){files.set(runtime+'/result.json',result);if(result.qualified)files.set(proofPath,result);}if(failStartup&&argv[0]==='enable'&&argv.at(-1)==='daw-one-pd-startup.service')throw Error('could not enable');}});
 return {api,files,calls,writes};
}
test('the observed 25W active / 60W offered source selects an honest 60W target',()=>{
 const pd={status:'active',volts:20,amps:1.25,profiles:[{volts:5,amps:3},{volts:20,amps:3}]};
 assert.deepEqual(offeredPdProfile(pd),{volts:20,amps:3,watts:60});
 for(const change of [{status:'changing'},{volts:5},{profiles:[]},{profiles:[{volts:20,amps:1.25}]},{profiles:[{volts:20,amps:'3'}]}])assert.equal(offeredPdProfile({...pd,...change}),null);
});
test('only fixed-20V offered-current candidates can enter the request protocol',()=>{
 for(const amps of pdRequestAmps)assert.deepEqual(validateRequest({command:'power-request-20v',args:{...args,amps,cable5AVerified:amps>3}}).args,{...args,amps,cable5AVerified:amps>3});
 for(const patch of [{amps:1.25},{amps:2},{amps:3.1},{amps:6},{amps:'3'},{amps:true},{amps:NaN},{amps:Infinity},{volts:9},{address:8},{register:9},{path:'/etc/shadow'},{reset:true},{confirmed:false},{startup:1},{cable5AVerified:1},{amps:5,cable5AVerified:false}])assert.throws(()=>validateRequest({command:'power-request-20v',args:{...args,...patch}}));
 assert.throws(()=>validateRequest({command:'power-request-20v'}));
});
test('a 60W proof does not claim cable certification or 100W qualification',()=>{
 assert.equal(qualifiedPdProfile(proof()),true);
 for(const p of [{watts:100},{amps:5},{status:'error'},{phase:'requesting'},{source:'external'},{cable5AVerified:0},{qualified:false}])assert.equal(qualifiedPdProfile({...proof(),...p}),false);
 const f=fixture({savedProof:proof()});assert.equal(f.api.status().pdProfileQualified,true);assert.equal(f.api.status().pdQualified,false);
 assert.deepEqual(f.api.status().verifiedProfile,{volts:20,amps:3,watts:60});
});
test('a verified 60W request preserves INA settings and keeps startup off by default',async()=>{
 const f=fixture();f.files.set(settingsPath,{...powerDefaults,ina228:true,currentPathVerified:true});
 const s=await f.api.request20V(args);
 assert.deepEqual(s.pd,{volts:20,amps:3,watts:60,verified:true});
 assert.equal(s.settings.currentPathVerified,true);assert.equal(s.settings.voltageSenseVerified,false);
 assert.equal(s.settings.startup20V,false);assert.equal(s.settings.startup100W,false);
 assert.deepEqual(f.writes[0],[runtime+'/request.json',{id:'a'.repeat(32),confirmed:true,cable5AVerified:false,expiresAt:30000,amps:3}]);
 assert.equal(f.calls.filter(([,a])=>a[0]==='start').length,1);
});
test('60W startup opt-in requires verification and is separate from legacy 100W policy',async()=>{
 const f=fixture();await assert.rejects(f.api.configure({...powerDefaults,husb238:true,startup20V:true}),/Verify/);assert.equal(f.writes.length,0);
 const result=await f.api.request20V({...args,startup:true});
 assert.equal(result.settings.startup20V,true);assert.equal(result.settings.startup100W,false);
 assert.deepEqual(f.calls.at(-1),['/usr/bin/systemctl',['enable','daw-one-pd-startup.service']]);
 assert.equal(f.calls.some(([,a])=>a.some(x=>/player|kiosk/.test(x))),false);
});
test('different current, forged watts, old nonce and missing confirmation cannot qualify a request',async()=>{
 for(const patch of [{amps:5,watts:100,cable5AVerified:true},{amps:1.25,watts:25},{watts:100},{requestId:'b'.repeat(32)},{observedAt:9999},{status:'error'},{qualified:false}]){
  const f=fixture({result:{...proof(),...patch}});await assert.rejects(f.api.request20V({...args,startup:true}),/not confirmed/);
  assert.equal(f.files.has(settingsPath),false);assert.equal(f.calls.length,1);
 }
 for(const patch of [{confirmed:false},{amps:5,cable5AVerified:false},{amps:2},{cable5AVerified:undefined}]){const f=fixture();await assert.rejects(f.api.request20V({...args,...patch}),/Confirm/);assert.equal(f.calls.length,0);}
});
test('legacy 100W requests cannot be satisfied by a valid 60W result',async()=>{
 const f=fixture();await assert.rejects(f.api.request100W({confirmed:true,cable5AVerified:true,startup:true}),/not confirmed/);
 assert.equal(f.files.has(settingsPath),false);
});
test('older GUI saves retain the newer startup choice while power responses keep four reader keys',async()=>{
 const f=fixture({savedProof:proof()});f.files.set(settingsPath,{...powerDefaults,husb238:true,startup20V:true});
 const old={ina228:true,husb238:true,currentPathVerified:true,voltageSenseVerified:false,startup100W:false};
 const request=validateRequest({command:'power-config',args:{settings:old}});assert.equal(Object.hasOwn(request.args.settings,'startup20V'),false);
 const saved=powerResponse(await f.api.configure(request.args.settings));
 assert.equal(saved.startup20V,true);assert.equal(saved.startup100W,false);assert.equal(saved.pdQualified,false);
 assert.deepEqual(Object.keys(saved.settings).sort(),['currentPathVerified','husb238','ina228','voltageSenseVerified']);
 assert.equal(f.calls.some(([,a])=>a.at(-1)==='daw-one-pd-startup.service'),false);
 await f.api.configure({ina228:true,husb238:false,currentPathVerified:true,voltageSenseVerified:false});
 assert.equal(f.api.status().settings.startup20V,false);assert.deepEqual(f.calls.at(-1),['/usr/bin/systemctl',['disable','daw-one-pd-startup.service']]);
});
test('both automatic policies cannot be enabled and legacy/new choices remain individually valid',()=>{
 assert.throws(()=>powerSettings({husb238:true,startup100W:true,startup20V:true}),/one/);
 assert.throws(()=>powerSettings({startup20V:true}),/monitoring/);
 assert.equal(powerSettings({husb238:true,startup20V:true}).startup100W,false);
});
test('failed startup-policy persistence keeps verified capacity separate from saved settings',async()=>{
 const f=fixture({failStartup:true});await assert.rejects(f.api.request20V({...args,startup:true}),/was confirmed, but/);
 assert.equal(f.api.status().verifiedProfile.watts,60);assert.equal(f.api.status().settings.startup20V,false);
 assert.deepEqual(f.calls.at(-1),['/usr/bin/systemctl',['disable','daw-one-pd-startup.service']]);
});
test('new power requests use the existing busy gate and deployment includes the shared profile policy',async()=>{
 let finish;const m=new DeviceManager({perform:async c=>c==='power-status'?{}:new Promise(r=>{finish=r;})});
 const p=m.request({command:'power-request-20v',args});await assert.rejects(m.request({command:'power-request-100w',args:{confirmed:true,cable5AVerified:true,startup:false}}),/already running/);
 assert.deepEqual(await m.request({command:'power-status'}),{});finish({});await p;
 const install=readFileSync('deploy/install-manager.sh','utf8'),root=readFileSync('deploy/manager/root-adapter.mjs','utf8');
 // 3.16.3: every shared module is installed (shared/*.js), so the profile policy always travels with the manager.
 assert.match(install,/"\$repo"\/shared\/\*\.js "\$stage\/shared\/"/);assert.ok(existsSync('shared/pd-profile.js')&&existsSync('shared/power-settings.js'));
 assert.match(root,/\['power-config','power-request-100w','power-request-20v'/);
});
