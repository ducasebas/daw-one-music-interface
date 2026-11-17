import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalAudio} from '../server/local-audio.js';
import {initializeStartingSound} from '../deploy/manager/starting-sound.mjs';
import {AutomaticDsp} from '../deploy/manager/automatic-dsp.mjs';

const frequencies=[25,40,63,100,160,250,400,630,1000,1600,2500,4000,6300,10000,16000];
function dspFixture(){let controls=[...frequencies.map((hz,i)=>({id:i+1,name:String(hz).padStart(5,'0'),type:'INTEGER',min:-12,max:12,value:0})),{id:16,name:'Equalizer',type:'ENUMERATED',min:0,max:1,value:1,options:[{value:0,label:'On'},{value:1,label:'Off'}]},{id:17,name:'Channel Left Gain',min:-110,max:0,value:-30},{id:18,name:'Channel Right Gain',min:-110,max:0,value:-30}];const calls=[];const dsp={get:async()=>({supported:true,controls:structuredClone(controls),faults:[]}),set:async changes=>{calls.push(changes);controls=controls.map(c=>({...c,value:changes.find(v=>v.id===c.id)?.value??c.value}));return dsp.get();}};const files=new Map();return {dsp,calls,files,controls:()=>controls,read:(p,d)=>files.get(p)||d,write:(p,v)=>files.set(p,structuredClone(v))};}

test('new flat hardware gets the warm default once while channel gains and existing custom curves are preserved',async()=>{
 const f=dspFixture(),args={dsp:f.dsp,read:f.read,write:f.write};const result=await initializeStartingSound(args);assert.equal(result.initialized,true);assert.ok(f.controls().filter(c=>c.id<16).some(c=>c.value<0));assert.equal(f.controls().find(c=>c.id===17).value,-30);assert.ok(f.calls.flat().every(c=>c.id<17));const count=f.calls.length;await initializeStartingSound(args);assert.equal(f.calls.length,count);
 const custom=dspFixture();await custom.dsp.set([{id:5,value:2}]);const n=custom.calls.length;assert.equal((await initializeStartingSound({dsp:custom.dsp,read:custom.read,write:custom.write})).skipped,true);assert.equal(custom.calls.length,n);assert.equal(custom.controls()[4].value,2);
});

test('factory warm voicing is recognized so enabling automatic sound does not stack two warm profiles',async()=>{
 const f=dspFixture();await initializeStartingSound({dsp:f.dsp,read:f.read,write:f.write});const factory=structuredClone(f.controls());const automatic=new AutomaticDsp({dsp:f.dsp,read:f.read,write:f.write,exists:p=>f.files.has(p),context:async()=>({ready:true,playing:true,selectedLocal:true,bluetooth:false,trackKey:'one',genres:['Jazz']}),sleep:async()=>{}});
 await automatic.configure({enabled:true,strength:1});assert.equal(automatic.state.baselineKind,'factory-reference');assert.deepEqual(f.controls(),factory);await automatic.configure({enabled:false});assert.deepEqual(f.controls(),factory);
});

test('starting defaults do not touch unavailable hardware, active calibration or a blocked source',async()=>{
 const f=dspFixture();await initializeStartingSound({dsp:f.dsp,blocked:true,read:f.read,write:f.write});assert.equal(f.calls.length,0);const unavailable={get:async()=>({supported:false})};assert.equal((await initializeStartingSound({dsp:unavailable,read:()=>null,write:()=>assert.fail('no marker for missing hardware')})).skipped,true);
});

test('choosing flat or keep-existing prevents the first-start warm default',async()=>{
 for(const preference of ['flat','keep']){const f=dspFixture();const value=await initializeStartingSound({dsp:f.dsp,preference,read:f.read,write:f.write});assert.equal(value.skipped,true);assert.equal(f.calls.length,0);assert.equal(f.read('/var/lib/daw-one-manager/starting-sound.json').status,'manual-selected');}
});

test('local DSP metadata follows TuneBox rather than the room selected on the touchscreen',async()=>{
 let reads=0;const local={player_id:'tb',available:true,current_media:{uri:'library://local-track',title:'Local'},active_source:'tb'};
 const music={status:'connected',playerId:'rivo',players:[local],playback:{connected:true,queue:[{mediaKey:'remote',genres:['Electronic']}]},transport:{command:async(name,args,options)=>{reads++;assert.equal(name,'player_queues/all');assert.equal(options.maxItems,256);return [{queue_id:'tb',active:true,current_item:{uri:'library://local-track',media_item:{name:'Local',metadata:{genres:['Jazz']}}}}];}}};
 const multiroom={status:()=>({localId:'tb',rooms:[{id:'tb',available:true,members:[]}]}),localPlayback:()=>true};const audio=new LocalAudio(music,multiroom);
 audio.refresh(true);await new Promise(r=>setImmediate(r));assert.deepEqual(audio.get().genres,['Jazz']);assert.notEqual(audio.get().trackKey,'remote');for(let i=0;i<20;i++)audio.refresh(true);await new Promise(r=>setImmediate(r));assert.equal(reads,1);
 music.playerId='tb';music.playback.queue=[{mediaKey:'local-canonical',genres:['Classical']}];audio.refresh(true);music.playerId='rivo';audio.refresh(true);assert.deepEqual(audio.get().genres,['Classical']);assert.equal(reads,1);audio.close();
});

test('unknown local metadata uses a fallback and late responses after close never change it',async()=>{
 let release;const wait=new Promise(r=>release=r);const music={status:'connected',playerId:'rivo',players:[{player_id:'tb',available:true,current_media:{title:'Local'}}],transport:{command:()=>wait}};const multiroom={status:()=>({localId:'tb',rooms:[{id:'tb',available:true,members:[]}]}),localPlayback:()=>true};let changes=0;const audio=new LocalAudio(music,multiroom,{onChange:()=>changes++});audio.refresh(true);audio.close();release([]);await new Promise(r=>setImmediate(r));assert.equal(changes,0);assert.equal(audio.get().ready,false);
});

test('a follower without metadata refreshes its genre from the group leader on the next track',async()=>{
 const leader={player_id:'rivo',current_media:{uri:'library://one'}},local={player_id:'tb',synced_to:'rivo'};let reads=0;
 const music={status:'connected',playerId:'office',players:[local,leader],transport:{command:async()=>{reads++;return [{queue_id:'rivo',active:true,current_item:{uri:leader.current_media.uri,media_item:{name:'Group track',metadata:{genres:[reads===1?'Jazz':'Classical']}}}}];}}};
 const multiroom={status:()=>({localId:'tb',rooms:[{id:'tb',available:true,parentId:'rivo',members:[]},{id:'rivo',available:true,members:['tb']}]}),localPlayback:()=>true},audio=new LocalAudio(music,multiroom);
 audio.refresh(true);await new Promise(r=>setImmediate(r));assert.deepEqual(audio.get().genres,['Jazz']);
 leader.current_media.uri='library://two';audio.refresh(true);await new Promise(r=>setImmediate(r));assert.deepEqual(audio.get().genres,['Classical']);assert.equal(reads,2);audio.close();
});
