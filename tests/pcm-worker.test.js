import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {LatestPcmAnalysis} from '../server/pcm-analysis-worker-client.js';
import {PcmAnalyser,FFT_SIZE} from '../shared/audio-analysis.js';

class HeldWorker extends EventEmitter{
 constructor(){super();this.sent=[];this.terminated=false;}
 postMessage(value){this.sent.push(value);}
 terminate(){this.terminated=true;return Promise.resolve(0);}
}
test('native FFT worker is lazy, preserves the input PCM and returns the same stereo measurements',async()=>{
 const samples=Buffer.alloc(FFT_SIZE*4);for(let i=0;i<FFT_SIZE;i++){const v=Math.round(14000*Math.sin(2*Math.PI*997*i/44100));samples.writeInt16LE(v,i*4);samples.writeInt16LE(-v,i*4+2);}
 const original=Buffer.from(samples),expected=new PcmAnalyser().analyse(samples,44100);
 let engine;
 try{
  const result=await new Promise((resolve,reject)=>{engine=new LatestPcmAnalysis({onResult:(measurement,context)=>resolve({measurement,context}),onError:()=>reject(Error('Worker failed'))});assert.equal(engine.worker,null);engine.submit(samples,44100,{epoch:7,capturedAt:123});assert.ok(engine.worker.threadId>0);});
  assert.deepEqual(result.measurement,expected);assert.deepEqual(samples,original);assert.equal(result.context.epoch,7);assert.equal(result.context.capturedAt,123);assert.ok(result.context.processingMs>=0);
 }finally{engine?.close();}
});
test('a busy worker keeps only the newest waiting frame instead of building an audio backlog',()=>{
 const seen=[];const engine=new LatestPcmAnalysis({WorkerClass:HeldWorker,onResult:(data,context)=>seen.push(context.frame)});
 try{
  engine.submit(Buffer.from([1]),44100,{frame:'first'});const worker=engine.worker;
  engine.submit(Buffer.from([2]),44100,{frame:'obsolete'});engine.submit(Buffer.from([3]),44100,{frame:'latest'});assert.equal(worker.sent.length,1);
  worker.emit('message',{id:worker.sent[0].id,measurement:{},processingMs:1});assert.equal(worker.sent.length,2);assert.deepEqual([...worker.sent[1].samples],[3]);
  worker.emit('message',{id:worker.sent[1].id,measurement:{},processingMs:1});assert.deepEqual(seen,['first','latest']);
 }finally{engine.close();}
});
test('closing or failing analysis discards pending frames and prevents late results',()=>{
 let results=0,failures=0;const engine=new LatestPcmAnalysis({WorkerClass:HeldWorker,onResult:()=>results++,onError:()=>failures++});engine.submit(Buffer.from([1]),44100,{});const worker=engine.worker;engine.submit(Buffer.from([2]),44100,{});worker.emit('error',Error('Stopped'));
 assert.equal(failures,1);assert.equal(worker.terminated,true);assert.equal(engine.pending,null);worker.emit('message',{id:1,measurement:{}});engine.submit(Buffer.from([3]),44100,{});assert.equal(results,0);assert.equal(worker.sent.length,1);
});
test('a worker startup failure is reported without throwing into the HTTP server',()=>{
 let errors=0;const engine=new LatestPcmAnalysis({WorkerClass:class{constructor(){throw Error('Unavailable');}},onResult:()=>assert.fail('No result'),onError:()=>errors++});assert.doesNotThrow(()=>engine.submit(Buffer.alloc(4),44100,{}));assert.equal(errors,1);engine.close();
});
