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

// GUI 3.15.1: onset refinement, start-burst skip and a screen-path margin that one slow frame cannot inflate.
function musicFixture({delay=137,burst=true,seed=5}={}){
 let s=seed;const rand=()=>((s=Math.imul(s,1664525)+1013904223|0)>>>0)/4294967296;
 const hits=[];for(let t=0;t<14000;t+=180+rand()*260)hits.push({t,a:6+rand()*14});
 const env=t=>{let e=1e-6;for(const h of hits){const d=t-h.t;if(d>=0&&d<600)e+=h.a*Math.exp(-d/90);}return -55+10*Math.log10(1+e*30)+3*Math.sin(t/1700);};
 const smooth=t=>{let v=0;for(let k=-46;k<=46;k+=4)v+=env(t+k);return v/24;};
 const reference=[];for(let t=0;t<13000;t+=23.2)reference.push({t:Math.round(t*10)/10,db:smooth(t)});
 const points=[];for(let t=0;t<13000;t+=10){let db=smooth(t-delay)-14+(rand()-.5)*1.2;if(burst&&t<900)db+=25*Math.exp(-t/300)+(rand()-.5)*6;points.push({t,db});}
 return {reference,capture:{points,clipPercent:0,maxChunkMs:5}};
}
test('music with transients: onsets pin the lag within a few ms, also after a microphone start-up burst',()=>{
 for(const delay of [0,37,137,412]){const {reference,capture}=musicFixture({delay});const r=estimateSync(reference,capture,{displayDelayMs:0,displayUncertaintyMs:12});
  assert.equal(r.method,'pcm-microphone-onsets');assert.ok(Math.abs(r.relativeLagMs-delay)<=5,`lag ${r.relativeLagMs} for ${delay}`);assert.ok(r.uncertaintyMs<=30,`±${r.uncertaintyMs}`);assert.ok(r.peakWidthMs<=20);}
});
test('the screen-path margin uses the interquartile range, so a few slow frames do not inflate it',async()=>{
 const {displayTimingFromAges}=await import('../shared/sync-calibration.js');
 const ages=[62,64,63,65,66,61,64,63,62,65,64,63,66,62,63,64,65,63,64,62,150,170,58,180];
 const t=displayTimingFromAges(ages);assert.equal(t.displayDelayMs,64);assert.ok(t.displayUncertaintyMs<=12,`±${t.displayUncertaintyMs}`);
 // The previous formula (2nd-highest minus 2nd-lowest of 12 samples) gave tens of ms here.
 const old=[...ages.slice(12)].sort((a,b)=>a-b);assert.ok((old.at(-2)-old[1])/2+16>50);
 assert.equal(displayTimingFromAges([60,60,60,60]).displayUncertaintyMs,10);
});
test('sync history keeps the last five attempts, including the failure reason',async()=>{
 const {nextHistory}=await import('../deploy/sync/capture.mjs');
 let h=[];for(let i=0;i<7;i++)h=nextHistory(h,{at:'2026-11-20T10:0'+i+':00Z',outcome:i%2?'failed':'complete',...(i%2?{error:'The timing match is ambiguous'}:{})});
 assert.equal(h.length,5);assert.equal(h[0].at,'2026-11-20T10:02:00Z');assert.equal(h.at(-1).outcome,'complete');assert.equal(h.find(e=>e.outcome==='failed').error,'The timing match is ambiguous');
 assert.deepEqual(nextHistory('corrupt',{at:'x',outcome:'cancelled'}),[{at:'x',outcome:'cancelled'}]);
});

// Owner 21 Nov: "microphone clipping or capture buffering is too high" on the Pi.
test('bunched microphone delivery no longer skews timing: the sample clock anchors on the soonest chunk',()=>{
 const rate=48000,window=4096,hop=480,energy=new CaptureEnergy({rate,window,hop}),even=new CaptureEnergy({rate,window,hop});
 const tone=n=>{const b=Buffer.alloc(n*2);for(let i=0;i<n;i++)b.writeInt16LE(Math.round(4000*Math.sin(i/9)),i*2);return b;};
 // 4 s of audio in 20 ms chunks; in one copy the delivery stalls and arrives in 400 ms bursts up to 380 ms late.
 const chunk=960;let t0=1000;for(let k=0;k<200;k++){const due=t0+(k+1)*20;even.push(tone(chunk),due);}
 for(let k=0;k<200;k+=20){const due=t0+(k+20)*20;energy.push(tone(chunk*20),due+380*((k/20)%2));}
 const a=even.result(),b=energy.result();assert.equal(b.timing,'sample-clock');assert.ok(b.maxChunkMs>=400);
 assert.equal(a.points.length,b.points.length);for(let i=0;i<a.points.length;i++)assert.ok(Math.abs(a.points[i].t-b.points[i].t)<1,`point ${i}`);
});
test('clipping has its own clear message; a stalled recording is named separately',()=>{
 const f=musicFixture({delay:100});
 assert.throws(()=>estimateSync(f.reference,{...f.capture,clipPercent:.4}),/clipped/);
 assert.throws(()=>estimateSync(f.reference,{...f.capture,timing:'sample-clock',maxChunkMs:2500}),/stalled/);
 const r=estimateSync(f.reference,{...f.capture,timing:'sample-clock',maxChunkMs:600},{displayDelayMs:0,displayUncertaintyMs:12});assert.ok(Math.abs(r.relativeLagMs-100)<=5);
});
