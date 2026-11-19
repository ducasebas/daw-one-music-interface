import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseDsp,dspController} from '../deploy/manager/dsp.mjs';
import {roomDspChanges} from '../deploy/manager/measurement.mjs';
import {dspSwitchValues,dspPreset,resetDspControls,dspControlLabel} from '../shared/dsp-settings.js';
const integer=(id,name,min,max,value)=>`numid=${id},iface=MIXER,name='${name}'\n ; type=INTEGER,access=rw---,values=1,min=${min},max=${max}\n : values=${value}\n`;
const toggle=value=>`numid=22,iface=MIXER,name='Equalizer'\n ; type=ENUMERATED,access=rw------,values=1,items=2\n ; Item #0 'On'\n ; Item #1 'Off'\n : values=${value}\n`;
const raw=values=>integer(1,'00020 Hz',-15,15,values[1])+integer(2,'Channel Left Gain',-110,0,values[2])+integer(3,'Channel Right Gain',-110,0,values[3])+toggle(values[22]);
test('actual Louder labels make enum zero On and one Off; unknown legacy metadata never guesses',()=>{
 const c=parseDsp(toggle(1)).controls[0];assert.deepEqual(c.options,[{value:0,label:'On'},{value:1,label:'Off'}]);assert.deepEqual(dspSwitchValues(c),{on:0,off:1});
 assert.deepEqual(dspSwitchValues({...c,options:[{value:0,label:'Off'},{value:1,label:'On'}]}),{on:1,off:0});
 assert.equal(dspSwitchValues({...c,options:undefined}),null);
 assert.deepEqual(dspSwitchValues({...c,type:'BOOLEAN',options:undefined}),{on:1,off:0});
});
test('Flat and Soft enable EQ according to metadata and do not confuse On with gain',()=>{
 const original=parseDsp(raw({1:5,2:-8,3:-8,22:1})).controls;
 for(const name of ['flat','soft']){const preset=dspPreset(original,name);assert.equal(preset.find(c=>c.name==='Equalizer').value,0);assert.equal(preset.find(c=>c.id===1).value,name==='flat'?0:-3);assert.equal(preset.find(c=>c.id===2).value,name==='flat'?0:-8);}
 assert.equal(original.find(c=>c.name==='Equalizer').value,1);
 const reversed=original.map(c=>c.name==='Equalizer'?{...c,options:[{value:0,label:'Off'},{value:1,label:'On'}]}:c);assert.equal(dspPreset(reversed,'flat').find(c=>c.name==='Equalizer').value,1);
 const legacy=original.map(c=>({...c,options:undefined}));assert.throws(()=>dspPreset(legacy,'flat'),/labels/);assert.equal(resetDspControls(legacy).find(c=>c.name==='Equalizer').value,1);assert.equal(resetDspControls(original).find(c=>c.name==='Equalizer').value,0);
 assert.equal(dspControlLabel({name:'00020 Hz'}),'20 Hz');assert.equal(dspControlLabel({name:'EQ 02000 Hz'}),'2 kHz');
});
test('all exact driver fault names are exposed, including thermal, clock and channel faults',()=>{
 const names=['Fault Over Temperature Shutdown','Warning Over Temperature 112C','Fault Clock','Fault Left Channel OC','Fault Right Channel DC','Fault PVDD Undervoltage'];
 const text=names.map((name,i)=>`numid=${i+30},iface=MIXER,name='${name}'\n ; type=BOOLEAN,access=r----,values=1\n : values=${i%2?'off':'on'}\n`).join('');
 const parsed=parseDsp(text);assert.equal(parsed.controls.length,0);assert.deepEqual(parsed.faults.map(c=>c.name),names);assert.deepEqual(parsed.faults.map(c=>c.active),[true,false,true,false,true,false]);
 assert.equal(parseDsp(text.replace('values=on\n','values=unknown\n')).faults.length,5);
});
test('incomplete or repeated enum labels do not make an actionable switch',()=>{
 for(const text of [toggle(1).replace(" ; Item #1 'Off'\n",''),toggle(1).replace("#1 'Off'","#0 'Off'")])assert.equal(dspSwitchValues(parseDsp(text).controls[0]),null);
});
test('room correction enables the named On state and refuses legacy unknown enum labels',()=>{
 const controls=parseDsp(raw({1:0,2:0,3:0,22:1})).controls,points=[{hz:20,db:-5.6},{hz:1000,db:0}];
 assert.deepEqual(roomDspChanges(controls,points),[{id:1,value:-6},{id:22,value:0}]);
 const reversed=controls.map(c=>c.name==='Equalizer'?{...c,options:[{value:0,label:'Off'},{value:1,label:'On'}]}:c);
 assert.equal(roomDspChanges(reversed,points).at(-1).value,1);
 assert.throws(()=>roomDspChanges(controls.map(c=>({...c,options:undefined})),points),/labels are unavailable/);
 assert.equal(roomDspChanges(controls.map(c=>({...c,name:c.id===1?'EQ 00020 Hz':c.name})),points)[0].value,-6);
});
test('actual ALSA writes enable enum On=0, reserve headroom and verify readback',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'tb-dsp-')),values={1:0,2:0,3:0,22:1},calls=[];
 const run=async(_p,args)=>{if(args.includes('contents'))return raw(values);const i=args.indexOf('cset');if(i>=0){const id=Number(args[i+1].split('=')[1]);values[id]=Number(args[i+2]);calls.push([id,values[id]]);}return '';};
 try{const dsp=dspController({run,statePath:join(dir,'standby.json')});const result=await dsp.set([{id:22,value:0},{id:1,value:6}]);assert.equal(result.controls.find(c=>c.name==='Equalizer').value,0);assert.deepEqual(dspSwitchValues(result.controls.find(c=>c.name==='Equalizer')),{on:0,off:1});assert.equal(values[2],-6);assert.equal(values[3],-6);assert.ok(calls.some(([id,value])=>id===22&&value===0));}
 finally{rmSync(dir,{recursive:true,force:true});}
});
test('a failed band write restores the previous equalizer and channel gains',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'tb-dsp-')),values={1:0,2:0,3:0,22:1},original={...values};let failed=false;
 const run=async(_p,args)=>{if(args.includes('contents'))return raw(values);const i=args.indexOf('cset');if(i>=0){const id=Number(args[i+1].split('=')[1]);if(id===1&&!failed){failed=true;throw Error('ALSA write failed');}values[id]=Number(args[i+2]);}return '';};
 try{const dsp=dspController({run,statePath:join(dir,'standby.json')});await assert.rejects(()=>dsp.set([{id:22,value:0},{id:1,value:6}]),/previous ALSA values/);assert.deepEqual(values,original);}
 finally{rmSync(dir,{recursive:true,force:true});}
});
test('local volume while Music Assistant is away moves the gains between silent and the saved level, never louder',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'tb-local-')),values={1:0,2:-10,3:-20,22:1};
 const run=async(_p,args)=>{if(args.includes('contents'))return raw(values);const i=args.indexOf('cset');if(i>=0){values[Number(args[i+1].split('=')[1])]=Number(args[i+2]);}return '';};
 try{const dsp=dspController({run,statePath:join(dir,'standby.json'),volumePath:join(dir,'local-volume.json')});
  let r=await dsp.localVolume(1);assert.deepEqual(r,{level:100,active:false,supported:true});assert.equal(values[2],-10,'louder than saved is impossible');
  r=await dsp.localVolume(-1);assert.equal(r.level,90);assert.equal(values[2],-20);assert.equal(values[3],-29);
  for(let i=0;i<12;i++)r=await dsp.localVolume(-1);assert.equal(r.level,0);assert.equal(values[2],-110);assert.equal(values[3],-110);
  r=await dsp.localVolume(1);assert.equal(r.level,10);
  r=await dsp.localVolume(0);assert.deepEqual(r,{level:100,active:false,supported:true});assert.equal(values[2],-10);assert.equal(values[3],-20);
  // Standby (local pause) and local volume never fight over the same gains.
  await dsp.standby(true);await assert.rejects(dsp.localVolume(-1),/Resume local playback/);await dsp.standby(false);
  await assert.rejects(dsp.localVolume(5),/quieter or louder/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('the simple sound layer adds bass, treble and loudness to a preset, within the band limits',async()=>{
 const {soundCurve,soundSettings}=await import('../shared/dsp-settings.js');
 const band=(id,hz,value=0)=>({id,name:`${String(hz).padStart(5,'0')} Hz`,type:'INTEGER',min:-15,max:15,value});
 const controls=[band(1,60,4),band(2,500),band(3,6000),band(4,12000),{id:9,name:'Channel Left Gain',type:'INTEGER',min:-110,max:0,value:-5},{id:22,name:'Equalizer',type:'ENUMERATED',min:0,max:1,value:1,options:[{value:0,label:'On'},{value:1,label:'Off'}]}];
 const at=(list,id)=>list.find(c=>c.id===id).value;
 let curve=soundCurve(controls,{preset:'flat',bass:4,treble:-2});
 assert.equal(at(curve,1),4);assert.equal(at(curve,2),0);assert.equal(at(curve,3),-2);assert.equal(at(curve,4),-2);assert.equal(at(curve,22),0,'equalizer switched on');
 curve=soundCurve(controls,{preset:'flat',loudness:true});assert.equal(at(curve,1),3);assert.equal(at(curve,4),2);assert.equal(at(curve,2),0);
 curve=soundCurve(controls,{preset:'warm',treble:-6});assert.equal(at(curve,4),-9,'warm −3 plus treble −6');
 curve=soundCurve(controls.map(c=>c.id===1?{...c,min:-3,max:3}:c),{preset:'flat',bass:6,loudness:true});assert.equal(at(curve,1),3,'clamped to the band maximum');
 assert.deepEqual(soundSettings({preset:'loud',bass:99,treble:'x',loudness:1}),{preset:'warm',bass:6,treble:0,loudness:false});
});
