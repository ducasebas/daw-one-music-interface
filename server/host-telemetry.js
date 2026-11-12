import {readFileSync,readdirSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {cpus,loadavg,uptime,release as kernel,arch} from 'node:os';
const read=p=>{try{return readFileSync(p,'utf8').slice(0,65536).trim();}catch{return '';}};
const list=p=>{try{return readdirSync(p).slice(0,32);}catch{return [];}};
export function memoryTelemetry(text,pressure=''){
 const kb=k=>{const m=text.match(new RegExp('^'+k+':\\s+(\\d+)','m'));return m?Number(m[1])*1024:null;};
 const total=kb('MemTotal'),available=kb('MemAvailable'),swapTotal=kb('SwapTotal'),swapFree=kb('SwapFree');
 const m=pressure.match(/^some avg10=([\d.]+)/m),psi10=m?Number(m[1]):null;
 const fraction=total&&available!==null?available/total:null;
 return {totalBytes:total,availableBytes:available,usedBytes:total&&available!==null?total-available:null,swapUsedBytes:swapTotal!==null&&swapFree!==null?swapTotal-swapFree:null,psi10,pressure:fraction===null?'unknown':fraction<.08||psi10>=10?'high':fraction<.2||psi10>=1?'moderate':'low',method:'Linux MemAvailable and 10-second memory stall pressure (PSI); not the Apple algorithm'};
}
export function cpuTicks(text){const m=text.match(/^cpu\s+([\d ]+)/m);if(!m)return null;const v=m[1].trim().split(/\s+/).map(Number);return {total:v.slice(0,8).reduce((a,b)=>a+b,0),idle:(v[3]||0)+(v[4]||0)};}
export class HostTelemetry{
 constructor({readFile=read,files=list,now=Date.now,execute=execFile}={}){this.read=readFile;this.files=files;this.now=now;this.execute=execute;this.previous=null;this.value={};this.version=null;this.lastVersion=0;this.sample();}
 sample(){
  const now=this.now(),ticks=cpuTicks(this.read('/proc/stat')),prior=this.previous;
  const cpuPercent=ticks&&prior&&ticks.total>prior.total?Math.max(0,Math.min(100,100*(1-(ticks.idle-prior.idle)/(ticks.total-prior.total)))):null;this.previous=ticks;
  const number=(p,scale=1)=>{const v=this.read(p);return v!==''&&Number.isFinite(Number(v))?Number(v)/scale:null;};
  const fan=this.files('/sys/class/hwmon').flatMap(d=>this.files('/sys/class/hwmon/'+d).filter(n=>/^fan\d+_input$/.test(n)).map(n=>number('/sys/class/hwmon/'+d+'/'+n))).find(v=>v!==null);
  const interfaces=this.files('/sys/class/net').filter(n=>/^(eth|en|wl)[a-zA-Z0-9_-]{0,20}$/.test(n)).map(name=>({name,up:this.read('/sys/class/net/'+name+'/operstate')==='up',speedMbps:name.startsWith('wl')?null:number('/sys/class/net/'+name+'/speed')})).map(v=>({...v,speedMbps:v.speedMbps>0?v.speedMbps:null}));
  let backlight=null;try{const v=JSON.parse(this.read('/run/daw-one-display/status.json'));if(v.supported&&Number.isFinite(v.observedAt)&&now-v.observedAt<5000&&now>=v.observedAt-1000)backlight=v;}catch{}
  let power=null;try{const v=JSON.parse(this.read('/run/daw-one-power/readings.json'));if(v.schema===1&&Number.isFinite(v.observedAt)&&now-v.observedAt<5000&&now>=v.observedAt-1000){const bounded=(n,max)=>Number.isFinite(n)&&n>=0&&n<=max?n:null;power={observedAt:v.observedAt,watts:bounded(v.watts,500),volts:bounded(v.volts,85),amps:bounded(v.amps,20),contractWatts:bounded(v.contractWatts,240),source:'External calibrated power telemetry'};}}catch{}
  const temp=number('/sys/class/thermal/thermal_zone0/temp',1000);
  this.value={observedAt:now,cpu:{usagePercent:cpuPercent,load1:loadavg()[0],cores:cpus().length,temperatureC:temp},memory:memoryTelemetry(this.read('/proc/meminfo'),this.read('/proc/pressure/memory')),fanRpm:fan??null,interfaces,backlight,power,hardware:{model:this.read('/proc/device-tree/model').replace(/\0/g,'').slice(0,120)||'Unknown host',kernel:kernel(),architecture:arch(),uptimeSeconds:Math.round(uptime())},chromiumVersion:this.version};
  if(now-this.lastVersion>3600000){this.lastVersion=now;this.execute('/usr/bin/chromium',['--version'],{timeout:3000,maxBuffer:1024},(error,out)=>{if(!error&&/^Chromium [\w .+~:-]{1,130}/.test(out))this.version=out.trim().slice(0,140);});}
  return this.value;
 }
}
