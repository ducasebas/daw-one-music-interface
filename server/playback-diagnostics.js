import {readFileSync,readdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
const read=path=>{try{return readFileSync(path,'utf8').slice(0,8192);}catch{return '';}};
export function alsaPlayback({readText=read,list=()=>{try{return readdirSync('/proc/asound');}catch{return [];}}}={}){
 const name=list().filter(v=>/^card\d+$/.test(v)).find(v=>/Louder/i.test(readText('/proc/asound/'+v+'/id')));
 if(!name)return {supported:false,state:'unknown',format:null,rate:null,channels:null,pcmBitrate:null};
 const base='/proc/asound/'+name+'/pcm0p/sub0/',status=readText(base+'status'),params=readText(base+'hw_params');
 const field=key=>new RegExp('^'+key+':\\s*(\\S+)','m').exec(params)?.[1]||null;
 const format=field('format'),rate=Number(field('rate'))||null,channels=Number(field('channels'))||null,bits=/^(?:S|U|FLOAT)(\d+)_/.exec(format||'')?.[1];
 const state=/^state:\s*(\w+)/m.exec(status)?.[1]||(/closed/.test(status)?'CLOSED':'unknown');
 return {supported:!!status,state,format,rate,channels,pcmBitrate:rate&&channels&&bits?rate*channels*Number(bits):null};
}
/** Two explicit ALSA XRUN observations are evidence; silence and absent analysis are not.
 * Sampling is sparse and stops when local MA playback stops. No audio/route changes. */
export class PlaybackDiagnostics{
 constructor({context,inspect=alsaPlayback,now=()=>performance.now(),onFault=()=>{}}){Object.assign(this,{context,inspect,now,onFault});this.last=-Infinity;this.badAt=null;this.active=false;this.dismissed=false;this.good=0;this.value={observedAt:null,output:{supported:false,state:'unknown'},fault:null};this.timer=setInterval(()=>this.sample(),15000);this.timer.unref?.();}
 sample(force=false){
  if(!force&&this.now()-this.last<10000)return this.value;
  const c=this.context();if(!c.localPlaying&&!force)return this.value;
  this.last=this.now();const output=this.inspect();this.value={observedAt:Date.now(),output,fault:this.active?'alsa-xrun':null};
  if(!c.localPlaying||c.blocked){this.badAt=null;return this.value;}
  if(output.state==='XRUN'){
   this.good=0;
   if(this.badAt===null)this.badAt=this.now();
   else if(this.now()-this.badAt>=1000&&!this.active&&!this.dismissed){this.active=true;this.value.fault='alsa-xrun';this.onFault();}
  }else{this.badAt=null;if(output.state==='RUNNING'&&++this.good>=2)this.dismissed=false;}
  return this.value;
 }
 status(){return {...this.value,fault:this.active?'alsa-xrun':null};}
 acknowledge(){this.active=false;this.dismissed=true;this.badAt=null;this.value.fault=null;}
 close(){clearInterval(this.timer);}
}
