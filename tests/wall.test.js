import {test} from 'node:test';
import assert from 'node:assert/strict';
import {screenSettings,wifiReading,sunsetAt,wallNotifications} from '../shared/wall.js';
import {displayGeometry,panelProfile} from '../shared/display.js';
import {settings} from '../shared/settings.js';
import {DeviceRuntime} from '../shared/runtime.js';
test('wall profile is explicit; legacy deployment stays compatible',()=>{
 assert.equal(panelProfile(''), 'legacy-wide');
 assert.equal(panelProfile('?panel=wall-16-10'),'wall-16-10');
 const g=displayGeometry('hdmi-development',1024,768,'wall-16-10');
 assert.equal(g.width,1280);assert.equal(g.height,800);assert.equal(g.scale,.8);
 assert.equal(g.renderedHeight,640);
});
test('screen preferences survive normalization; malformed input cannot invent a location',()=>{
 assert.deepEqual(settings({screen:{mode:'widgets',latitude:52,longitude:4}}).screen,{mode:'widgets',latitude:52,longitude:4});
 assert.deepEqual(screenSettings({mode:'unknown',latitude:Infinity,longitude:181}),{mode:'clock',latitude:null,longitude:null});
 assert.equal(screenSettings(null).mode,'clock');
});
test('sunset approximation matches equinox reference within 10 minutes; polar/no-location is explicit',()=>{
 const result=sunsetAt(new Date(2026,2,20,12),0,0);
 assert.ok(Math.abs(result.getTime()-Date.UTC(2026,2,20,18,11))<600000);
 assert.equal(sunsetAt(new Date(),null,null),null);
 assert.equal(sunsetAt(new Date(2026,5,21),89,0),null);
 const west=sunsetAt(new Date(2026,2,20,12),0,-170);
 assert.equal(west.getUTCDate(),21); // Sunset occurs on the next UTC day.
});
test('wifi levels require a valid connected measurement and clear on offline',()=>{
 assert.equal(wifiReading({connected:true,signal:73}).level,73);
 assert.equal(wifiReading({connected:true,signal:101}).level,null);
 assert.equal(wifiReading({connected:false,signal:73}).level,null);
 assert.equal(wifiReading({connected:true,signal:73},true).level,null);
});
test('unknown PD never becomes a measured 100W pass; notifications distinguish simulation',()=>{
 const rows=wallNotifications({device:{mode:'ready',faults:[]},mode:'music-assistant'},null);
 assert.equal(rows.length,6);assert.equal(rows[2].attention,true);assert.equal(rows[2].simulated,false);
 assert.match(rows[2].detail,/onbekend/);
 const sim=wallNotifications({mode:'simulation',device:{faults:['thermal-alarm']},boot:{checks:[{id:'power',status:'pass',reason:'100 W simulatie'}]}});
 assert.equal(sim[2].attention,true);assert.equal(sim[2].simulated,true);
});
test('screen sleep/wake preserves playback and standby wake cannot enable amplifier',()=>{
 const r=new DeviceRuntime(0);r.dispatch({type:'boot-complete'},0);r.dispatch({type:'play'},1);
 r.dispatch({type:'display-timeout'},2);assert.equal(r.device.displayAwake,false);assert.equal(r.device.playing,true);
 r.dispatch({type:'activity'},3);assert.equal(r.device.displayAwake,true);assert.equal(r.device.playing,true);
 r.dispatch({type:'standby'},4);r.dispatch({type:'activity'},5);
 assert.equal(r.device.mode,'standby');assert.equal(r.device.displayAwake,true);assert.equal(r.device.amplifierEnabled,false);
});

test('fault inspection can wake display without clearing latched faults or verification',()=>{
 const r=new DeviceRuntime(0);r.dispatch({type:'boot-complete'},0);r.dispatch({type:'thermal-alarm'},1);r.dispatch({type:'display-timeout'},2);r.dispatch({type:'activity'},3);
 assert.equal(r.device.displayAwake,true);assert.equal(r.device.mode,'fault');assert.deepEqual(r.device.faults,['thermal-alarm']);assert.equal(r.device.amplifierEnabled,false);assert.equal(r.device.verified,false);
});
