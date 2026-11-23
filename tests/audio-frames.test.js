import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {AudioFrames} from '../server/audio-frames.js';
class Response extends EventEmitter{
 constructor(blocked=false){super();this.headers={};this.writes=[];this.blocked=blocked;this.destroyed=false;this.writableEnded=false;}
 setHeader(k,v){this.headers[k]=v;}
 flushHeaders(){}
 write(data){this.writes.push(data);return !this.blocked;}
 end(){this.writableEnded=true;this.emit('close');}
}
test('the frame stream is demand-bound, no-store and does not request a capture lease',()=>{
 let calls=0;const feed=new AudioFrames({read:(...args)=>{assert.deepEqual(args,[]);calls++;return {status:'inactive',measurement:null};}}),response=new Response();
 try{assert.equal(feed.timer,null);feed.add({},response);assert.match(response.headers['Content-Type'],/^text\/event-stream/);assert.equal(response.headers['Cache-Control'],'no-store');assert.equal(calls,1);assert.ok(feed.timer);response.end();assert.equal(feed.timer,null);assert.equal(feed.clients.size,0);}finally{feed.close();}
});
test('slow frame consumers receive only the newest waiting measurement',()=>{
 let frame=0;const feed=new AudioFrames({read:()=>({status:'pcm',measurement:{capturedAt:++frame}})}),response=new Response(true);
 try{feed.add({},response);for(let i=0;i<100;i++)feed.send();assert.equal(response.writes.length,1);response.blocked=false;response.emit('drain');assert.equal(response.writes.length,2);assert.match(response.writes[1],/"capturedAt":101/);}finally{feed.close();}
});
test('idle frames heartbeat without duplicating every sample, and connection count is bounded',()=>{
 let now=0;const feed=new AudioFrames({now:()=>now,maxClients:1,read:()=>({status:'idle',measurement:null})}),one=new Response(),two=new Response();
 try{feed.add({},one);feed.add({},two);assert.equal(two.statusCode,429);assert.equal(two.writableEnded,true);now=400;feed.send();assert.equal(one.writes.length,1);now=1100;feed.send();assert.equal(one.writes.length,2);}finally{feed.close();}
});
