import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,existsSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {displaySettings,luxBrightness} from '../shared/display-settings.js';
import {DisplayStore} from '../server/display-store.js';
import {DeviceRuntime} from '../shared/runtime.js';
import {VideoLibrary,videoTrackKey} from '../server/video-library.js';
import {getLanguage,setLanguage,tr,translateFormat} from '../shared/i18n.js';

test('display settings persist separately; automatic brightness is bounded, monotonic and rejects stale policy input',()=>{
  const dir=mkdtempSync(join(tmpdir(),'tb-display-'));
  try{
    const store=new DisplayStore(dir),s=displaySettings({timeoutSeconds:600,brightnessMode:'auto',minimum:10,maximum:90});
    store.save(s);assert.deepEqual(new DisplayStore(dir).load(),s);
    const readings=[0,1,5,20,100,500,1000,1000000].map(n=>luxBrightness(n,s));
    assert.equal(readings[0],10);assert.equal(readings.at(-1),90);assert.deepEqual(readings,[...readings].sort((a,b)=>a-b));
    assert.equal(luxBrightness(NaN,s),null);assert.throws(()=>displaySettings({minimum:90,maximum:30}));assert.throws(()=>displaySettings({path:'/tmp/anything'}));
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('configured screen timeout and never option do not stop playback or enable an amplifier',()=>{
  const r=new DeviceRuntime(0);r.dispatch({type:'boot-complete'},0);r.dispatch({type:'play'},0);r.sensors.heartbeatEnabled=false;r.sensors.lastHeartbeat=600000;
  r.displayTimeoutMs=120000;r.dispatch({type:'tick'},60000);assert.equal(r.device.displayAwake,true);
  r.dispatch({type:'tick'},121000);assert.equal(r.device.displayAwake,false);assert.equal(r.playback.playing,true);assert.equal(r.device.amplifierEnabled,false);
  r.dispatch({type:'activity'},122000);r.displayTimeoutMs=Infinity;r.dispatch({type:'tick'},500000);assert.equal(r.device.displayAwake,true);assert.equal(r.device.amplifierEnabled,false);
});
test('video upload binds to track metadata across queue IDs; rejects unknown-duration radio and invalid containers',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'tb-video-')),library=new VideoLibrary(dir),track={id:'queue-1',title:'Example',artist:'Artist',album:'Album',duration:180};
  const bytes=Buffer.concat([Buffer.from([0,0,0,24]),Buffer.from('ftypisom'),Buffer.alloc(64)]);
  try{
    const link=await library.upload(Readable.from([bytes.subarray(0,7),bytes.subarray(7)]),track,'video/mp4',bytes.length);
    assert.equal(link.available,true);assert.equal(library.get({...track,id:'queue-2'}).available,true);assert.equal(library.get({...track,artist:'Different artist'}).available,false);
    assert.equal(library.path('../../etc/passwd'),null);assert.equal(readFileSync(library.path(link.url.split('/').at(-1))).length,bytes.length);
    await assert.rejects(()=>library.upload(Readable.from([Buffer.alloc(100)]),track,'video/mp4',100),/container/);
    await assert.rejects(()=>library.upload(Readable.from([bytes]),{...track,duration:null},'video/mp4',bytes.length),/duration/);
    assert.equal(readdirSync(join(dir,'video-artwork')).some(n=>n.endsWith('.upload')),false);
    library.remove(track);assert.equal(library.get(track).available,false);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('English is the default; Dutch and English share keys, language selection is explicit and music metadata is untouched',()=>{
  assert.equal(getLanguage(),'en');assert.equal(tr('Nu spelen'),'Now Playing');assert.equal(tr('Ruimtes'),'Rooms');
  const en=JSON.parse(readFileSync(new URL('../shared/locales/en.json',import.meta.url))),nl=JSON.parse(readFileSync(new URL('../shared/locales/nl.json',import.meta.url)));
  assert.deepEqual(Object.keys(en).sort(),Object.keys(nl).sort());
  assert.equal(tr('Ólafur Arnalds'),'Ólafur Arnalds');assert.throws(()=>setLanguage('../../bad'));
  setLanguage('nl');assert.equal(tr('Spaces'),'Ruimtes');assert.equal(tr('Screen timeout'),'Tijd tot schermrust');setLanguage('en');
  assert.equal(translateFormat('{count} tracks',{count:3}),'3 tracks');
});
