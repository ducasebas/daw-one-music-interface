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
test('sweep diagnostics: late output up to 2.5 s is found, and each failure names the check that failed',async()=>{
 const {captureSeconds,analyserVersion}=await import('../deploy/measurement/signal.mjs');
 const input=sweep(-30),noise=(len,amp,seed=11)=>{const a=new Float32Array(len);for(let i=0;i<len;i++){seed=(seed*16807)%2147483647;a[i]=(seed/2147483647-.5)*amp;}return a;};
 const place=(delay,gain=1,amp=.0005,len=rate*captureSeconds)=>{const r=noise(len,amp);for(let i=0;i<input.length&&i+delay<len;i++)r[i+delay]+=input[i]*gain;return r;};
 // 1.4 s output latency: the 3.9.x analyser only searched up to 1 s and called this "not detected".
 const late=analyse(input,place(Math.round(rate*1.4)));assert.equal(late.sweepDetected,true);assert.equal(late.valid,true);assert.ok(Math.abs(late.captureDelayMs-1400)<2);
 assert.equal(late.diagnostics.analyser,analyserVersion);assert.deepEqual(late.diagnostics.failed,[]);assert.ok(late.diagnostics.peaks[0].ratio>=12);
 // The old 5 s capture cut that same sweep off at the end; the analyser now says so instead of only "not detected".
 const cut=analyse(input,place(Math.round(rate*1.4),1,.0005,rate*5));assert.equal(cut.sweepDetected,false);assert.ok(cut.diagnostics.failed.includes('complete'));
 const complete=cut.diagnostics.checks.find(c=>c.id==='complete');assert.ok(complete.value.sweepEndMs>=complete.value.recordingMs-100);
 // A sweep buried in room noise: prominence or level fails, and the values are reported.
 const buried=analyse(input,place(rate*.2,.002,.05));assert.equal(buried.sweepDetected,false);assert.ok(buried.diagnostics.failed.some(id=>['prominence','level'].includes(id)));
 for(const c of buried.diagnostics.checks)assert.ok('value' in c&&'need' in c&&typeof c.ok==='boolean');
 // Silence from the speaker (wrong output): no peak, every relevant check explains itself.
 const silent=analyse(input,noise(rate*captureSeconds,.001));assert.equal(silent.sweepDetected,false);assert.ok(silent.diagnostics.failed.length>0);
 assert.ok(Number.isFinite(silent.diagnostics.noiseDbfs)||silent.diagnostics.noiseDbfs===null);
 assert.doesNotThrow(()=>JSON.stringify(late));
});
test('the GUI explains a failed sweep and flags results from an older analyser on the device',async()=>{
 const {sweepDiagnosis,measurementAnalyserVersion}=await import('../shared/room-measurement.js');
 // A 3.9.x result has no diagnostics: the GUI asks for the one-time host-helper refresh.
 const old=sweepDiagnosis({valid:false,sweepDetected:false,snrDb:30,correlation:.04});assert.equal(old.length,1);assert.match(old[0][0],/update-appliance\.sh --apply/);
 // A sweep arriving 1.4 s late in a 5 s recording runs past the end.
 const input=sweep(-30),late=Math.round(rate*1.4),r=new Float32Array(rate*5);r.set(input.subarray(0,r.length-late),late);
 const cut=analyse(input,r),reasons=sweepDiagnosis(cut);
 assert.ok(reasons.some(([k])=>k.startsWith('The sweep arrived')));assert.ok(!reasons.some(([k])=>k.includes('older')));assert.equal(cut.diagnostics.analyser,measurementAnalyserVersion);
 assert.match(sweepDiagnosis({diagnostics:{...cut.diagnostics,analyser:'2026.11.19'}})[0][0],/older measurement software/);
});
test('owner Pi 19 Nov: a real sweep after a slow USB-microphone start-up burst is detected, and SNR ignores the burst',()=>{
 // Pi result: prominence 232/113, delays 177/207 ms, yet "not detected" with SNR -0.6/-13.7 dB. The level check compared
 // against a lead-in still holding the microphone's settling offset, and the fallback SNR used the first 100 ms.
 const input=sweep(-36),make=(burst,settleMs,len=7)=>{const r=new Float32Array(rate*len);let seed=3;
  for(let i=0;i<r.length;i++){seed=(seed*16807)%2147483647;const t=i/rate;r[i]=(seed/2147483647-.5)*.004+burst*Math.exp(-t/(settleMs/1000))*(t<.05?Math.sin(2*Math.PI*900*t):1)+.01*Math.sin(2*Math.PI*35*t);}
  const d=Math.round(.177*rate);for(let i=0;i<input.length&&i+d<r.length;i++)r[i+d]+=input[i]*.25/10**(-36/20)*.05;return r;};
 const clean=analyse(input,make(0,600)),pi=analyse(input,make(.3,600)),strong=analyse(input,make(.6,900)),short=analyse(input,make(.3,600,5));
 for(const a of [clean,pi,strong,short]){assert.equal(a.sweepDetected,true);assert.ok(Math.abs(a.captureDelayMs-177)<1);assert.ok(Math.abs(a.snrDb-clean.snrDb)<1,`SNR ${a.snrDb} vs ${clean.snrDb}`);}
 assert.equal(pi.diagnostics.settling,true);assert.equal(clean.diagnostics.settling,false);assert.ok(pi.diagnostics.startBurstDbfs>clean.diagnostics.startBurstDbfs+20);
 // Quiet here (rumble), so the honest outcome is "too quiet by N dB", not "not detected".
 assert.deepEqual(pi.diagnostics.failed,['snr']);assert.ok(pi.neededDb>0);assert.ok(!pi.warnings.some(w=>w.startsWith('A complete reference sweep')));
});
test('owner Pi 20 Nov: an idle "Fault Clock" does not block a sweep; real amplifier faults still do',async()=>{
 const {blockingFaults,parseDsp}=await import('../deploy/manager/dsp.mjs');
 // Real amixer output shape from the owner's Pi while nothing played: the clock fault is latched until a stream starts.
 const amixer=["numid=9,iface=MIXER,name='Fault Clock'\n  ; type=BOOLEAN,access=r--v----,values=1\n  : values=on","numid=4,iface=MIXER,name='Fault Left Channel OC'\n  ; type=BOOLEAN,access=r--v----,values=1\n  : values=off"].join('\n');
 const idle=parseDsp(amixer).faults;assert.deepEqual(idle.filter(f=>f.active).map(f=>f.name),['Fault Clock']);assert.deepEqual(blockingFaults(idle),[]);
 assert.equal(blockingFaults([{name:'Fault Left Channel OC',active:true},{name:'Fault Clock',active:true}]).length,1);
 const make=faults=>{let journal=null;const controls=Array.from({length:15},(_,i)=>({id:i+1,name:String(30+i*100).padStart(5,'0'),value:0,min:-15,max:15}));
  return {run:async()=>'',dsp:{get:async()=>({supported:true,faults,controls}),set:async()=>{}},read:()=>journal,write:v=>{journal=v;},clear:()=>{journal=null;},output:'plughw:CARD=LouderRaspberry,DEV=0'};};
 await prepareMeasurement(make(idle));
 await assert.rejects(prepareMeasurement(make([{name:'Fault PVDD Undervoltage',active:true},...idle])),/Resolve amplifier faults/);
});
