import test from 'node:test';
import assert from 'node:assert/strict';
import {measureSynchronization} from '../deploy/sync/session.mjs';

function fixture(){
 let now=10000,frames=0,handler,stopped=false;
 const input={ended:false,failed:false,onData(fn){handler=fn;},stop(){stopped=true;}};
 const context={ready:true,playing:true,pcmReady:true,key:'a'.repeat(64),trackKey:'track',volume:20,muted:false,sampleRate:48000,windowMs:4096/48};
 const pulses=[{t:1300,w:100},{t:2900,w:180},{t:3450,w:70},{t:5100,w:130},{t:6850,w:90},{t:8400,w:160},{t:10900,w:80}];
 const db=time=>-55+pulses.reduce((sum,p)=>sum+18*Math.exp(-(((time-p.t)/p.w)**2)),0);
 const amplitude=time=>10**(db(time)/20)*Math.SQRT2;
 const energy=time=>{let total=0;for(let i=0;i<4096;i++){const t=time-(4095-i)/48;const value=amplitude(t)*Math.sin(2*Math.PI*440*t/1000);total+=value*value;}return 10*Math.log10(total/4096);};
 const options={job:{id:'12345678-1234-1234-1234-123456789abc',microphone:'hw:3,0',settings:{displayDelayMs:0,displayUncertaintyMs:15},context:{key:context.key,trackKey:context.trackKey}},clock:()=>now,sleep:async ms=>{now+=ms;},getContext:async()=>({...context,position:(now-10000)/1000,observedAt:now}),openCapture:()=>input,
  getAudio:async()=>{
   const samples=2160,bytes=Buffer.alloc(samples*2),end=now-10000;
   for(let i=0;i<samples;i++){const t=end-(samples-i-1)/48,value=amplitude(t-240)*Math.sin(2*Math.PI*440*t/1000);bytes.writeInt16LE(Math.round(value*32767),i*2);}
   handler(bytes);frames+=samples;if(frames>=576000)input.ended=true;
   const rmsDb=energy(end);return {configured:true,enabled:true,matchesSelected:true,status:'pcm',measurement:{capturedMonotonicMs:now,channels:[{rmsDb},{rmsDb}]}};
  },
 };
 return {options,input,context,stopped:()=>stopped,setClock:v=>now=v};
}

test('the capture session measures a controlled delayed audio path and always stops the input',async()=>{
 const f=fixture(),r=await measureSynchronization(f.options);assert.equal(r.valid,true);assert.ok(r.delayMs>=150&&r.delayMs<=240);assert.ok(r.correlation>.8);assert.equal(r.contextKey,f.context.key);assert.equal(r.rawAudioRetained,false);assert.equal(f.stopped(),true);
});

test('a paused/unready source is rejected before opening the microphone',async()=>{
 const f=fixture();f.context.playing=false;f.options.openCapture=()=>assert.fail('microphone must not open');await assert.rejects(measureSynchronization(f.options),/changed before capture/);
});

test('stale PCM and microphone failures close capture and do not return a result',async()=>{
 for(const kind of ['stale','input']){
  const f=fixture();
  if(kind==='stale')f.options.getAudio=async()=>({enabled:true,configured:true,matchesSelected:true,status:'stale'});
  if(kind==='input')f.input.failed=true;
  await assert.rejects(measureSynchronization(f.options));assert.equal(f.stopped(),true);
 }
});

test('cancelling before capture never opens the microphone; later cancellation stops it',async()=>{
 const early=fixture();early.options.cancelled=()=>true;early.options.openCapture=()=>assert.fail('already cancelled');await assert.rejects(measureSynchronization(early.options),/Cancelled/);
 const later=fixture();let calls=0;later.options.cancelled=()=>++calls>2;await assert.rejects(measureSynchronization(later.options),/Cancelled/);assert.equal(later.stopped(),true);
});

test('changing volume, group, track or play state invalidates the capture instead of saving a stale correction',async()=>{
 for(const patch of [{volume:21},{key:'b'.repeat(64)},{trackKey:'other'},{playing:false},{muted:true}]){
  const f=fixture(),get=f.options.getContext;let count=0;f.options.getContext=async()=>{const c=await get();return count++?{...c,...patch}:c;};
  await assert.rejects(measureSynchronization(f.options),/Keep the same/);assert.equal(f.stopped(),true);
 }
});
