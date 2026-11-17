import test from 'node:test';
import assert from 'node:assert/strict';
import {CaptureEnergy,estimateSync,syncCaptureSettings,pcmEnergy} from '../shared/sync-calibration.js';

function signal({delay=240,periodic=false}={}){
  let seed=9;const rand=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
  const pulses=Array.from({length:40},()=>({t:rand()*16000,w:50+rand()*130,a:4+rand()*14}));
  const reference=Array.from({length:801},(_,i)=>({t:i*20,db:periodic?-40+14*Math.sin(i*20*Math.PI/250):-60+pulses.reduce((s,p)=>s+p.a*Math.exp(-(((i*20-p.t)/p.w)**2)),0)}));
  const points=reference.map(p=>({t:p.t+delay,db:p.db-12+(rand()-.5)*.8}));
  return {reference,capture:{points,clipPercent:0,maxChunkMs:20}};
}

test('realistic irregular energy envelopes recover relative delay and bounded presentation settings',()=>{
  for(const delay of [0,85,240,900,1500]){
    const {reference,capture}=signal({delay});const result=estimateSync(reference,capture,{displayDelayMs:0,displayUncertaintyMs:15});
    assert.ok(Math.abs(result.relativeLagMs-delay)<=5);assert.ok(Math.abs(result.delayMs-delay)<=10);assert.equal(result.rawAudioRetained,false);assert.ok(result.correlation>.95);assert.ok(result.uncertaintyMs<=60);
  }
});

test('measured browser delivery is subtracted once, without inventing negative/future audio',()=>{
  const {reference,capture}=signal({delay:240});const r=estimateSync(reference,capture,{displayDelayMs:75,displayUncertaintyMs:10});assert.ok(Math.abs(r.delayMs-165)<=5);
  const early=signal({delay:-300});assert.throws(()=>estimateSync(early.reference,early.capture),/already behind/);
});

test('silence, periodic ambiguity, clipping, long chunks, malformed traces and clock drift are rejected',()=>{
  const f=signal();
  assert.throws(()=>estimateSync(f.reference.map(p=>({...p,db:-70})),f.capture));
  const periodic=signal({periodic:true});assert.throws(()=>estimateSync(periodic.reference,periodic.capture),/ambiguous/);
  for(const capture of [{...f.capture,clipPercent:.2},{...f.capture,maxChunkMs:300},{...f.capture,points:f.capture.points.slice(0,10)},{...f.capture,points:[...f.capture.points].reverse()}])assert.throws(()=>estimateSync(f.reference,capture));
  const drift={...f.capture,points:f.capture.points.map((p,i)=>({...p,t:p.t+i*.5}))};assert.throws(()=>estimateSync(f.reference,drift));
});

test('capture keeps bounded energy only and centres sample windows with the configured input correction',()=>{
  const energy=new CaptureEnergy({rate:48000,window:4096,hop:960,inputLatencyMs:10});
  const bytes=Buffer.alloc(9600);for(let i=0;i<4800;i++)bytes.writeInt16LE(Math.round(3000*Math.sin(i/7)),i*2);
  energy.push(bytes,1000);const result=energy.result();assert.ok(result.points.length>0);assert.equal(result.frames,4800);assert.equal(result.clipPercent,0);assert.ok(result.points.at(-1).t<950);assert.equal(Object.hasOwn(result,'samples'),false);assert.throws(()=>energy.push(bytes,999));
  assert.throws(()=>syncCaptureSettings({device:'/etc/passwd'}));assert.throws(()=>syncCaptureSettings({inputLatencyMs:-2}));
  assert.ok(Math.abs(pcmEnergy({channels:[{rmsDb:-20},{rmsDb:-20}]})+20)<.001);assert.equal(pcmEnergy({channels:[]}),null);
});
