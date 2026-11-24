import test from 'node:test';
import assert from 'node:assert/strict';
import {crossfadeState,crossfadeValues} from '../shared/crossfade.js';
test('older Music Assistant: switch plus whole seconds; 1.2 s becomes 1 s',()=>{
 const s=crossfadeState({values:{crossfade:{type:'boolean',value:false,default_value:false},crossfade_duration:{type:'integer',value:null,default_value:6,range:[1,10]}}});
 assert.deepEqual(s,{supported:true,kind:'switch',enabled:false,seconds:6,min:1,max:10,step:1});
 assert.deepEqual(crossfadeValues(s,{enabled:true,seconds:1.2}),{crossfade:true,crossfade_duration:1});
 assert.deepEqual(crossfadeValues(s,{enabled:false}),{crossfade:false});
});
test('newer Music Assistant: smart fades with decimal seconds keeps 1.2 s and clamps',()=>{
 const s=crossfadeState({values:[{key:'smart_fades_mode',type:'string',value:'disabled'},{key:'crossfade_duration',type:'float',value:8,range:[1,10]}]});
 assert.equal(s.kind,'smart-fades');assert.equal(s.enabled,false);assert.equal(s.step,0.1);
 assert.deepEqual(crossfadeValues(s,{enabled:true,seconds:1.2}),{smart_fades_mode:'standard_crossfade',crossfade_duration:1.2});
 assert.deepEqual(crossfadeValues(s,{enabled:true,seconds:40}),{smart_fades_mode:'standard_crossfade',crossfade_duration:10});
});
test('players without crossfade settings are not offered it',()=>{
 assert.deepEqual(crossfadeState({values:{volume_normalization:{value:true}}}),{supported:false});
 assert.throws(()=>crossfadeValues({supported:false},{enabled:true}));assert.throws(()=>crossfadeValues(crossfadeState({values:{crossfade:{value:true},crossfade_duration:{value:2}}}),{enabled:'yes'}));
});
