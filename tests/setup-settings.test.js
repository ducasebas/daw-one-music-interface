import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DeviceSecurity} from '../server/security.js';
import {PreferencesStore} from '../server/preferences-store.js';
import {preferenceDefaults,validatePreferences} from '../shared/preferences.js';
import {networkController,splitNm} from '../deploy/manager/network.mjs';
import {clockController} from '../deploy/manager/clock.mjs';
import {dspController,parseDsp} from '../deploy/manager/dsp.mjs';
import {presenceReading} from '../server/presence.js';
import {validateRequest} from '../shared/device-manager.js';
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},getHeader(k){return this.headers[k];}});
const request=(r)=>({headers:{cookie:r?.headers?.['Set-Cookie']?.split(';')[0]||''}});
function directory(){return mkdtempSync(join(tmpdir(),'tb-setup-'));}

test('PIN is hashed, cookie authority expires, lockout survives restart, corrupt security fails closed',()=>{
 const dir=directory();let now=1000000;
 try{const security=new DeviceSecurity(dir,{now:()=>now}),r=response();security.setPin('572941','572941',request(),r);const raw=readFileSync(join(dir,'security.json'),'utf8');assert.equal(raw.includes('572941'),false);assert.match(r.headers['Set-Cookie'],/HttpOnly; SameSite=Strict/);assert.equal(security.status(request(r)).unlocked,true);assert.throws(()=>security.requireAdmin(request()),/Unlock/);now+=300001;assert.equal(security.status(request(r)).unlocked,false);
 for(let i=0;i<5;i++)assert.throws(()=>security.unlock('123456',request(),response()),/Incorrect/);
 const restart=new DeviceSecurity(dir,{now:()=>now});assert.equal(restart.status(request()).remainingSeconds,300);assert.throws(()=>restart.unlock('572941',request(),response()),/Too many/);now+=300001;restart.unlock('572941',request(),r);assert.equal(restart.status(request(r)).unlocked,true);
 const pair=restart.createPair(),phone=response();restart.pair(pair,phone);assert.equal(restart.status(request(phone)).role,'provision');assert.throws(()=>restart.requireAdmin(request(phone)),/Unlock/);assert.throws(()=>restart.pair(pair,response()),/already used/);
 writeFileSync(join(dir,'security.json'),'{broken');const bad=new DeviceSecurity(dir);assert.equal(bad.status(request()).recoveryRequired,true);assert.throws(()=>bad.requireAdmin(request()),/recovery/);assert.throws(()=>bad.setPin('572941','572941',request(),response()),/recovery/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('central settings persist atomically, reject concurrent edits and restore defaults without erasing setup',()=>{
 const dir=directory();try{const store=new PreferencesStore(dir);const initial=store.get();const draft=store.save(initial.revision,{prefs:{startupAnimation:'off',screen:{extended:true,mode:'vu',leftColor:'#ab1234'}},setupCompleted:true,presence:{...initial.presence,enabled:true,sensitivity:'high'}});assert.equal(draft.prefs.screen.mode,'vu');assert.equal(new PreferencesStore(dir).get().prefs.startupAnimation,'off');assert.throws(()=>store.save(0,{language:'nl'}),/another screen/);const restored=store.reset();assert.equal(restored.prefs.startupAnimation,'auto');assert.equal(restored.setupCompleted,true);assert.equal(restored.presence.enabled,false);assert.throws(()=>validatePreferences({...preferenceDefaults(),clock:{timeZone:'Invalid/Zone',hour12:false,automatic:true}}),/time zone/);assert.throws(()=>store.save(restored.revision,{admin:true}));assert.throws(()=>store.save(restored.revision,{presence:{...restored.presence,maximumDistance:100}}));}finally{rmSync(dir,{recursive:true,force:true});}
});
test('Wi-Fi scans decode escaped names and passwords never enter process argv',async()=>{
 const calls=[],files=new Map();const run=async(program,args)=>{calls.push([program,args]);if(args.includes('DEVICE,TYPE,STATE'))return 'wlan0:wifi:connected\n';if(args.includes('SSID,SIGNAL,SECURITY'))return 'Room\\:one:83:WPA2\nRoom\\:one:30:WPA2\nGuest:51:WPA2\n';if(args.includes('WIFI-PROPERTIES.AP'))return 'yes\n';if(args.includes('GENERAL.CON-UUID'))return 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee\n';return '';};const network=networkController({run,write:(p,v)=>files.set(p,v),remove:p=>files.delete(p)});assert.deepEqual(splitNm('Room\\:one:83:WPA2'),['Room:one','83','WPA2']);const scan=await network.scan('wlan0');assert.equal(scan.networks.length,2);assert.equal(scan.networks[0].ssid,'Room:one');await network.connect({interface:'wlan0',ssid:'Room:one',password:' never-in-argv '});assert.equal(JSON.stringify(calls).includes('never-in-argv'),false);assert.equal([...files.values()].some(v=>v.includes('psk=\\snever-in-argv\\s')),true);const ap=await network.hotspot({interface:'wlan0',confirmed:true});assert.match(ap.ssid,/^TuneBox-/);assert.equal(JSON.stringify(calls).includes(ap.password),false);assert.equal(calls.some(([_,a])=>a.includes('--on-active=10min')),true);await network.stop();assert.equal([...files.keys()].some(p=>p.endsWith('tunebox-setup.nmconnection')),false);assert.throws(()=>validateRequest({command:'hotspot-start',args:{interface:'eth0',confirmed:true}}));
});
test('clock and DSP only issue bounded operations; EQ headroom and failed writes are handled',async()=>{
 const calls=[],run=async(p,a)=>{calls.push([p,a]);return 'Timezone=Europe/Amsterdam\nNTP=yes\nNTPSynchronized=yes\n';};const clock=clockController({run});assert.equal((await clock.get()).synchronized,true);await clock.set({timeZone:'Europe/Amsterdam',automatic:false,iso:'2026-11-11T12:00:00Z'});assert.equal(calls.some(([_,a])=>a.includes('2026-11-11 12:00:00 UTC')),true);assert.throws(()=>validateRequest({command:'clock-set',args:{timeZone:'../../etc',automatic:true}}));
 const raw="numid=1,iface=MIXER,name='00020 Hz'\n ; type=INTEGER,access=rw---,values=1,min=-15,max=15\n : values=0\nnumid=2,iface=MIXER,name='Channel Left Gain'\n ; type=INTEGER,access=rw---,values=1,min=-110,max=0\n : values=0\nnumid=3,iface=MIXER,name='Channel Right Gain'\n ; type=INTEGER,access=rw---,values=1,min=-110,max=0\n : values=0\nnumid=4,iface=MIXER,name='Equalizer'\n ; type=ENUMERATED,access=rw---,values=1,items=2\n : values=1\n";assert.equal(parseDsp(raw).controls.length,4);const dir=directory();try{const dsp=dspController({statePath:join(dir,'standby.json'),run:async(p,a)=>{if(a.includes('contents'))return raw;return '';}});await assert.rejects(dsp.set([{id:99,value:1}]),/Unsupported/);await dsp.standby(true);await assert.rejects(dsp.set([{id:1,value:-3}]),/Exit standby/);await dsp.standby(false);}finally{rmSync(dir,{recursive:true,force:true});}
});
test('presence uses fresh real energy/distance, sensitivity and night policy without fabricated readings',()=>{
 const now=Date.parse('2026-11-11T12:00:00Z'),p=preferenceDefaults();p.presence.enabled=true;const sample={schema:1,observedAt:now,present:true,distance:2,energy:40};assert.equal(presenceReading(sample,p.presence,p.clock,now).present,true);assert.equal(presenceReading(sample,{...p.presence,sensitivity:'low'},p.clock,now).present,false);assert.equal(presenceReading(sample,{...p.presence,maximumDistance:1},p.clock,now).present,false);assert.equal(presenceReading(sample,p.presence,p.clock,now+4000).status,'unavailable');assert.equal(presenceReading(sample,{...p.presence,nightEnabled:true,nightStart:'00:00',nightEnd:'00:00'},p.clock,now).present,false);
});
