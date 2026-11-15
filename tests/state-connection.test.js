import {test} from 'node:test';
import assert from 'node:assert/strict';
import {connectState} from '../src/state-connection.js';

function fixture(){
 const requests=[],values=[],offline=[],intervals=new Set(),timeouts=new Set();
 let now=1000,stream;
 const window=new EventTarget(),document=new EventTarget();document.hidden=false;
 const environment={window,document,navigator:{onLine:true},Date:{now:()=>now},AbortController,
  EventSource:class{constructor(){stream=this;}close(){this.closed=true;}},
  fetch:(_path,options)=>new Promise((resolve,reject)=>requests.push({options,resolve:value=>resolve({ok:true,json:async()=>value}),reject})),
  setInterval:fn=>{intervals.add(fn);return fn;},clearInterval:fn=>intervals.delete(fn),
  setTimeout:fn=>{timeouts.add(fn);return fn;},clearTimeout:fn=>timeouts.delete(fn)};
 const stop=connectState({onSnapshot:value=>values.push(value),onOffline:value=>offline.push(value)},environment);
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 return {requests,values,offline,environment,stop,flush,get stream(){return stream;},message:value=>stream.onmessage({data:JSON.stringify(value)}),tick:()=>{for(const fn of intervals)fn();},advance:ms=>now+=ms,intervals,timeouts};
}

test('healthy live snapshots suppress redundant HTTP polling without losing live changes',async()=>{
 const f=fixture();try{
  f.requests[0].resolve({value:1});await f.flush();f.message({value:2});
  for(let i=0;i<10;i++){f.advance(1000);f.tick();}
  assert.equal(f.requests.length,1);f.message({value:3});assert.deepEqual(f.values,[{value:1},{value:2},{value:3}]);
 }finally{f.stop();}
});
test('a slow HTTP response cannot overwrite a newer live snapshot or mark it offline',async()=>{
 const f=fixture();try{
  f.message({value:'new'});f.requests[0].resolve({value:'old'});await f.flush();
  assert.deepEqual(f.values,[{value:'new'}]);assert.equal(f.offline.at(-1),false);
  f.stream.onerror();f.stream.onerror();f.tick();assert.equal(f.requests.length,2);
  f.message({value:'newer'});f.requests[1].reject(Error('old connection failed'));await f.flush();
  assert.equal(f.offline.at(-1),false);assert.equal(f.values.at(-1).value,'newer');
 }finally{f.stop();}
});
test('broken or silently stalled streams recover through bounded HTTP fallback',async()=>{
 const f=fixture();try{
  f.requests[0].resolve({value:1});await f.flush();f.message({value:2});
  f.advance(21000);f.tick();assert.equal(f.requests.length,2);
  f.requests[1].resolve({value:3});await f.flush();assert.equal(f.values.at(-1).value,3);
  f.stream.onerror();assert.equal(f.requests.length,3);f.requests[2].resolve({value:4});await f.flush();
  f.message({value:5});f.tick();assert.equal(f.requests.length,3);
 }finally{f.stop();}
});
test('changing the system clock cannot postpone the stream watchdog',async()=>{
 const f=fixture();try{
  f.environment.performance={now:f.environment.Date.now};
  f.requests[0].resolve({value:1});await f.flush();f.message({value:2});
  f.environment.Date.now=()=>-3600000;f.advance(21000);f.tick();assert.equal(f.requests.length,2);
  f.requests[1].resolve({value:3});await f.flush();assert.equal(f.values.at(-1).value,3);
 }finally{f.stop();}
});
test('offline/unmount abort requests and dispose subscriptions without stale state updates',async()=>{
 const f=fixture();f.environment.navigator.onLine=false;f.environment.window.dispatchEvent(new Event('offline'));
 assert.equal(f.requests[0].options.signal.aborted,true);assert.equal(f.offline.at(-1),true);
 f.requests[0].resolve({value:'stale'});await f.flush();assert.deepEqual(f.values,[]);
 f.environment.navigator.onLine=true;f.environment.window.dispatchEvent(new Event('online'));assert.equal(f.requests.length,2);
 f.stop();f.requests[1].resolve({value:'unmounted'});await f.flush();f.message({value:'late'});
 assert.deepEqual(f.values,[]);assert.equal(f.stream.closed,true);assert.equal(f.intervals.size,0);assert.equal(f.timeouts.size,0);
});
