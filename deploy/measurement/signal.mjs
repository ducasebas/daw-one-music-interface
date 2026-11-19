/** Original, bounded log sweep and relative response analysis. No simulated audio. */
export const rate=48000,sweepSeconds=3,leadSeconds=.5,tailSeconds=1;
/** Allowed sweep levels. Louder levels are offered one 6 dB step at a time with consent. */
export const sweepLevels=Object.freeze([-36,-30,-24]);export const minimumSnrDb=15;
export function sweep(levelDbfs=-36){if(!sweepLevels.includes(levelDbfs))throw Error('Unsupported sweep level');const signal=new Float32Array(rate*(leadSeconds+sweepSeconds+tailSeconds)),f0=30,f1=18000,k=Math.log(f1/f0)/sweepSeconds,amplitude=10**(levelDbfs/20);for(let n=0;n<rate*sweepSeconds;n++){const t=n/rate,fade=Math.min(1,t/.04,(sweepSeconds-t)/.04);signal[Math.floor(rate*leadSeconds)+n]=amplitude*fade*Math.sin(2*Math.PI*f0/k*(Math.exp(k*t)-1));}return signal;}
export function wav(signal,channel=0){const b=Buffer.alloc(44+signal.length*4);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(2,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*4,28);b.writeUInt16LE(4,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(signal.length*4,40);for(let i=0;i<signal.length;i++)b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,signal[i]))*32767),44+i*4+channel*2);return b;}
function fft(re,im){const n=re.length;for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}for(let len=2;len<=n;len*=2){const a=-2*Math.PI/len,wr=Math.cos(a),wi=Math.sin(a);for(let i=0;i<n;i+=len){let ur=1,ui=0;for(let j=0;j<len/2;j++){const p=i+j,q=p+len/2,tr=re[q]*ur-im[q]*ui,ti=re[q]*ui+im[q]*ur;re[q]=re[p]-tr;im[q]=im[p]-ti;re[p]+=tr;im[p]+=ti;const v=ur*wr-ui*wi;ui=ur*wi+ui*wr;ur=v;}}}}
const median=a=>{const v=[...a].sort((a,b)=>a-b);return v[Math.floor(v.length/2)]||0;};
export function analyse(signal,recording,calibration=[]){
 if(!(recording instanceof Float32Array)||recording.length<rate*4||recording.length>rate*8)throw Error('Recording length is invalid');
 let n=1;while(n<signal.length+recording.length)n*=2;
 const xr=new Float32Array(n),xi=new Float32Array(n),yr=new Float32Array(n),yi=new Float32Array(n);
 xr.set(signal);yr.set(recording);fft(xr,xi);fft(yr,yi);
 let noise=0,energy=0,clips=0,referenceEnergy=0;
 for(const v of signal)referenceEnergy+=v*v;
 for(let i=0;i<recording.length;i++){const v=recording[i];if(!Number.isFinite(v))throw Error('Invalid microphone samples');energy+=v*v;if(i<rate*.1)noise+=v*v;if(Math.abs(v)>.995)clips++;}
 const legacySnrDb=10*Math.log10(Math.max(1e-15,energy/recording.length)/Math.max(1e-15,noise/(rate*.1))),clipPercent=clips/recording.length*100;
 const correction=f=>{if(!calibration.length)return 0;if(f<=calibration[0][0])return calibration[0][1];for(let i=1;i<calibration.length;i++)if(f<=calibration[i][0]){const [a,x]=calibration[i-1],[b,y]=calibration[i];return x+(y-x)*Math.log(f/a)/Math.log(b/a);}return calibration.at(-1)[1];};
 const points=[];
 for(let f=31.5;f<=16000;f*=2**(1/6)){
  const lo=Math.max(1,Math.floor(f/2**(1/12)*n/rate)),hi=Math.min(n/2,Math.ceil(f*2**(1/12)*n/rate));let a=0,b=0;
  for(let k=lo;k<=hi;k++){a+=xr[k]**2+xi[k]**2;b+=yr[k]**2+yi[k]**2;}
  points.push({hz:Math.round(f*10)/10,db:10*Math.log10(Math.max(1e-20,b)/Math.max(1e-20,a))-correction(f)});
 }
 const reference=median(points.filter(p=>p.hz>=500&&p.hz<=2000).map(p=>p.db));for(const p of points)p.db=Math.round((p.db-reference)*10)/10;
 // IFFT(Y * conj(X)): distinguish the actual sweep from unrelated sound with a high SNR.
 for(let k=0;k<n;k++){const real=yr[k]*xr[k]+yi[k]*xi[k],imag=yi[k]*xr[k]-yr[k]*xi[k];yr[k]=real;yi[k]=-imag;}
 fft(yr,yi);let peak=0,lag=0;const search=new Float32Array(Math.floor(rate*.3)+rate+1);
 for(let k=-Math.floor(rate*.3),j=0;k<=rate;k++,j++){const value=Math.abs(yr[(k+n)%n]/n);search[j]=value;if(value>peak){peak=value;lag=k;}}
 // A real sweep compresses into one sharp impulse-response peak; unrelated sound does not.
 // Prominence is robust to room reverberation and speaker/microphone coloration.
 const floor=Float32Array.from(search).sort()[search.length>>1]||1e-30,prominence=peak/Math.max(1e-30,floor);
 const correlation=peak/Math.sqrt(Math.max(1e-30,energy*referenceEnergy)),complete=leadSeconds*rate+lag>=0&&(leadSeconds+sweepSeconds)*rate+lag<recording.length-rate*.1;
 const segments=[];
 for(let part=0;part<3;part++){
  let sum=0,a=0,b=0;const start=Math.floor((leadSeconds+part*sweepSeconds/3+.04)*rate),end=Math.floor((leadSeconds+(part+1)*sweepSeconds/3-.04)*rate);
  for(let i=start;i<end;i++){const x=signal[i],y=recording[i+lag]||0;sum+=x*y;a+=x*x;b+=y*y;}
  segments.push(Math.abs(sum)/Math.sqrt(Math.max(1e-30,a*b)));
 }
 const power0=(a,b)=>{a=Math.max(0,Math.floor(a));b=Math.min(recording.length,Math.floor(b));if(b<=a)return 0;let e=0;for(let i=a;i<b;i++)e+=recording[i]*recording[i];return e/(b-a);};
 const leadQuiet=power0(rate*.15,leadSeconds*rate+lag-rate*.03);
 // The middle and last thirds must be clearly louder than the quiet lead-in: catches truncated captures.
 const thirds=[0,1,2].map(part=>power0((leadSeconds+part*sweepSeconds/3+.04)*rate+lag,(leadSeconds+(part+1)*sweepSeconds/3-.04)*rate+lag));
 // The bass third is left out: small speakers and room rumble legitimately mask it.
 const sweepDetected=complete&&prominence>=12&&thirds.slice(1).every(p=>p>Math.max(2*leadQuiet,1e-12));
 // Signal power only while the sweep plays; noise from the quiet lead-in after the
 // microphone settles (its first 150 ms can hold a start-up click) and from the late tail.
 const power=(a,b)=>{a=Math.max(0,Math.floor(a));b=Math.min(recording.length,Math.floor(b));if(b-a<rate*.08)return null;let e=0;for(let i=a;i<b;i++)e+=recording[i]*recording[i];return e/(b-a);};
 const sweepStart=leadSeconds*rate+lag,sweepEnd=(leadSeconds+sweepSeconds)*rate+lag;
 const quiet=[power(rate*.15,sweepStart-rate*.03),power(sweepEnd+rate*.4,recording.length)].filter(v=>v!==null);
 const signalPower=sweepDetected?power(sweepStart,sweepEnd):null;
 const snrDb=signalPower!==null&&quiet.length?10*Math.log10(Math.max(1e-15,signalPower)/Math.max(1e-15,Math.min(...quiet))):legacySnrDb;
 const neededDb=snrDb<minimumSnrDb?Math.ceil(minimumSnrDb-snrDb):0;
 return {valid:snrDb>=minimumSnrDb&&clipPercent<.1&&sweepDetected,snrDb:Math.round(snrDb*10)/10,neededDb,clipPercent:Math.round(clipPercent*100)/100,sweepDetected,correlation:Math.round(correlation*1000)/1000,prominence:Math.round(prominence*10)/10,captureDelayMs:Math.round(lag/rate*10000)/10,points,calibrated:calibration.length>0,absoluteSpl:false,reference:'Relative to median 500–2000 Hz; 1/6-octave bands',warnings:[...(snrDb<minimumSnrDb?['Measurement signal is too close to the noise floor.']:[]),...(clipPercent>=.1?['Microphone clipping detected; lower the level and measure again.']:[]),...(!sweepDetected?['A complete reference sweep was not detected. Check the microphone, output and room noise, then repeat.']:[]),...(!calibration.length?['No microphone calibration: response includes microphone coloration.']:[])]};
}
export function cutProposal(channels){if(!channels.length||channels.some(c=>!c.valid))return [];return channels[0].points.filter(p=>p.hz<=8000).map((p,i)=>({hz:p.hz,db:-Math.min(6,Math.max(0,Math.round(channels.reduce((n,c)=>n+c.points[i].db,0)/channels.length)))}));}
