import test from 'node:test';
import assert from 'node:assert/strict';
import {startSkipHold,observeSkip,skipHoldMs} from '../shared/skip-hold.js';
const a={id:'a',title:'Old'},b={id:'b',title:'New'},c={id:'c',title:'Later'};
test('skipping keeps the old track with loading until a different track arrives',()=>{
 let h=startSkipHold(a,0),r=observeSkip(h,a,100);assert.equal(r.display,a);assert.equal(r.loading,true);
 r=observeSkip(r.hold,b,900);assert.equal(r.display,b);assert.equal(r.loading,false);
});
test('a stale report of the old track after the new one does not flash back; later tracks are accepted',()=>{
 let r=observeSkip(startSkipHold(a,0),b,500);r=observeSkip(r.hold,a,800);assert.equal(r.display,b);assert.equal(r.loading,false);
 r=observeSkip(r.hold,c,1200);assert.equal(r.display,c);
 r=observeSkip(r.hold,a,5000);assert.equal(r.display,a);assert.equal(r.hold,null);
});
test('without a new track the hold ends after the timeout and shows the live state again',()=>{
 let r=observeSkip(startSkipHold(a,0),a,skipHoldMs+1);assert.equal(r.hold,null);assert.equal(r.display,a);assert.equal(r.loading,false);
 assert.deepEqual(observeSkip(null,b,0),{hold:null,display:b,loading:false});assert.equal(startSkipHold(null,0),null);
});
