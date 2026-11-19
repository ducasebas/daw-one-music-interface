import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMicrophoneCalibration} from '../shared/microphone-calibration.js';
import {roomProfile,roomDefaults,measuredBaseline,measurementSetupKey} from '../shared/room-measurement.js';
import {sweep,analyse,rate} from '../deploy/measurement/signal.mjs';
import {prepareMeasurement,restoreMeasurement} from '../deploy/measurement/session.mjs';
test('serial calibration text accepts UMIK headers and preserves narrow response features',()=>{
 const raw='"Sens Factor =-0.700dB, SERNO: 1234567"\nFrequency dB Phase\n'+Array.from({length:900},(_,i)=>[10*2**(i/80),i===500?12:0,0].join('\t')).join('\n');
 const points=parseMicrophoneCalibration(raw);assert.ok(points.length<=128);assert.ok(points.some(p=>p[1]===12));assert.ok(points.every(p=>p[0]>=20&&p[0]<=24000));assert.deepEqual(roomProfile({...roomDefaults(),calibration:points}).calibration,points);
 assert.deepEqual(parseMicrophoneCalibration('20, 0\n1000, 1\n24000, -2'),[[20,0],[1000,1],[24000,-2]]);
 for(const bad of ['[[20,0],[20,1]]','[[100,100],[1000,0]]','frequency db\n20 0\nbad data','x'.repeat(262145)])assert.throws(()=>parseMicrophoneCalibration(bad));
});
test('unrelated loud noise and a truncated sweep cannot become room correction',()=>{
 const input=sweep(),noise=new Float32Array(rate*5);let seed=7;
 for(let i=rate*.3;i<noise.length;i++){seed=(seed*16807)%2147483647;noise[i]=(seed/2147483647-.5)*.03;}
 const unrelated=analyse(input,noise);assert.ok(unrelated.snrDb>15);assert.equal(unrelated.valid,false);assert.equal(unrelated.sweepDetected,false);
 const truncated=new Float32Array(rate*5);truncated.set(input.subarray(0,rate*2.5),rate*.2);assert.equal(analyse(input,truncated).valid,false);
 const recorded=new Float32Array(rate*5);recorded.set(input,rate*.2);const real=analyse(input,recorded);assert.equal(real.valid,true);assert.ok(Math.abs(real.captureDelayMs-200)<1);
});
test('measurement journals the flat baseline and restores DSP before the local player',async()=>{
 let journal=null;const calls=[],controls=Array.from({length:15},(_,i)=>({id:i+1,name:String(30*2**i).padStart(5,'0'),value:-2,min:-15,max:15}));
 const dsp={get:async()=>({supported:true,faults:[],controls}),set:async changes=>{calls.push(['dsp',changes]);}};
 // Keep the named-band grammar identical to the driver contract.
 controls.forEach((c,i)=>c.name=String(30+i*100).padStart(5,'0'));
 const options={run:async(_p,args)=>{calls.push(args);return args[0]==='is-active'&&args[1]==='tunebox-player.service'?'active':'';},dsp,read:()=>journal,write:v=>{journal=structuredClone(v);},clear:()=>{journal=null;},output:'plughw:CARD=LouderRaspberry,DEV=0'};
 await prepareMeasurement(options);assert.ok(journal);assert.ok(calls.at(-1)[1].every(c=>c.value===0));
 await restoreMeasurement(options);assert.equal(calls.at(-2)[0],'dsp');assert.deepEqual(calls.at(-1),['start','tunebox-player.service']);assert.equal(journal,null);
});
test('failed DSP restore keeps the journal and never reopens audio',async()=>{
 const calls=[],journal={units:['tunebox-player.service'],controls:[{id:1,name:'Equalizer',value:0}]};
 await assert.rejects(restoreMeasurement({read:()=>journal,clear:()=>calls.push('clear'),run:async()=>calls.push('start'),dsp:{get:async()=>({controls:[]})}}));assert.deepEqual(calls,[]);
});
test('verification keeps current DSP and cannot be reused as a correction baseline',async()=>{
 const calls=[],controls=[{id:1,name:'01000',value:-3,min:-15,max:15}];let journal=null;
 await prepareMeasurement({run:async()=>'',dsp:{get:async()=>({supported:true,controls,faults:[]}),set:async()=>calls.push('flatten')},read:()=>journal,write:v=>journal=v,output:'plughw:CARD=LouderRaspberry,DEV=0',verifyCorrection:true});
 assert.deepEqual(calls,[]);assert.equal(journal.controls[0].value,-3);
 const channels=['left','right'].map(channel=>({channel,valid:true,sweepDetected:true,snrDb:30,clipPercent:0}));assert.equal(measuredBaseline({baseline:'current-dsp',channels}),false);assert.equal(measuredBaseline({baseline:'flat-eq',channels}),true);assert.equal(measuredBaseline({channels}),false);
 const setup={profile:roomDefaults(),output:'output',microphone:'hw:1,0'};assert.equal(measurementSetupKey(setup),measurementSetupKey({...setup,profile:{...setup.profile,target:{...setup.profile.target,preset:'warm'}}}));assert.notEqual(measurementSetupKey(setup),measurementSetupKey({...setup,microphone:'hw:2,0'}));
});

test('a microphone start-up click no longer hides a real sweep; quiet sweeps report how many dB are missing',async()=>{
 const {sweepLevels,minimumSnrDb}=await import('../deploy/measurement/signal.mjs');
 const input=sweep(),recorded=new Float32Array(rate*5);let seed=11;
 const level=.004;for(let i=0;i<recorded.length;i++){seed=(seed*16807)%2147483647;recorded[i]=(seed/2147483647-.5)*level;}
 for(let i=0;i<input.length&&i+rate*.2<recorded.length;i++)recorded[i+rate*.2]+=input[i];
 const clean=analyse(input,recorded);assert.equal(clean.sweepDetected,true);
 // A loud click in the first 50 ms of the capture (USB microphone start-up).
 const clicked=recorded.slice();for(let i=0;i<rate*.05;i++)clicked[i]+=i%2?.6:-.6;
 const withClick=analyse(input,clicked);
 assert.ok(withClick.snrDb>0,'click must not make the SNR negative: '+withClick.snrDb);
 assert.ok(Math.abs(withClick.snrDb-clean.snrDb)<1.5,`${withClick.snrDb} vs ${clean.snrDb}`);
 // Weak sweep: still detected, invalid, and reports the missing dB.
 const weak=new Float32Array(rate*5);seed=3;for(let i=0;i<weak.length;i++){seed=(seed*16807)%2147483647;weak[i]=(seed/2147483647-.5)*.02;}
 for(let i=0;i<input.length&&i+rate*.2<weak.length;i++)weak[i+rate*.2]+=input[i]*.5;
 const quiet=analyse(input,weak);
 if(quiet.sweepDetected){assert.equal(quiet.valid,quiet.snrDb>=minimumSnrDb);if(!quiet.valid)assert.equal(quiet.neededDb,Math.ceil(minimumSnrDb-quiet.snrDb));}
 assert.deepEqual(sweepLevels,[-36,-30,-24]);
 assert.throws(()=>sweep(-12),/Unsupported sweep level/);
 const peak=a=>a.reduce((m,v)=>Math.max(m,Math.abs(v)),0),louder=sweep(-30);assert.ok(Math.abs(peak(louder)/peak(input)-10**(6/20))<.01);
});

test('a reverberant room with bass roll-off and rumble is detected (old correlation rule failed); unrelated noise still is not',()=>{
 // Mirrors the owner's capture: audible sweep, correlation around 0.05, rumble masking the bass.
 const input=sweep(),recorded=new Float32Array(rate*5),start=Math.floor(rate*.19);let seed=5;
 const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647-.5;};
 const ir=new Float32Array(Math.floor(rate*.7));ir[0]=1;ir[Math.floor(rate*.004)]=.6;ir[Math.floor(rate*.011)]=-.45;ir[Math.floor(rate*.019)]=.35;
 // Sparse diffuse tail (every 24th sample, each reflection weaker than the direct sound) keeps the test fast.
 for(let i=Math.floor(rate*.02);i<ir.length;i+=24)ir[i]+=rnd()*1.8*Math.exp(-i/(rate*.3));
 const taps=[];for(let i=0;i<ir.length;i++)if(Math.abs(ir[i])>.02)taps.push([i,ir[i]]);
 const wet=new Float32Array(input.length+ir.length);for(let i=0;i<input.length;i++){const x=input[i];if(!x)continue;for(const [d,g] of taps)wet[i+d]+=x*g;}
 let prev=0,out=0;for(let i=0;i<wet.length&&i+start<recorded.length;i++){out=.98*(out+wet[i]-prev);prev=wet[i];recorded[i+start]=out*.5;}
 let lf=0;for(let i=0;i<recorded.length;i++){lf=.999*lf+rnd()*.006;recorded[i]+=lf+rnd()*.0006;}
 const r=analyse(input,recorded);
 assert.ok(r.correlation<.08,'fixture must defeat the old 0.08 correlation rule: '+r.correlation);
 assert.equal(r.sweepDetected,true,JSON.stringify({c:r.correlation,p:r.prominence,s:r.snrDb}));
 assert.ok(Math.abs(r.captureDelayMs-190)<5);
 for(let k=1;k<=6;k++){let s2=k*7919,l2=0;const r2=()=>{s2=(s2*16807)%2147483647;return s2/2147483647-.5;};const noise=new Float32Array(rate*5);for(let i=0;i<noise.length;i++){l2=.999*l2+r2()*.02;noise[i]=l2+r2()*.03;}
  const n=analyse(input,noise);assert.equal(n.sweepDetected,false,JSON.stringify({p:n.prominence}));assert.equal(n.valid,false);}
});
