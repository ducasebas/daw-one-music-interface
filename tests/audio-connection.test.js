import test from 'node:test';
import assert from 'node:assert/strict';
import {connectAudio} from '../src/audio-connection.js';
const state=patch=>({enabled:true,configured:true,matchesSelected:true,status:'pcm',measurement:{capturedAt:1},streamUrl:'/api/audio/events',...patch});
function fixture(options={}){
 let clock=1000;const requests=[],values=[],streams=[],timeouts=new Map(),intervals=new Map(),document=new EventTarget();document.hidden=false;
 const environment={document,Date,performance:{now:()=>clock},AbortController,
  EventSource:class{constructor(url){this.url=url;streams.push(this);}close(){this.closed=true;}},
  fetch:(path,options)=>new Promise((resolve,reject)=>requests.push({path,options,resolve:value=>resolve({ok:true,json:async()=>value}),reject})),
  setTimeout:(fn,ms)=>{const token={};timeouts.set(token,{fn,ms});return token;},clearTimeout:token=>timeouts.delete(token),
  setInterval:(fn,ms)=>{const token={};intervals.set(token,{fn,ms});return token;},clearInterval:token=>intervals.delete(token)};
 const connection=connectAudio({...options,onAudio:v=>values.push(v)},environment),flush=()=>new Promise(resolve=>setImmediate(resolve));
 return {connection,requests,values,streams,timeouts,intervals,document,flush,environment,advance:ms=>clock+=ms,runTimeout:ms=>{const match=[...timeouts].find(([,v])=>v.ms===ms);assert.ok(match,'Expected timeout '+ms);timeouts.delete(match[0]);match[1].fn();},message:value=>streams.at(-1).onmessage({data:JSON.stringify(value)})};
}
test('a negotiated live feed replaces rapid HTTP polling and heartbeats cannot overwrite a newer frame',async()=>{
 const f=fixture();try{
  f.requests[0].resolve(state());await f.flush();assert.equal(f.streams.length,1);assert.equal(f.streams[0].url,'/api/audio/events');f.message(state({measurement:{capturedAt:2}}));
  assert.equal([...f.timeouts.values()].some(v=>v.ms===100),false);f.runTimeout(1500);assert.equal(f.requests.length,2);f.requests[1].resolve(state({measurement:{capturedAt:0}}));await f.flush();assert.equal(f.values.at(-1).measurement.capturedAt,2);f.message(state({measurement:{capturedAt:3}}));assert.equal(f.values.at(-1).measurement.capturedAt,3);
 }finally{f.connection.stop();}assert.equal(f.timeouts.size,0);assert.equal(f.intervals.size,0);
});
test('broken SSE closes before bounded HTTP fallback, and a late old frame is ignored',async()=>{
 const f=fixture();try{
  f.requests[0].resolve(state());await f.flush();const old=f.streams[0];old.onerror();assert.equal(old.closed,true);f.runTimeout(0);assert.equal(f.requests.length,2);old.onmessage({data:JSON.stringify(state({measurement:{capturedAt:99}}))});f.requests[1].resolve(state({measurement:{capturedAt:4}}));await f.flush();assert.equal(f.values.at(-1).measurement.capturedAt,4);assert.equal(f.streams.length,1);assert.ok([...f.timeouts.values()].some(v=>v.ms===100));
 }finally{f.connection.stop();}
});
test('paused local meters stop capture renewal while a selected remote room cannot pause local PCM',async()=>{
 const local=fixture({paused:true}),remote=fixture({paused:true});try{
  local.requests[0].resolve(state());remote.requests[0].resolve(state({matchesSelected:false}));await local.flush();await remote.flush();assert.equal(local.streams.length,0);assert.equal(remote.streams.length,1);local.runTimeout(2000);assert.equal(local.requests[1].path,'/api/audio');remote.runTimeout(1500);assert.equal(remote.requests[1].path,'/api/audio?watch=1');
 }finally{local.connection.stop();remote.connection.stop();}
});
test('hidden and unmounted views close the feed, abort renewal and cannot resurrect stale data',async()=>{
 const f=fixture();f.requests[0].resolve(state());await f.flush();const old=f.streams[0];f.runTimeout(1500);f.document.hidden=true;f.document.dispatchEvent(new Event('visibilitychange'));assert.equal(old.closed,true);assert.equal(f.requests[1].options.signal.aborted,true);assert.equal(f.values.at(-1).status,'hidden');assert.equal(f.timeouts.size,0);assert.equal(f.intervals.size,0);f.requests[1].resolve(state());await f.flush();assert.equal(f.values.at(-1).status,'hidden');f.connection.stop();
});
test('a silently stalled feed falls back using the monotonic clock',async()=>{
 const f=fixture();try{f.requests[0].resolve(state());await f.flush();f.message(state());f.environment.Date={now:()=>-3600000};f.advance(4000);for(const timer of [...f.intervals.values()])timer.fn();assert.equal(f.streams[0].closed,true);f.runTimeout(0);assert.equal(f.requests.length,2);}finally{f.connection.stop();}
});
test('a lost connection clears the measurement without pretending the stored analysis switch was turned off',async()=>{
 const f=fixture();try{f.requests[0].resolve(state({streamUrl:undefined}));await f.flush();f.runTimeout(100);f.requests[1].reject(Error('Disconnected'));await f.flush();assert.equal(f.values.at(-1).enabled,true);assert.equal(f.values.at(-1).configured,true);assert.equal(f.values.at(-1).status,'offline');assert.equal(f.values.at(-1).measurement,null);}finally{f.connection.stop();}
});
