export const FFT_SIZE=4096,DB_FLOOR=-96,BAND_COUNT=32;
export const bandEdges=Object.freeze(Array.from({length:BAND_COUNT+1},(_,i)=>20*Math.pow(1000,i/BAND_COUNT)));
export const amplitudeDb=value=>value>0?Math.max(DB_FLOOR,Math.min(0,20*Math.log10(value))):DB_FLOOR;
/** Stereo power spectrum, not L+R folding: out-of-phase music must remain visible. */
export class PcmAnalyser{
 constructor(){
  this.window=Float64Array.from({length:FFT_SIZE},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/(FFT_SIZE-1)));
  this.windowPower=this.window.reduce((sum,x)=>sum+x*x,0)/FFT_SIZE;
  this.re=new Float64Array(FFT_SIZE);this.im=new Float64Array(FFT_SIZE);
 }
 spectrum(samples,channel,rate){
  const re=this.re,im=this.im;im.fill(0);
  for(let i=0;i<FFT_SIZE;i++)re[i]=samples.readInt16LE(i*4+channel*2)/32768*this.window[i];
  for(let i=1,j=0;i<FFT_SIZE;i++){let bit=FFT_SIZE>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){const value=re[i];re[i]=re[j];re[j]=value;}}
  for(let length=2;length<=FFT_SIZE;length<<=1){const angle=-2*Math.PI/length,wr=Math.cos(angle),wi=Math.sin(angle);for(let start=0;start<FFT_SIZE;start+=length){let ur=1,ui=0;for(let j=0;j<length/2;j++){const a=start+j,b=a+length/2,tr=ur*re[b]-ui*im[b],ti=ur*im[b]+ui*re[b];re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;const next=ur*wr-ui*wi;ui=ur*wi+ui*wr;ur=next;}}}
  const powers=[];
  for(let band=0;band<BAND_COUNT;band++){const from=Math.max(1,Math.ceil(bandEdges[band]*FFT_SIZE/rate)),to=Math.min(FFT_SIZE/2,Math.ceil(bandEdges[band+1]*FFT_SIZE/rate)-1);if(from>to){powers.push(null);continue;}let energy=0;for(let k=from;k<=to;k++)energy+=(re[k]*re[k]+im[k]*im[k])*(k===FFT_SIZE/2?1:2);powers.push(energy/(FFT_SIZE*FFT_SIZE*this.windowPower));}
  return powers;
 }
 analyse(samples,rate){
  if(!Buffer.isBuffer(samples)||samples.length!==FFT_SIZE*4||!Number.isInteger(rate)||rate<8000||rate>1536000)throw Error('Unsupported stereo PCM frame');
  const channels=[];
  for(let channel=0;channel<2;channel++){let squares=0,peak=0,clipped=0;for(let i=0;i<FFT_SIZE;i++){const raw=samples.readInt16LE(i*4+channel*2),value=raw/32768;squares+=value*value;peak=Math.max(peak,Math.abs(value));if(raw===32767||raw===-32768)clipped++;}channels.push({rmsDb:amplitudeDb(Math.sqrt(squares/FFT_SIZE)),peakDb:amplitudeDb(peak),clippedSamples:clipped});}
  const left=this.spectrum(samples,0,rate),right=this.spectrum(samples,1,rate);
  return {channels,bandsDb:left.map((power,i)=>power===null||right[i]===null?null:amplitudeDb(Math.sqrt((power+right[i])/2))),sampleRate:rate,windowFrames:FFT_SIZE,windowMs:1000*FFT_SIZE/rate,silent:channels.every(c=>c.peakDb===DB_FLOOR)};
 }
}
