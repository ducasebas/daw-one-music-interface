import {parentPort} from 'node:worker_threads';
import {performance} from 'node:perf_hooks';
import {PcmAnalyser} from '../shared/audio-analysis.js';

const analyser=new PcmAnalyser();
parentPort.on('message',({id,samples,rate})=>{
 try{
  const began=performance.now();
  const measurement=analyser.analyse(Buffer.from(samples.buffer,samples.byteOffset,samples.byteLength),rate);
  parentPort.postMessage({id,measurement,processingMs:Math.round((performance.now()-began)*100)/100});
 }catch{parentPort.postMessage({id,error:true});}
});
