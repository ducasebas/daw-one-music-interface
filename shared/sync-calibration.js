import {presentationTiming} from './presentation-timing.js';

export const syncCaptureDefaults=()=>({inputLatencyMs:0,displayDelayMs:0,displayUncertaintyMs:20});
export function syncCaptureSettings(value={}){
  const d=syncCaptureDefaults();
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!Object.hasOwn(d,k)))throw Error('Invalid synchronization settings');
  const s={...d,...value};
  for(const [key,max] of [['inputLatencyMs',200],['displayDelayMs',1000],['displayUncertaintyMs',200]])if(!Number.isFinite(s[key])||s[key]<0||s[key]>max)throw Error('Synchronization timing is outside its supported range');
  return s;
}
export function pcmEnergy(measurement){
  const values=measurement?.channels?.map(c=>c.rmsDb);
  return values?.length===2&&values.every(Number.isFinite)?10*Math.log10(Math.max(1e-12,values.reduce((s,db)=>s+10**(db/10),0)/2)):null;
}
/** Raw capture is discarded after this rolling energy envelope is calculated. */
export class CaptureEnergy {
  constructor({rate=48000,window=4096,hop=960,inputLatencyMs=0}={}){
    if(!Number.isInteger(rate)||rate<8000||rate>192000||!Number.isInteger(window)||window<256||window>16384||!Number.isInteger(hop)||hop<128||hop>window)throw Error('Invalid capture window');
    Object.assign(this,{rate,window,hop,inputLatencyMs});this.ring=new Float64Array(window);this.sum=0;this.count=0;this.clipped=0;this.maxChunkMs=0;this.points=[];this.previousTime=null;
  }
  push(bytes,at){
    if(!Buffer.isBuffer(bytes)||bytes.length%2||bytes.length>262144||!Number.isFinite(at)||this.previousTime!==null&&at<this.previousTime)throw Error('Invalid microphone capture');
    this.previousTime=at;const frames=bytes.length/2;this.maxChunkMs=Math.max(this.maxChunkMs,1000*frames/this.rate);
    for(let i=0;i<frames;i++){
      const value=bytes.readInt16LE(i*2)/32768,square=value*value,index=this.count%this.window;
      this.sum+=square-this.ring[index];this.ring[index]=square;this.count++;if(Math.abs(value)>=.999)this.clipped++;
      if(this.count>=this.window&&this.count%this.hop===0){
        // Centre the microphone window. Reference times are the actual server
        // analysis delivery times, so correlation includes analysis delay.
        const t=at-1000*(frames-i-1)/this.rate-500*this.window/this.rate-this.inputLatencyMs;
        if(!this.points.length||t>this.points.at(-1).t)this.points.push({t,db:Math.max(-100,10*Math.log10(Math.max(1e-10,this.sum/this.window)))});
        if(this.points.length>2048)this.points.shift();
      }
    }
  }
  result(){return {points:this.points,clipPercent:this.count?100*this.clipped/this.count:0,maxChunkMs:this.maxChunkMs,frames:this.count};}
}
const percentile=(sorted,p)=>sorted[Math.min(sorted.length-1,Math.max(0,Math.floor(p*(sorted.length-1))))];
function series(points){
  if(!Array.isArray(points)||points.length<40||points.length>2048||points.some((p,i)=>!Number.isFinite(p?.t)||!Number.isFinite(p.db)||p.db< -130||p.db>10||i&&p.t<=points[i-1].t))throw Error('Not enough valid timing observations');
  const values=points.map(p=>p.db).sort((a,b)=>a-b),spacing=points.slice(1).map((p,i)=>p.t-points[i].t).sort((a,b)=>a-b);
  if(points.at(-1).t-points[0].t<4000||percentile(spacing,.95)>180||percentile(values,.95)-percentile(values,.05)<5)throw Error('Play music with clear, changing dynamics and repeat the measurement');
  return points;
}
function at(points,time){
  let lo=0,hi=points.length-1;if(time<points[lo].t||time>points[hi].t)return null;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(points[mid].t<=time)lo=mid;else hi=mid;}
  const a=points[lo],b=points[hi];if(b.t-a.t>180)return null;
  return a.db+(b.db-a.db)*(time-a.t)/(b.t-a.t);
}
function pearson(pairs){let n=0,x=0,y=0,xx=0,yy=0,xy=0;for(const [a,b] of pairs){n++;x+=a;y+=b;xx+=a*a;yy+=b*b;xy+=a*b;}if(n<80)return -1;const vx=xx-x*x/n,vy=yy-y*y/n;return vx>1e-6&&vy>1e-6?(xy-x*y/n)/Math.sqrt(vx*vy):-1;}
function correlation(ref,mic,lag,start,end){
  const pairs=[];for(let t=start;t<=end;t+=10){const a=at(ref,t),b=at(mic,t+lag);if(a!==null&&b!==null)pairs.push([a,b]);}
  const r=pearson(pairs);return r;
}
/** Onsets: how fast the energy rises (beats, transients). Sharper than the level itself, so it pins the lag down more precisely. */
function onsetCorrelation(ref,mic,lag,start,end,step=30){
  const pairs=[];for(let t=start;t<=end;t+=10){const a=at(ref,t),a0=at(ref,t-step),b=at(mic,t+lag),b0=at(mic,t+lag-step);if(a!==null&&a0!==null&&b!==null&&b0!==null)pairs.push([Math.max(0,a-a0),Math.max(0,b-b0)]);}
  return pearson(pairs);
}
export function estimateSync(reference,capture,{windowMs=85.333,...input}={}){
  const settings=syncCaptureSettings(input),ref=series(reference),mic=series(capture.points);
  if(!Number.isFinite(capture.clipPercent)||capture.clipPercent>=.1||!Number.isFinite(capture.maxChunkMs)||capture.maxChunkMs>150)throw Error('Microphone clipping or capture buffering is too high; repeat with a stable USB input');
  if(!Number.isFinite(windowMs)||windowMs<1||windowMs>1000)throw Error('Unknown PCM analysis window');
  // Skip the first second of the recording: a USB microphone's start-up burst and settling distort the envelope.
  const start=Math.max(ref[0].t,mic[0].t+1000),end=Math.min(ref.at(-1).t,mic.at(-1).t-2000);
  if(end-start<4000)throw Error('The capture is too short to align reliably');
  const ranked=[];for(let lag=-500;lag<=2000;lag+=5)ranked.push({lag,score:correlation(ref,mic,lag,start,end)});
  ranked.sort((a,b)=>b.score-a.score);const best=ranked[0],other=ranked.find(p=>Math.abs(p.lag-best.lag)>=150);
  if(best.score<.6||other&&best.score-other.score<.035)throw Error('The timing match is ambiguous. Use a track with distinct, irregular transients');
  const middle=(start+end)/2;
  const halves=[[start,middle],[middle,end]].map(([a,b])=>ranked.filter(p=>Math.abs(p.lag-best.lag)<=100).map(p=>({lag:p.lag,score:correlation(ref,mic,p.lag,a,b)})).sort((a,b)=>b.score-a.score)[0]);
  if(halves.some(h=>h.score<.5)||Math.abs(halves[0].lag-halves[1].lag)>40)throw Error('Timing drifted during capture. Keep the same output and track, then repeat');
  // Refine around the energy match with onsets in 2 ms steps; the peak width becomes the audio part of the margin.
  const fine=[];for(let lag=best.lag-60;lag<=best.lag+60;lag+=2)fine.push({lag,score:onsetCorrelation(ref,mic,lag,start,end)});
  const top=fine.reduce((a,b)=>b.score>a.score?b:a,fine[0]),onsetsUsable=top.score>=.5;
  const lag=onsetsUsable?top.lag:best.lag,near=onsetsUsable?fine.filter(p=>p.score>=top.score-.02).map(p=>p.lag):[best.lag-10,best.lag+10];
  const peakHalfWidthMs=Math.max(2,(Math.max(...near)-Math.min(...near))/2);
  const uncertaintyMs=Math.ceil(5+peakHalfWidthMs+capture.maxChunkMs/2+settings.displayUncertaintyMs+Math.abs(halves[0].lag-halves[1].lag)/2);
  const effective=Math.round((lag-settings.displayDelayMs)/10)*10;
  if(effective< -uncertaintyMs)throw Error('The visualizer is already behind the sound. Adding screen delay cannot correct this path');
  const delay=Math.max(0,effective),screen=Math.round(Math.max(0,Math.min(2000,lag+windowMs/2))/10)*10;
  const timing=presentationTiming({screenDelayMs:screen,visualizerTrimMs:delay-screen});
  if(Math.abs(Math.max(0,timing.screenDelayMs+timing.visualizerTrimMs)-delay)>10||uncertaintyMs>120)throw Error('The measured delay is outside the reliable adjustment range');
  return {valid:true,method:onsetsUsable?'pcm-microphone-onsets':'pcm-microphone-energy',relativeLagMs:lag,peakWidthMs:Math.round(peakHalfWidthMs*2),onsetCorrelation:Math.round(top.score*1000)/1000,delayMs:delay,timing,correlation:Math.round(best.score*1000)/1000,uncertaintyMs,inputLatencyMs:settings.inputLatencyMs,inputLatencyCalibrated:settings.inputLatencyMs>0,referenceWindowMs:Math.round(windowMs*10)/10,displayDelayMs:settings.displayDelayMs,rawAudioRetained:false};
}
/** Screen-path delay from repeated samples: median, and half the interquartile range plus half a frame as margin, so one slow frame cannot inflate it. */
export function displayTimingFromAges(values){
 const ages=[...values].sort((a,b)=>a-b),q=p=>ages[Math.min(ages.length-1,Math.max(0,Math.round(p*(ages.length-1))))];
 return {displayDelayMs:Math.round(q(.5)),displayUncertaintyMs:Math.min(200,Math.max(10,Math.ceil((q(.75)-q(.25))/2+8)))};
}
