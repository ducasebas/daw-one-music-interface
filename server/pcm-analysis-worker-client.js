import {Worker} from 'node:worker_threads';

/** One analysis in progress and one newest waiting frame; never accumulate audio latency. */
export class LatestPcmAnalysis{
 constructor({onResult,onError,WorkerClass=Worker}){
  Object.assign(this,{onResult,onError,WorkerClass});this.worker=null;this.pending=null;this.inFlight=null;this.nextId=0;this.closed=false;
 }
 submit(samples,rate,context){
  if(this.closed)return;
  this.pending={samples,rate,context};
  if(!this.worker){
   let worker;try{worker=new this.WorkerClass(new URL('./pcm-analysis-worker.js',import.meta.url),{resourceLimits:{maxOldGenerationSizeMb:32,stackSizeMb:2}});}catch{this.close();this.onError?.();return;}this.worker=worker;
   worker.on('message',message=>{
    if(this.worker!==worker||this.closed||message.id!==this.inFlight?.id)return;
    const frame=this.inFlight;this.inFlight=null;
    if(message.error){this.fail(worker);return;}
    this.onResult(message.measurement,{...frame.context,processingMs:message.processingMs});this.flush();
   });
   worker.on('error',()=>this.fail(worker));
   worker.on('exit',()=>this.fail(worker));
  }
  this.flush();
 }
 flush(){
  if(this.closed||!this.worker||this.inFlight||!this.pending)return;
  const frame=this.pending;this.pending=null;
  try{const samples=Uint8Array.from(frame.samples);this.inFlight={id:++this.nextId,context:frame.context};this.worker.postMessage({id:this.inFlight.id,samples,rate:frame.rate},[samples.buffer]);}
  catch{this.fail(this.worker);}
 }
 fail(worker){if(this.worker!==worker||this.closed)return;this.close();this.onError?.();}
 close(){
  this.closed=true;this.pending=null;this.inFlight=null;
  const worker=this.worker;this.worker=null;
  if(worker){worker.removeAllListeners();worker.on('error',()=>{});Promise.resolve(worker.terminate()).catch(()=>{});}
 }
}
