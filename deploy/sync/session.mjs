import {CaptureEnergy,estimateSync,pcmEnergy,syncCaptureSettings} from '../../shared/sync-calibration.js';

/** Audio I/O is injected so cancellation, path changes and capture failures are testable. */
export async function measureSynchronization({job,getContext,getAudio,openCapture,report=()=>{},clock=()=>Number(process.hrtime.bigint())/1e6,sleep=ms=>new Promise(r=>setTimeout(r,ms)),cancelled=()=>false}){
 const settings=syncCaptureSettings(job.settings),initial=await getContext();
 if(cancelled())throw Error('Cancelled');
 if(!initial.ready||!initial.playing||!initial.pcmReady||initial.key!==job.context.key||initial.trackKey!==job.context.trackKey)throw Error('The audio path changed before capture');
 const energy=new CaptureEnergy({inputLatencyMs:settings.inputLatencyMs,window:Math.round(48*initial.windowMs)}),reference=[];
 let carry=Buffer.alloc(0),parseFailed=false,lastStatus=0,lastContext=0,previousPosition=initial.position,previousTime=initial.observedAt;
 const input=openCapture(job.microphone);
 input.onData(chunk=>{try{const bytes=carry.length?Buffer.concat([carry,chunk]):chunk,end=bytes.length-bytes.length%2;carry=bytes.subarray(end);if(end)energy.push(bytes.subarray(0,end),clock());}catch{parseFailed=true;input.stop();}});
 const started=clock();
 try{
  while(!input.ended&&clock()-started<14000){
   if(cancelled())throw Error('Cancelled');const now=clock();
   if(parseFailed||input.failed)throw Error('Microphone capture failed');
   const audio=await getAudio(),m=audio.measurement,db=pcmEnergy(m);
   if(!audio.enabled||!audio.configured||!audio.matchesSelected||!['pcm','silence'].includes(audio.status)||!Number.isFinite(m?.capturedMonotonicMs)||!Number.isFinite(db)||now-m.capturedMonotonicMs>700||m.capturedMonotonicMs-now>100)throw Error('The PCM reference is unavailable or stale');
   if(!reference.length||m.capturedMonotonicMs>reference.at(-1).t)reference.push({t:m.capturedMonotonicMs,db});
   if(reference.length>1024)throw Error('PCM observation budget exceeded');
   if(now-lastContext>500){
    const current=await getContext();
    if(!current.ready||!current.playing||current.key!==initial.key||current.trackKey!==initial.trackKey||current.volume!==initial.volume||current.muted||Number.isFinite(current.position)&&Number.isFinite(previousPosition)&&Math.abs(current.position-previousPosition-(current.observedAt-previousTime)/1000)>1)throw Error('Keep the same track, volume and output during synchronization');
    previousPosition=current.position;previousTime=current.observedAt;lastContext=now;
   }
   if(now-lastStatus>400){report({phase:'measuring',id:job.id,percent:Math.min(95,Math.round(100*(now-started)/12000))});lastStatus=now;}
   await sleep(45);
  }
  if(cancelled())throw Error('Cancelled');if(parseFailed||input.failed||!input.ended||carry.length||energy.count<480000)throw Error('Microphone recording was incomplete');
  report({phase:'analysing',id:job.id,percent:96});
  const current=await getContext();if(!current.ready||current.key!==initial.key||current.trackKey!==initial.trackKey)throw Error('The audio path changed before analysis');
  return {...estimateSync(reference,energy.result(),{...settings,windowMs:initial.windowMs}),id:job.id,contextKey:initial.key,sampleRate:initial.sampleRate,measuredAt:new Date().toISOString()};
 }finally{input.stop();}
}
