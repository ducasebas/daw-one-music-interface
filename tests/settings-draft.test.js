import test from 'node:test';
import assert from 'node:assert/strict';
import {draftAfterSave} from '../shared/settings-draft.js';

test('a normal save adopts canonical server values and its revision',()=>{
 const sent={revision:1,maxVolume:70,prefs:{widgets:['clock'],widgetPlacement:'bottom'}};
 const saved={...sent,revision:2,maxVolume:60};
 assert.deepEqual(draftAfterSave(sent,structuredClone(sent),saved),saved);
});
test('newer nested edits survive an earlier save and retain its confirmed fields and revision',()=>{
 const sent={revision:1,prefs:{widgets:['upnext','clock'],widgetPlacement:'bottom'},display:{brightness:40}};
 const current={...sent,prefs:{...sent.prefs,widgetPlacement:'top'},display:{brightness:75}};
 const saved={...sent,revision:2,serverField:'canonical'};
 const before=structuredClone({sent,current,saved});
 assert.deepEqual(draftAfterSave(sent,current,saved),{...current,revision:2,serverField:'canonical'});
 assert.deepEqual({sent,current,saved},before);
});
test('a new array selection or reversal remains an unsaved edit, including false, zero and null',()=>{
 const sent={revision:1,prefs:{widgets:['source','clock'],enabled:true,delay:100,color:'gold'}};
 const current={revision:1,prefs:{widgets:['clock','source'],enabled:false,delay:0,color:null}};
 assert.deepEqual(draftAfterSave(sent,current,{...sent,revision:2}),{...current,revision:2});
});
test('server normalization is retained except for fields the user edited after submission',()=>{
 const sent={revision:1,prefs:{first:1,second:2,remove:'old'}};
 const current={revision:1,prefs:{first:3,second:2,newValue:'new'}};
 const saved={revision:2,prefs:{first:1,second:20,remove:'old',serverDefault:true}};
 assert.deepEqual(draftAfterSave(sent,current,saved),{revision:2,prefs:{first:3,second:20,newValue:'new',serverDefault:true}});
});
test('a caller cannot overwrite the acknowledged revision or create prototype properties',()=>{
 const sent={revision:1,prefs:{}},current=JSON.parse('{"revision":999,"prefs":{"__proto__":{"unsafe":true}}}');
 const value=draftAfterSave(sent,current,{revision:2,prefs:{}});
 assert.equal(value.revision,2);assert.equal(Object.hasOwn(value.prefs,'__proto__'),true);
 assert.equal(Object.getPrototypeOf(value.prefs),Object.prototype);assert.equal({}.unsafe,undefined);
});
