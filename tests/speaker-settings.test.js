import {test} from 'node:test';
import assert from 'node:assert/strict';
import {speakerSettings,speakerRecommendation} from '../shared/speaker-settings.js';
import {preferenceDefaults,validatePreferences} from '../shared/preferences.js';
import {dspPreset,startingDspControls,resetDspControls} from '../shared/dsp-settings.js';
import {rotateVolume} from '../shared/volume.js';
import {PreferencesStore} from '../server/preferences-store.js';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const band=(id,hz,value=0)=>({id,name:String(hz).padStart(5,'0')+' Hz',type:'INTEGER',min:-15,max:15,value});
const controls=[band(1,20),band(2,1000),band(3,8000),{id:4,name:'Channel Left Gain',type:'INTEGER',min:-110,max:0,value:-8},{id:22,name:'Equalizer',type:'ENUMERATED',min:0,max:1,value:1,options:[{value:0,label:'On'},{value:1,label:'Off'}]}];
test('speaker data is optional, bounded and survives preference validation',()=>{
 const optional=speakerSettings();assert.equal(optional.impedanceOhms,null);assert.equal(optional.rmsWatts,null);
 const speakers={impedanceOhms:8,rmsWatts:20,sensitivity:'gentle',voicing:'warm'};
 assert.deepEqual(validatePreferences({...preferenceDefaults(),speakers}).speakers,speakers);
 for(const value of [{impedanceOhms:2},{rmsWatts:0},{rmsWatts:1001},{sensitivity:'unbounded'},{wattsLimit:50}])assert.throws(()=>speakerSettings(value));
 assert.deepEqual(speakerRecommendation(speakers),{sensitivity:'gentle',ceiling:40});
});
test('warm DSP only cuts upper bands, uses real On labels and does not raise channel gain',()=>{
 const warm=dspPreset(controls,'warm');assert.deepEqual(warm.slice(0,3).map(c=>c.value),[0,-2,-3]);
 assert.equal(warm.find(c=>c.name==='Equalizer').value,0);assert.equal(warm.find(c=>c.name==='Channel Left Gain').value,-8);
 assert.equal(resetDspControls(controls).find(c=>c.name==='Channel Left Gain').value,0);
 assert.deepEqual(startingDspControls(controls,'warm'),warm);
 const custom=controls.map(c=>c.id===2?{...c,value:3}:c);assert.equal(startingDspControls(custom,'warm'),custom);assert.equal(startingDspControls(controls,'keep'),controls);
});
test('gentle volume sensitivity reduces gesture gain within the same ceiling',()=>{
 const gentle=rotateVolume(30,-90,0,100,.5),normal=rotateVolume(30,-90,0,100);
 assert.ok(gentle>30&&gentle<normal);assert.equal(rotateVolume(99,-90,0,100,.5),100);
});
test('speaker metadata stays atomic without introducing unknown top-level keys for rollback',()=>{
 const directory=mkdtempSync(join(tmpdir(),'tunebox-speakers-'));
 try{
  const speakers={impedanceOhms:8,rmsWatts:20,sensitivity:'gentle',voicing:'warm'};
  new PreferencesStore(directory).save(0,{language:'nl',maxVolume:35,speakers});
  const raw=JSON.parse(readFileSync(join(directory,'preferences.json')));
  assert.equal(Object.hasOwn(raw,'speakers'),false);assert.deepEqual(raw.prefs.speakerProfile,speakers);
  const legacyKeys=['revision','prefs','display','themePreferences','language','audioEnabled','clock','presence','dashboard','maxVolume','buttonAction','setupCompleted','setupDeferred'];
  assert.ok(Object.keys(raw).every(key=>legacyKeys.includes(key)));
  const restored=new PreferencesStore(directory).get();assert.equal(restored.revision,1);assert.equal(restored.language,'nl');assert.equal(restored.maxVolume,35);assert.deepEqual(restored.speakers,speakers);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
