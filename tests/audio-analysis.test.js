import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {execFileSync,spawn} from 'node:child_process';
import {createServer} from 'node:net';import {createHash} from 'node:crypto';
import {PcmAnalyser,FFT_SIZE,DB_FLOOR,bandEdges} from '../shared/audio-analysis.js';
import {AudioAnalysis,PcmPackets} from '../server/audio-analysis.js';
import {settings} from '../shared/settings.js';
const tone=(left=.5,right=0,invert=false)=>{const bytes=Buffer.alloc(FFT_SIZE*4);for(let i=0;i<FFT_SIZE;i++){const s=Math.sin(2*Math.PI*64*i/FFT_SIZE);bytes.writeInt16LE(Math.round(s*left*32767),i*4);bytes.writeInt16LE(Math.round(s*right*32767)*(invert?-1:1),i*4+2);}return bytes;};
test('actual PCM sine yields calibrated digital RMS/peak and isolated stereo channels',()=>{
 const result=new PcmAnalyser().analyse(tone(),44100);assert.ok(Math.abs(result.channels[0].rmsDb-(-9.0309))<.02);assert.ok(Math.abs(result.channels[0].peakDb-(-6.0206))<.02);assert.equal(result.channels[1].rmsDb,DB_FLOOR);assert.equal(result.silent,false);
 const strongest=result.bandsDb.indexOf(Math.max(...result.bandsDb.filter(x=>x!==null)));assert.ok(bandEdges[strongest]<=44100*64/FFT_SIZE&&bandEdges[strongest+1]>44100*64/FFT_SIZE);
});
test('spectrum uses stereo power so antiphase audio cannot cancel',()=>{
 const analyser=new PcmAnalyser(),same=analyser.analyse(tone(.5,.5),44100),opposite=analyser.analyse(tone(.5,.5,true),44100);assert.deepEqual(same.bandsDb,opposite.bandsDb);const total=same.bandsDb.filter(x=>x!==null).reduce((p,db)=>p+10**(db/10),0);assert.ok(Math.abs(10*Math.log10(total)-same.channels[0].rmsDb)<.02);
});
test('real silence differs from missing source; full-scale samples and Nyquist limits are explicit',()=>{
 const analyser=new PcmAnalyser();assert.equal(analyser.analyse(Buffer.alloc(FFT_SIZE*4),44100).silent,true);const samples=Buffer.alloc(FFT_SIZE*4);for(let i=0;i<FFT_SIZE;i++){samples.writeInt16LE(32767,i*4);samples.writeInt16LE(-32768,i*4+2);}const result=analyser.analyse(samples,8000);assert.equal(result.channels[0].clippedSamples,FFT_SIZE);assert.equal(result.channels[1].clippedSamples,FFT_SIZE);assert.equal(result.bandsDb.at(-1),null);assert.throws(()=>analyser.analyse(Buffer.alloc(3),44100));assert.throws(()=>analyser.analyse(samples,0));
});
function packet(samples=Buffer.alloc(0),status=1){const header=Buffer.alloc(24);header.write('TBP1');header.writeUInt32LE(44100,4);header.writeUInt32LE(samples.length/4,8);header.writeUInt32LE(status,12);header.writeUInt32LE(Math.floor(Date.now()/1000),20);return Buffer.concat([header,samples]);}
test('PCM framing handles fragmented reads, bad headers, queue bursts and explicit idle packets',()=>{
 const parser=new PcmPackets(),pcm=packet(tone(),2);assert.equal(parser.push(pcm.subarray(0,31)),null);assert.equal(parser.push(pcm.subarray(31)).samples.length,FFT_SIZE*4);assert.equal(parser.push(Buffer.concat([Buffer.from('bad bytes'),pcm,packet()])).status,1);parser.push(Buffer.alloc(2000000,1));assert.ok(parser.buffer.length<24);assert.equal(parser.push(pcm).status,2);
});
test('visualizer preferences persist with safe defaults',()=>{assert.equal(settings({}).visualizer,'off');assert.equal(settings({visualizer:'random'}).visualizer,'off');assert.equal(settings(JSON.parse(JSON.stringify(settings({visualizer:'spectrum',visualizerBands:16})))).visualizerBands,16);});
const nativeDir=mkdtempSync(join(tmpdir(),'tb-pcm-test-')),reader=join(nativeDir,'reader'),writer=join(nativeDir,'fixture'),mac='02:00:00:00:00:01';
execFileSync('cc',['-O2','-std=c11','-Wall','-Wextra','-Werror','-pthread','deploy/audio/pcm-reader.c','-o',reader]);
writeFileSync(join(nativeDir,'fixture.c'),`#define _GNU_SOURCE
#include "vis-layout.h"
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>
int main(int argc,char **argv){if(argc!=3)return 1;struct tb_vis_layout data={0};data.sample_capacity=TB_VIS_SAMPLES;data.next_sample=2;data.running=strcmp(argv[2],"idle")!=0;data.sample_rate=44100;data.updated=time(NULL)-(strcmp(argv[2],"stale")==0?10:0);for(int i=0;i<TB_VIS_SAMPLES/2;i++){data.samples[i*2]=(int16_t)(16384*sin(2*3.141592653589793*64*i/TB_PCM_FRAMES));data.samples[i*2+1]=0;}FILE *f=fopen(argv[1],"wb");if(!f)return 2;fwrite(&data,1,sizeof(data),f);fclose(f);return 0;}`);
execFileSync('cc',['-O2','-pthread','-I','deploy/audio',join(nativeDir,'fixture.c'),'-lm','-o',writer]);
const source=join(nativeDir,'squeezelite-'+mac),make=state=>execFileSync(writer,[source,state]);
const native=()=>new PcmPackets().push(execFileSync(reader,[nativeDir,mac,'--once']));
test('native reader measures a shared-memory PCM ring including wrap without modifying any producer byte',()=>{
 make('running');const before=readFileSync(source),data=native();assert.equal(data.status,2);assert.equal(data.samples.length,FFT_SIZE*4);assert.deepEqual(readFileSync(source),before);assert.ok(Math.abs(new PcmAnalyser().analyse(data.samples,data.rate).channels[0].rmsDb+9.0309)<.02);
});
test('native reader reports idle, stale, missing, incompatible and symlinked sources without fabricated zero levels',()=>{
 make('idle');assert.equal(native().status,1);make('stale');assert.equal(native().status,3);writeFileSync(source,Buffer.alloc(2));assert.equal(native().status,5);rmSync(source);assert.equal(native().status,0);const target=join(nativeDir,'symlink-target');writeFileSync(target,'fixture');symlinkSync(target,source);assert.equal(native().status,0);rmSync(source);
});
test('real native reader → analyser pipeline can be globally disabled and never starts without demand',async()=>{
 make('running');const directory=join(nativeDir,'state'),events=[];const engine=new AudioAnalysis({reader,directory:nativeDir,playerId:mac,stateDir:directory,onStatus:s=>events.push(s)});
 try{assert.equal(engine.get().status,'disabled');assert.equal(engine.child,null);engine.setEnabled(true);assert.equal(engine.child,null);engine.get({watch:true});let data;for(let i=0;i<60;i++){await new Promise(r=>setTimeout(r,20));data=engine.get({selectedId:mac});if(data.measurement)break;}
 assert.equal(data.source,'squeezelite-pcm');assert.equal(data.simulated,false);assert.ok(Math.abs(data.measurement.channels[0].rmsDb+9.0309)<.02);assert.equal(data.matchesSelected,true);assert.equal(engine.get({selectedId:'different'}).matchesSelected,false);
 engine.setEnabled(false);assert.equal(engine.child,null);assert.equal(engine.get({watch:true}).measurement,null);assert.equal(engine.get().status,'disabled');assert.ok(events.includes('pcm'));assert.equal(JSON.parse(readFileSync(join(directory,'audio-analysis.json'))).enabled,false);
 engine.setEnabled(true);engine.get({watch:true});engine.get({awake:false});assert.equal(engine.child,null);assert.equal(engine.get({awake:false}).status,'sleeping');
 }finally{engine.close();}
});
test('a missing native reader cannot be enabled and cannot be replaced with a fake data source',()=>{const engine=new AudioAnalysis({reader:'/missing',directory:nativeDir,playerId:mac,stateDir:join(nativeDir,'not-configured')});try{assert.throws(()=>engine.setEnabled(true),/Install/);assert.equal(engine.get({watch:true}).measurement,null);assert.equal(engine.child,null);}finally{engine.close();}});
process.on('exit',()=>rmSync(nativeDir,{recursive:true,force:true}));
test('capture helper exits when the visible-client lease expires, without changing the PCM producer file',async()=>{
 make('running');const engine=new AudioAnalysis({reader,directory:nativeDir,playerId:mac,stateDir:join(nativeDir,'lease-state')});const before=readFileSync(source);
 try{engine.setEnabled(true);engine.get({watch:true});assert.ok(engine.child);for(let i=0;i<90&&engine.child;i++)await new Promise(r=>setTimeout(r,50));assert.equal(engine.child,null);assert.equal(engine.get().measurement,null);assert.deepEqual(readFileSync(source),before);}finally{engine.close();}
});

test('HTTP audio API uses the real native pipe, requires its nonce, rejects source overrides and leaves amplifier inhibited',async()=>{
 const listener=createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
 const child=spawn(process.execPath,['server/index.js'],{env:{...process.env,NODE_ENV:'production',HOST:'127.0.0.1',PORT:String(port),DAW_PLAYBACK_MODE:'simulation',DAW_STATE_DIR:join(nativeDir,'http-state'),DAW_AUDIO_READER:reader,DAW_AUDIO_SHM_DIR:nativeDir,DAW_AUDIO_PLAYER_ID:mac},stdio:'ignore'});
 const origin='http://127.0.0.1:'+port;
 try{
  let ready=false;for(let i=0;i<70;i++){try{ready=(await fetch(origin+'/api/health')).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,50));}assert.ok(ready);
  const updates=await(await fetch(origin+'/api/updates')).json();
  const post=(body,token)=>fetch(origin+'/api/audio/settings',{method:'POST',headers:{'Content-Type':'application/json',...(token?{'X-TuneBox-Control':token}:{})},body:JSON.stringify(body)});
  assert.equal((await post({enabled:true})).status,403);assert.equal((await post({enabled:true,reader:'/evil'},updates.controlToken)).status,400);
  make('running');assert.equal((await post({enabled:true},updates.controlToken)).status,200);
  let data;for(let i=0;i<70;i++){data=await(await fetch(origin+'/api/audio?watch=1')).json();if(data.measurement)break;await new Promise(r=>setTimeout(r,30));}
  assert.ok(Math.abs(data.measurement.channels[0].rmsDb+9.0309)<.02);assert.equal(data.simulated,false);
  assert.equal((await(await fetch(origin+'/api/state')).json()).device.amplifierEnabled,false);
  assert.equal((await post({enabled:false},updates.controlToken)).status,200);assert.equal((await(await fetch(origin+'/api/audio?watch=1')).json()).measurement,null);
 }finally{child.kill('SIGTERM');await new Promise(resolve=>{if(child.exitCode!==null)return resolve();const timer=setTimeout(()=>{child.kill('SIGKILL');resolve();},1500);child.once('exit',()=>{clearTimeout(timer);resolve();});});}
});
