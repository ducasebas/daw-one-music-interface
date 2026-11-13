import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Readable} from 'node:stream';
import {MeasurementDelay,presentationTiming,visualizerDelay,playbackDiscontinuity} from '../shared/presentation-timing.js';
import {localVideoSync,videoAdjustment,videoTiming} from '../shared/video.js';
import {VideoLibrary} from '../server/video-library.js';
import {validatePreferences,preferenceDefaults} from '../shared/preferences.js';
const packet=(stamp,level=-18)=>({status:'pcm',enabled:true,playerId:'local',measurement:{capturedAt:stamp,bandsDb:[level],channels:[{peakDb:level,rmsDb:level}]}});

test('real PCM frames become visible at the configured delay, without predicting future frames',()=>{
 const q=new MeasurementDelay(),a=packet(100),b=packet(200,-6);
 q.push(a,10);q.push(b,110);
 assert.equal(q.read(209,200),null);assert.equal(q.nextDue(209,200),210);
 assert.equal(q.read(210,200),a);assert.equal(q.read(309,200),a);assert.equal(q.read(310,200),b);
 assert.equal(q.read(110,-500),b); // Earliest is the newest available frame.
 assert.equal(q.frames.length,2);
 assert.equal(q.push(b,210),false);assert.equal(q.frames.length,2); // Poll duplicates cannot postpone a frame.
});
test('stale PCM, disabled analysis and source changes flush the complete presentation queue',()=>{
 const q=new MeasurementDelay();q.push(packet(1),0,'first');q.push({...packet(2),status:'stale',measurement:null},10,'first');assert.equal(q.read(400,0),null);
 q.push(packet(3),20,'first');q.push({...packet(4),enabled:false},30,'first');assert.equal(q.read(400,0),null);
 q.push(packet(5),40,'first');q.push(packet(6),50,'second');assert.equal(q.read(200,160),null);assert.equal(q.read(210,160).measurement.capturedAt,6);
 q.push(packet(2),60,'second');assert.equal(q.frames.length,1); // Server clock/source reset does not replay old history.
 for(let i=0;i<300;i++)q.push(packet(i+10),i+70,'second');assert.ok(q.frames.length<=128);
});
test('screen delay is shared; the visualizer trim is separate and cannot require future audio',()=>{
 assert.deepEqual(presentationTiming({screenDelayMs:9000,visualizerTrimMs:-9000}),{screenDelayMs:2000,visualizerTrimMs:-500});
 assert.equal(visualizerDelay({screenDelayMs:200,visualizerTrimMs:-500}),0);
 assert.equal(visualizerDelay({screenDelayMs:2000,visualizerTrimMs:500}),2500);
 const input=preferenceDefaults();input.prefs.timing={screenDelayMs:250,visualizerTrimMs:40};assert.deepEqual(validatePreferences(input).prefs.timing,input.prefs.timing);
 assert.deepEqual(presentationTiming(null),{screenDelayMs:0,visualizerTrimMs:0});
});
test('normal music clock updates keep the buffer; track, pause and seek transitions reset it',()=>{
 const p={key:'song',playing:true,position:10,observedAt:1000};
 assert.equal(playbackDiscontinuity(p,{...p,position:11,observedAt:2000}),false);
 assert.equal(playbackDiscontinuity(p,{...p,position:80,observedAt:2000}),true);
 assert.equal(playbackDiscontinuity(p,{...p,playing:false}),true);
 assert.equal(playbackDiscontinuity(p,{...p,key:'new song'}),true);
});
const sync=extra=>localVideoSync({audioPosition:20,audioDuration:180,videoDuration:190,...extra});
test('local videos use start or end alignment, plus per-track offset and the shared screen delay',()=>{
 assert.equal(sync({}).position,20);assert.equal(sync({mode:'ends'}).position,30);
 assert.equal(sync({mode:'ends',offsetSeconds:-3,screenDelayMs:300}).position,26.7);
 assert.equal(sync({offsetSeconds:2,screenDelayMs:500}).position,21.5);
 assert.equal(sync({audioPosition:0,screenDelayMs:500,playing:true}).status,'waiting');
 assert.equal(sync({audioPosition:180,videoDuration:100,playing:true}).playing,false);
 assert.equal(sync({audioDuration:null}).status,'fallback');assert.equal(sync({available:false}).status,'fallback');
 assert.throws(()=>videoTiming({mode:'starts',offsetSeconds:Infinity}));assert.throws(()=>videoTiming({mode:'starts',offsetSeconds:0,url:'x'}));
});
test('video drift uses small rate corrections; pause and explicit seek reposition precisely',()=>{
 assert.deepEqual(videoAdjustment({target:10,current:10,playing:true,now:2000}),{kind:'rate',rate:1,error:0});
 const ahead=videoAdjustment({target:10,current:9.8,playing:true,now:2000});assert.equal(ahead.kind,'rate');assert.ok(ahead.rate>1&&ahead.rate<=1.04);
 const behind=videoAdjustment({target:10,current:10.4,playing:true,now:2000});assert.equal(behind.kind,'rate');assert.equal(behind.rate,.96);
 assert.equal(videoAdjustment({target:40,current:10,playing:true,now:2000}).kind,'seek');
 assert.equal(videoAdjustment({target:40,current:10,playing:true,now:2000,lastSeek:1500}).kind,'wait');
 assert.equal(videoAdjustment({target:40,current:10,playing:true,now:2000,lastSeek:1990,force:true}).kind,'seek');
 assert.equal(videoAdjustment({target:10.1,current:10,playing:false,now:2000}).kind,'seek');
 assert.equal(videoAdjustment({target:10,current:0,playing:true,seeking:true,force:true}).kind,'wait');
});
test('video timing is saved per track and rejects a stale track, replaced file or competing editor',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'tunebox-sync-')),lib=new VideoLibrary(directory),track={id:'a',mediaKey:'a'.repeat(64),title:'Track',artist:'Artist',duration:180};
 const bytes=Buffer.concat([Buffer.from([0,0,0,24]),Buffer.from('ftypisom'),Buffer.alloc(64)]);
 try{
  const first=await lib.upload(Readable.from([bytes]),track,'video/mp4',bytes.length);
  assert.deepEqual(first.sync,{mode:'starts',offsetSeconds:0});
  const body={trackKey:first.trackKey,id:first.id,revision:first.revision,sync:{mode:'starts',offsetSeconds:1.25}};
  const saved=lib.timing(track,body);assert.equal(saved.sync.offsetSeconds,1.25);
  assert.throws(()=>lib.timing(track,body),/changed/);
  assert.throws(()=>lib.timing({...track,mediaKey:'b'.repeat(64)},{...body,revision:saved.revision}),/changed/);
  await lib.upload(Readable.from([bytes]),track,'video/mp4',bytes.length);
  assert.throws(()=>lib.timing(track,{...body,revision:saved.revision}),/changed/);
  const file=join(lib.directory,'links.json'),old=JSON.parse(readFileSync(file));delete old[first.trackKey].sync;delete old[first.trackKey].revision;writeFileSync(file,JSON.stringify(old));
  assert.equal(lib.get(track).legacy,true);assert.equal(lib.get(track).sync,null);
  const current=lib.get(track);assert.deepEqual(lib.timing(track,{...body,id:current.id,revision:0,sync:{mode:'ends',offsetSeconds:-.2}}).sync,{mode:'ends',offsetSeconds:-.2});
 }finally{rmSync(directory,{recursive:true,force:true});}
});
