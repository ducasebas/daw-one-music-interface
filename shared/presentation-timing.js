/** Extra presentation delay only. It never changes the audio path or invents PCM. */
export const timingDefaults=Object.freeze({screenDelayMs:0,visualizerTrimMs:0});
const bound=(value,min,max,fallback=0)=>Number.isFinite(value)?Math.round(Math.max(min,Math.min(max,value))):fallback;
export function presentationTiming(input={}){
 const v=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
 return {screenDelayMs:bound(v.screenDelayMs,0,2000),visualizerTrimMs:bound(v.visualizerTrimMs,-500,500)};
}
export function visualizerDelay(input){const t=presentationTiming(input);return Math.max(0,t.screenDelayMs+t.visualizerTrimMs);}
/** Small bounded queue of measurements, with monotonic client arrival times. */
export class MeasurementDelay {
 constructor(){this.clear();}
 clear(){this.frames=[];this.lastStamp=null;this.source=null;}
 push(audio,now,context=''){
  const real=['pcm','silence'].includes(audio?.status)&&audio.measurement&&audio.enabled!==false;
  const source=(audio?.playerId||'local')+'|'+context;
  if(!real||!Number.isFinite(now)){this.clear();return false;}
  if(source!==this.source){this.clear();this.source=source;}
  const stamp=audio.measurement.capturedAt??audio.measurement.sourceUpdatedAt??now;
  if(stamp===this.lastStamp)return false;
  if(typeof stamp==='number'&&typeof this.lastStamp==='number'&&stamp<this.lastStamp){this.clear();this.source=source;}
  this.lastStamp=stamp;this.frames.push({at:now,audio});
  while(this.frames.length>128||this.frames.length>1&&this.frames[1].at<now-4000)this.frames.shift();
  return true;
 }
 read(now,delay){
  const target=now-Math.max(0,Math.min(2500,Number(delay)||0));
  for(let i=this.frames.length-1;i>=0;i--)if(this.frames[i].at<=target)return this.frames[i].audio;
  return null;
 }
 nextDue(now,delay){const frame=this.frames.find(f=>f.at+delay>now);return frame?frame.at+delay:null;}
}
/** Stable context across normal clock updates; reset after track/source/seek/pause. */
export function playbackDiscontinuity(previous,next){
 if(!previous)return false;
 if(previous.key!==next.key||previous.playing!==next.playing)return true;
 if(![previous.position,previous.observedAt,next.position,next.observedAt].every(Number.isFinite))return false;
 const expected=previous.position+(previous.playing?(next.observedAt-previous.observedAt)/1000:0);
 return Math.abs(next.position-expected)>.75;
}
