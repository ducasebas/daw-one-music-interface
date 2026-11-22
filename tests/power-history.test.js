import test from 'node:test';
import assert from 'node:assert/strict';
import {nextPowerHistory,powerDrop,powerDropHoldMs} from '../shared/power-history.js';
const reading=(watts,amps,now,profiles=[{volts:20,amps}])=>({observedAt:now,pd:{status:'active',volts:20,amps,watts,profiles}});
test('remembers the highest contract and reports a lasting lower one with the 3 A cap',()=>{
 let h=nextPowerHistory({},reading(100,5,1000,[{volts:20,amps:5}]),1000);assert.equal(h.highestWatts,100);
 const owner=[{volts:5,amps:3},{volts:9,amps:3},{volts:15,amps:3},{volts:20,amps:3}];
 h=nextPowerHistory(h,reading(60,3,2000,owner),2000);assert.equal(h.lowerSince,2000);
 assert.equal(powerDrop(h,reading(60,3,2000+powerDropHoldMs-1,owner),2000+powerDropHoldMs-1),null,'not before a minute');
 assert.deepEqual(powerDrop(h,reading(60,3,2000+powerDropHoldMs,owner),2000+powerDropHoldMs),{nowWatts:60,bestWatts:100,bestAt:h.highestAt,capped3A:true});
 h=nextPowerHistory(h,reading(100,5,9e5),9e5);assert.equal(h.lowerSince,null);assert.equal(powerDrop(h,reading(100,5,9e5),9e5),null);
});
test('stale or missing readings never raise a warning or change the record',()=>{
 const h=nextPowerHistory({highestWatts:100,lowerSince:5},{observedAt:0,pd:{status:'active',watts:60}},60000);assert.equal(h.lowerSince,null);assert.equal(h.highestWatts,100);
 assert.equal(powerDrop(h,null,1),null);assert.equal(nextPowerHistory({},null,1).highestWatts,null);
});
test('the wall shows a translated, attention-marked notice only for a lasting drop',async()=>{
 const {wallNotifications}=await import('../shared/wall.js');
 const base={mode:'music-assistant',device:{faults:[]},preferences:{}};
 assert.equal(wallNotifications(base,{},false).some(n=>n.id==='power-drop'),false);
 const n=wallNotifications({...base,powerHistory:{drop:{nowWatts:60,bestWatts:100,capped3A:true}}},{},false).find(x=>x.id==='power-drop');
 assert.equal(n.attention,true);assert.deepEqual(n.params,{now:60,best:100});assert.match(n.detail,/3 A/);
 assert.equal(wallNotifications({...base,powerHistory:{drop:{nowWatts:60,bestWatts:100}}},{},true).some(x=>x.id==='power-drop'),false,'not while offline');
});
