import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {uptime} from 'node:os';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {settings} from '../shared/settings.js';
import {deviceProfile,profileSettings} from '../shared/profile.js';
import {visualFraction,visualResponse} from '../shared/visualizer-motion.js';
import {clockText} from '../shared/clock-format.js';
import {PcmAnalyser,FFT_SIZE} from '../shared/audio-analysis.js';
import {alsaPlayback,PlaybackDiagnostics} from '../server/playback-diagnostics.js';
import {RemoteAccess} from '../server/remote-control.js';
import {MusicLibrary} from '../server/music-library.js';
import {rebootDecision,finishReboot} from '../deploy/ota/post-update.mjs';
import {updateRestart,restartBlocksControls} from '../server/update-status.js';

test('presentation preferences are bounded and never change volume, sound, timing or artwork choice',()=>{
 const p=settings({graphicsMode:'smooth',headerClock:false,visualizerSensitivity:100,visualizerResponse:'quick',volume:24});
 assert.equal(p.visualizerSensitivity,12);assert.equal(p.headerClock,false);assert.equal(p.volume,24);
 const profile=deviceProfile('',p,'Raspberry Pi 4 Model B');assert.equal(profile.lowPower,true);
 assert.deepEqual(profileSettings(p,profile).sound,p.sound);assert.deepEqual(profileSettings(p,profile).timing,p.timing);
 assert.equal(settings({graphicsMode:'untrusted',visualizerSensitivity:NaN,visualizerResponse:'untrusted'}).graphicsMode,'auto');
 assert.equal(deviceProfile('',{},'Raspberry Pi 4 Model B').id,'smooth');
 assert.equal(deviceProfile('',{graphicsMode:'full'},'Raspberry Pi 4 Model B').lowPower,false);
 assert.equal(deviceProfile('?profile=pi3',{graphicsMode:'full'},'').lowPower,true);
});
test('visual scale sensitivity preserves labelled endpoints and ordering; response has no audio gain',()=>{
 for(const s of [-12,0,12]){assert.equal(visualFraction(0,s),0);assert.equal(visualFraction(1,s),1);let previous=-1;for(let f=0;f<=1;f+=.01){const v=visualFraction(f,s);assert.ok(v>previous);previous=v;}}
 assert.ok(visualFraction(.25,12)>.25);assert.equal(visualFraction(.25),.25);assert.ok(visualResponse('quick').release<visualResponse('relaxed').release);
});
test('header and widget clocks share the saved time zone, date boundary, 12-hour choice and DST transition',()=>{
 const now=Date.parse('2026-11-25T23:30:00Z');assert.deepEqual(clockText(now,{timeZone:'Europe/Amsterdam'}),{time:'00:30',date:'2026-11-26'});assert.deepEqual(clockText(now,{timeZone:'America/New_York',hour12:true}),{time:'06:30 PM',date:'2026-11-25'});
 assert.equal(clockText(Date.parse('2026-03-29T00:59:00Z'),{timeZone:'Europe/Amsterdam'}).time,'01:59');assert.equal(clockText(Date.parse('2026-03-29T01:01:00Z'),{timeZone:'Europe/Amsterdam'}).time,'03:01');
});
test('meters-only analysis skips both FFTs while retaining the exact RMS, peak and clipping values',()=>{
 const samples=Buffer.alloc(FFT_SIZE*4);for(let i=0;i<FFT_SIZE;i++){samples.writeInt16LE(Math.round(9000*Math.sin(i*.2)),i*4);samples.writeInt16LE(-2000,i*4+2);}
 const analyser=new PcmAnalyser(),full=analyser.analyse(samples,48000);analyser.spectrum=()=>{throw Error('FFT should not run');};
 const levels=analyser.analyse(samples,48000,{spectrum:false});assert.deepEqual(levels.channels,full.channels);assert.equal(levels.spectrumComputed,false);assert.ok(levels.bandsDb.every(v=>v===null));
});
test('ALSA diagnostics report the actual current format, not chip capability or amplifier watts',()=>{
 const files={'/proc/asound/card3/id':'LouderRaspberry','/proc/asound/card3/pcm0p/sub0/status':'state: RUNNING\n','/proc/asound/card3/pcm0p/sub0/hw_params':'format: S32_LE\nchannels: 2\nrate: 48000 (48000/1)\n'};
 const s=alsaPlayback({list:()=>['card3'],readText:p=>files[p]||''});assert.equal(s.pcmBitrate,3072000);assert.equal(s.rate,48000);assert.equal(s.state,'RUNNING');
 assert.equal(alsaPlayback({list:()=>[],readText:()=>''}).rate,null);
});
test('only repeated explicit local XRUNs pause; silence, remote playback, missing diagnostics and duplicate reads do not',t=>{
 let now=0,state='unknown',localPlaying=true,blocked=false,faults=0;
 const d=new PlaybackDiagnostics({context:()=>({localPlaying,blocked}),inspect:()=>({state}),now:()=>now,onFault:()=>faults++});t.after(()=>d.close());
 for(state of ['unknown','CLOSED','RUNNING']){now+=20000;d.sample();}assert.equal(faults,0);
 state='XRUN';d.sample(true);d.sample(true);assert.equal(faults,0);now+=2000;d.sample(true);assert.equal(faults,1);d.sample(true);assert.equal(faults,1);
 d.acknowledge();now+=20000;d.sample();assert.equal(faults,1);state='RUNNING';d.sample(true);d.sample(true);state='XRUN';d.sample(true);now+=2000;localPlaying=false;d.sample(true);assert.equal(faults,1);
 localPlaying=true;blocked=true;d.sample(true);assert.equal(faults,1);
});
test('a phone can rename only a known credential id, names are sanitized and survive reload',t=>{
 const dir=mkdtempSync(join(tmpdir(),'tb-phone-names-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const a=new RemoteAccess(dir),token=a.createPair().token,p=a.complete(token,'iPhone');
 assert.deepEqual(a.rename(p.id,'Guest one'),{name:'Guest one'});assert.equal(new RemoteAccess(dir).list()[0].name,'Guest one');
 assert.throws(()=>a.rename('other','Name'));assert.throws(()=>a.rename(p.id,' <>\n'));assert.equal(a.list()[0].name,'Guest one');
});
function radioFixture(){
 const item={media_type:'track',uri:'library://track/1',name:'Track',provider:'library',item_id:'1'},key=createHash('sha256').update(item.uri).digest('hex'),calls=[];
 const s={status:'connected',playerId:'pi',queueId:'pi',players:[{player_id:'pi',available:true,volume_level:20}],playback:{connected:true,volume:20,index:0,queue:[{id:'current',mediaKey:key}]},config:{controlEnabled:true,volumeLimit:40},refresh:async()=>{},transport:{command:async(c,a)=>{calls.push([c,a]);return {current_item:{media_item:item}};}}};
 return {item,key,calls,s,library:new MusicLibrary(s)};
}
test('song radio binds to the current server song, asks before replacing queued music and sends one guarded command',async()=>{
 const f=radioFixture();f.s.playback.queue.push({id:'next'});await assert.rejects(()=>f.library.startRadio(f.key),e=>e.code==='queue-not-empty');assert.equal(f.calls.filter(([c])=>c==='player_queues/play_media').length,0);
 await f.library.startRadio(f.key,{confirmReplace:true});assert.deepEqual(f.calls.at(-1),['player_queues/play_media',{queue_id:'pi',media:f.item.uri,option:'replace',radio_mode:true}]);
});
test('song radio refuses a changed song, room, high/unknown volume, read-only player or unavailable source',async()=>{
 for(const edit of [f=>f.s.playback.volume=90,f=>f.s.playback.volume=null,f=>f.s.config.controlEnabled=false,f=>f.item.available=false,f=>f.item.uri='library://track/other',f=>f.s.transport.command=async()=>{f.s.playerId='other';return {current_item:{media_item:f.item}};}]){
  const f=radioFixture();edit(f);await assert.rejects(()=>f.library.startRadio(f.key,{confirmReplace:true}));assert.equal(f.calls.some(([c])=>c==='player_queues/play_media'),false);
 }
});
const commit='a'.repeat(40),job={schema:1,commit,release:'test-release',bootId:'boot-one',phase:'waiting'},health={ok:true,deploymentCommit:commit,build:{id:'test-release'}},installed={commit},ready={commit,release:'test-release'};
test('reboot needs the exact committed healthy build, a painted-screen acknowledgement, the same boot and idle playback',()=>{
 const base={job,installed,health,currentBoot:'boot-one',idle:true,ready};assert.equal(rebootDecision(base),'countdown');
 assert.equal(rebootDecision({...base,ready:null}),'await-screen');assert.equal(rebootDecision({...base,ready:null,elapsed:90001}),'required');assert.equal(rebootDecision({...base,idle:false}),'required');assert.equal(rebootDecision({...base,health:{...health,deploymentCommit:'b'.repeat(40)}}),'cancelled');assert.equal(rebootDecision({...base,currentBoot:'next-boot'}),'complete');
});
function rebootHost({healthy=true,ack=true,idle=true,pending=false}={}){
 const files=new Map([['/var/lib/daw-one-updater/reboot.json',{...job}],['/var/lib/daw-one-updater/installed.json',installed],['/var/lib/daw-one-update-status/status.json',{status:'installed'}],...(ack?[['/run/daw-one-display/reboot-ready.json',ready]]:[])]),calls=[];let now=0;
 const state={mode:'simulation',device:{mode:'ready',amplifierEnabled:false,faults:[]},playback:{playing:!idle},activity:{localPlayback:!idle}};
 return {files,calls,options:{readJson:p=>files.get(p),write:(p,v)=>files.set(p,v),bootId:()=>'boot-one',clock:()=>now,sleep:async n=>{now+=n;},resolve:()=>'/opt/daw-one-releases/'+commit,has:()=>pending,request:async p=>({ok:true,body:Buffer.from(JSON.stringify(p==='/api/health'?(healthy?health:{ok:false}):state))}),run:(c,a)=>calls.push([c,a])}};
}
test('post-update helper reboots once after its countdown; failed, unacknowledged, busy or interrupted activation never reboots',async()=>{
 const f=rebootHost();await finishReboot(commit,f.options);assert.deepEqual(f.calls,[['/usr/bin/sync',[]],['/usr/bin/systemctl',['reboot','--no-block']]]);await finishReboot(commit,f.options);assert.equal(f.calls.length,2);
 for(const options of [{healthy:false},{ack:false},{idle:false},{pending:true}]){const h=rebootHost(options);await finishReboot(commit,h.options);assert.equal(h.calls.length,0);assert.ok(['cancelled','required'].includes(h.files.get('/var/lib/daw-one-updater/reboot.json').phase));}
 const failed=rebootHost();failed.files.set('/var/lib/daw-one-update-status/status.json',{status:'error'});await finishReboot(commit,failed.options);assert.equal(failed.calls.length,0);assert.equal(failed.files.get('/var/lib/daw-one-updater/reboot.json').phase,'cancelled');
});
test('interrupted restart progress expires visibly, a later boot finishes it, and only the current countdown blocks controls',t=>{
 const dir=mkdtempSync(join(tmpdir(),'tb-restart-status-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const file=join(dir,'reboot.json'),bootId='12345678-abcd-abcd-abcd-123456789012';
 const save=(phase,updatedUptime)=>writeFileSync(file,JSON.stringify({...job,bootId,phase,updatedUptime}));
 save('await-screen',uptime()-500);assert.equal(updateRestart(file,bootId).phase,'required');
 save('countdown',uptime());const status=updateRestart(file,bootId);assert.equal(status.phase,'countdown');assert.equal(restartBlocksControls(status,commit),true);assert.equal(restartBlocksControls(status,'b'.repeat(40)),false);assert.equal(restartBlocksControls({...status,phase:'required'},commit),false);assert.equal(updateRestart(file,'another-boot').phase,'complete');
});
