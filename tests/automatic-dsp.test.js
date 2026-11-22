import test from 'node:test';
import assert from 'node:assert/strict';
import {automaticDspSettings,automaticDspChoice,voicingCut,automaticDspProposal,effectiveDspBaseline,dspRamp} from '../shared/automatic-dsp.js';
import {AutomaticDsp} from '../deploy/manager/automatic-dsp.mjs';
import {dspController} from '../deploy/manager/dsp.mjs';

const frequencies=[25,40,63,100,160,250,400,630,1000,1600,2500,4000,6300,10000,16000];
function fixture({off=false}={}){
  let controls=[...frequencies.map((hz,i)=>({id:i+1,name:String(hz).padStart(5,'0'),type:'INTEGER',value:off?8:i===5?-2:0,min:-12,max:12})),{id:16,name:'Equalizer',type:'ENUMERATED',value:off?1:0,min:0,max:1,options:[{value:0,label:'On'},{value:1,label:'Off'}]},{id:17,name:'Channel Left Gain',value:-3,min:-100,max:0},{id:18,name:'Channel Right Gain',value:-3,min:-100,max:0}];
  const files=new Map(),calls=[],context={ready:true,playing:true,selectedLocal:true,bluetooth:false,trackKey:'first',genres:['Jazz']};
  const dsp={get:async()=>({supported:true,controls:structuredClone(controls),faults:[]}),set:async changes=>{calls.push(structuredClone(changes));controls=controls.map(c=>({...c,value:changes.find(v=>v.id===c.id)?.value??c.value}));return dsp.get();}};
  const controller=new AutomaticDsp({dsp,context:async()=>({...context}),read:(p,f)=>files.has(p)?structuredClone(files.get(p)):f,exists:p=>files.has(p),write:(p,v)=>files.set(p,structuredClone(v)),sleep:async()=>{}});
  return {controller,dsp,files,calls,context,controls:()=>controls};
}

test('genre selection is bounded, rejects bad config and falls back for missing/conflicting tags',()=>{
  assert.equal(automaticDspChoice(automaticDspSettings({enabled:true}),['Classical']).profile,'neutral');
  assert.equal(automaticDspChoice({},['Electronic','House']).profile,'bass');
  assert.equal(automaticDspChoice({},['Acoustic']).profile,'vocal');
  for(const genres of [[],['unmapped'],['Electronic','Jazz']])assert.equal(automaticDspChoice({},genres).profile,'warm');
  assert.equal(automaticDspChoice({mode:'fixed',fallback:'neutral'},['Jazz']).profile,'neutral');
  for(const bad of [{enabled:'yes'},{strength:2},{mode:'inferred-ai'},{fallback:'boost'},{path:'/tmp'}])assert.throws(()=>automaticDspSettings(bad));
  for(const profile of ['neutral','warm','bass','vocal'])for(const hz of frequencies)for(const strength of [0,.2,.7,1])assert.ok(voicingCut(hz,profile,strength)<=0&&voicingCut(hz,profile,strength)>=-3);
});

test('automatic sound saves the actual custom baseline, cuts only and restores it without gain writes',async()=>{
  const f=fixture(),original=f.controls().map(c=>({...c}));await f.controller.configure({enabled:true});
  assert.equal(f.controller.publicStatus().activeProfile,'warm');
  for(const c of f.controls().filter(c=>c.id<16))assert.ok(c.value<=original.find(v=>v.id===c.id).value&&c.value>=original.find(v=>v.id===c.id).value-3);
  assert.ok(f.calls.flat().every(c=>c.id<17));assert.equal(f.controls().find(c=>c.id===6).value,-3);
  await f.controller.configure({enabled:false});assert.deepEqual(f.controls(),original);
});

test('a disabled custom curve is normalized while off and does not turn into an unexpected positive boost',async()=>{
  const f=fixture({off:true}),original=structuredClone(f.controls());await f.controller.configure({enabled:true});
  assert.ok(f.controls().filter(c=>c.id<16).every(c=>c.value<=0));
  assert.ok(f.calls[0].every(c=>c.id<16&&c.value===0));await f.controller.configure({enabled:false});assert.deepEqual(f.controls(),original);
});

test('track changes select a new voicing but late metadata and paused or unrelated remote events do not change EQ',async()=>{
  const f=fixture();await f.controller.configure({enabled:true});const count=f.calls.length;
  f.context.genres=['Electronic'];await f.controller.update();assert.equal(f.calls.length,count);
  f.context.trackKey='second';await f.controller.update();assert.equal(f.controller.publicStatus().activeProfile,'bass');
  const next=f.calls.length;
  for(const patch of [{playing:false},{selectedLocal:false},{ready:false}]){
    Object.assign(f.context,{ready:true,playing:true,selectedLocal:true,bluetooth:false,trackKey:'next'},patch);await f.controller.update();assert.equal(f.calls.length,next);
  }
});

test('rapid track skips during the settle delay defer adjustment and avoid I2C/ALSA writes',async()=>{
  const f=fixture();await f.controller.configure({enabled:true});const count=f.calls.length;
  const sleeps=[];
  f.controller.sleep=async ms=>{sleeps.push(ms);f.context.trackKey='skipped-during-settle';};
  f.context.trackKey='intermediate';f.context.genres=['Electronic'];
  const res=await f.controller.update();
  assert.equal(res.deferred,true);
  assert.equal(f.calls.length,count);
  assert.deepEqual(sleeps,[2000]);
});

test('external EQ edits stop automation and disabling preserves those edits',async()=>{
  const f=fixture();await f.controller.configure({enabled:true});await f.dsp.set([{id:1,value:4}]);const count=f.calls.length;f.context.trackKey='changed';await f.controller.update();
  assert.equal(f.controller.publicStatus().settings.enabled,false);assert.match(f.controller.publicStatus().error,/equalizer changed/);assert.equal(f.calls.length,count);assert.equal(f.controls()[0].value,4);
  await f.controller.configure({enabled:false});assert.equal(f.controls()[0].value,4);
});

test('all ramp frames remain within the saved baseline and one dB per band',async()=>{
  const f=fixture(),controls=f.controls(),baseline=effectiveDspBaseline(controls),p=automaticDspProposal(controls,baseline,{enabled:true,strength:1},['Electronic']);let before=structuredClone(controls);
  for(const frame of dspRamp(controls,p.changes))for(const change of frame){const old=before.find(c=>c.id===change.id),base=baseline.find(c=>c.id===change.id);if(change.id<16){assert.ok(Math.abs(change.value-old.value)<=1);assert.ok(change.value<=base.value&&change.value>=base.value-3);}old.value=change.value;}
});

test('fault/activity gates and corrupt saved settings never initiate writes',async()=>{
  const f=fixture();f.context.ready=false;await assert.rejects(f.controller.configure({enabled:true}));assert.equal(f.calls.length,0);
  const bad=new AutomaticDsp({dsp:f.dsp,context:async()=>f.context,read:()=>({schema:900}),exists:()=>true,write:()=>assert.fail('corrupt state must not be overwritten')});await assert.rejects(bad.configure({enabled:true}),/recovery/);
});

test('a source change during the bounded ramp disables automation without raising levels',async()=>{
  const f=fixture();f.controller.sleep=async()=>{f.context.trackKey='new-song';};await assert.rejects(f.controller.configure({enabled:true,strength:1}),/stopped/);
  assert.equal(f.controller.publicStatus().settings.enabled,false);assert.ok(f.controls().filter(c=>c.id<16).every(c=>c.value<=0));
});

test('real ALSA planning restores a disabled positive curve without ever exposing an unprotected boost',async()=>{
 const values=Object.fromEntries(frequencies.map((_,i)=>[i+1,8]));Object.assign(values,{16:1,17:0,18:0});const original={...values},calls=[];
 const contents=()=>frequencies.map((hz,i)=>`numid=${i+1},iface=MIXER,name='${String(hz).padStart(5,'0')}'\n ; type=INTEGER,values=1,min=-12,max=12\n : values=${values[i+1]}\n`).join('')+`numid=16,iface=MIXER,name='Equalizer'\n ; type=ENUMERATED,values=1,items=2\n ; Item #0 'On'\n ; Item #1 'Off'\n : values=${values[16]}\n`+[17,18].map((id,i)=>`numid=${id},iface=MIXER,name='Channel ${i?'Right':'Left'} Gain'\n ; type=INTEGER,values=1,min=-110,max=0\n : values=${values[id]}\n`).join('');
 const dsp=dspController({statePath:'/tmp/tunebox-no-standby-'+process.pid,run:async(_p,args)=>{if(args.includes('contents'))return contents();const index=args.indexOf('cset');const id=Number(args[index+1].split('=')[1]);values[id]=Number(args[index+2]);calls.push(id);if(values[16]===0){const boost=frequencies.reduce((sum,_,i)=>sum+Math.max(0,values[i+1]),0);assert.ok(values[17]<=-boost&&values[18]<=-boost,'intermediate active EQ needs headroom');}return '';}});
 const files=new Map(),controller=new AutomaticDsp({dsp,context:async()=>({ready:true,selectedLocal:true,playing:true,trackKey:'one',genres:['Jazz'],bluetooth:false}),read:(p,d)=>files.get(p)||d,write:(p,v)=>files.set(p,structuredClone(v)),exists:p=>files.has(p),sleep:async()=>{}});
 await controller.configure({enabled:true});assert.equal(values[16],0);const beforeDisable=calls.length;await controller.configure({enabled:false});assert.equal(calls[beforeDisable],16);assert.deepEqual(values,original);
});

test('returning from Bluetooth applies the local genre even for the same track',async()=>{
 const f=fixture();f.context.genres=['Electronic'];f.context.bluetooth=true;await f.controller.configure({enabled:true});assert.equal(f.controller.publicStatus().activeProfile,'warm');f.context.bluetooth=false;await f.controller.update();assert.equal(f.controller.publicStatus().activeProfile,'bass');
});

test('switching to Bluetooth applies the fallback once, including without a music server',async()=>{
 const f=fixture();f.context.genres=['Electronic'];await f.controller.configure({enabled:true});assert.equal(f.controller.publicStatus().activeProfile,'bass');
 Object.assign(f.context,{bluetooth:true,selectedLocal:false,playing:false,trackKey:null});await f.controller.update();assert.equal(f.controller.publicStatus().activeProfile,'warm');const count=f.calls.length;
 await f.controller.update();assert.equal(f.calls.length,count);
});
