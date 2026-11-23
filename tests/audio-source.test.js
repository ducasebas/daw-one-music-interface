import test from 'node:test';
import assert from 'node:assert/strict';
import {createAudioSource} from '../src/audio-source.js';

test('fast measurements reach the meter without changing the metadata used by the settings tree',()=>{
 const source=createAudioSource(),frames=[];const off=source.subscribe(value=>frames.push(value.measurement?.capturedAt));
 assert.equal(source.publish({enabled:true,status:'pcm',measurement:{capturedAt:1}}),true);const metadata=source.metadata;
 for(let stamp=2;stamp<=100;stamp++)assert.equal(source.publish({enabled:true,status:'pcm',measurement:{capturedAt:stamp}}),false);
 assert.equal(source.metadata,metadata);assert.equal(source.metadata.measurement,undefined);assert.equal(source.get().measurement.capturedAt,100);assert.equal(frames.length,100);
 off();source.publish({enabled:true,status:'pcm',measurement:{capturedAt:101}});assert.equal(frames.length,100);
});
test('configuration, selected output and lost measurements remain visible independently of live values',()=>{
 const source=createAudioSource(),values=[];source.subscribe(value=>values.push(value));
 source.publish({enabled:true,configured:true,matchesSelected:true,status:'pcm',measurement:{capturedAt:1}});
 assert.equal(source.publish({enabled:true,configured:true,matchesSelected:false,status:'pcm',measurement:{capturedAt:2}}),true);assert.equal(source.metadata.matchesSelected,false);
 assert.equal(source.publish({enabled:true,configured:true,matchesSelected:false,status:'stale',measurement:null}),true);assert.equal(source.get().measurement,null);assert.equal(values.at(-1).status,'stale');
 assert.equal(source.publish({enabled:false,configured:true,matchesSelected:false,status:'disabled',measurement:null}),true);assert.equal(source.metadata.enabled,false);
});
