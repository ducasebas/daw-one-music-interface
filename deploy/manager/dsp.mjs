import {readFileSync,writeFileSync,renameSync,existsSync,rmSync} from 'node:fs';
const allowed=name=>name==='Equalizer'||/^Channel (Left|Right) Gain$/.test(name)||/^(?:EQ )?\d{5}(?: Hz)?$/.test(name);
export function equalizerOnValue(control){
 if(control?.type==='BOOLEAN')return 1;
 if(control?.type==='ENUMERATED'&&Array.isArray(control.options)){
  const find=label=>control.options.filter(o=>String(o.label).trim().toLowerCase()===label&&Number.isInteger(o.value)&&o.value>=control.min&&o.value<=control.max);
  const on=find('on'),off=find('off');
  if(on.length===1&&off.length===1&&on[0].value!==off[0].value)return on[0].value;
 }
 throw Error('Equalizer labels are unavailable; check the Louder device update before applying room correction');
}
export function parseDsp(text){
 const controls=[],faults=[];
 for(const block of String(text).split(/(?=^numid=)/m)){
  const head=block.match(/^numid=(\d+).*name='([^']+)'/m);if(!head)continue;
  const type=block.match(/type=(INTEGER|BOOLEAN|ENUMERATED)/)?.[1],range=block.match(/min=(-?\d+),max=(-?\d+)/),raw=block.match(/: values=([^\n]+)/)?.[1]?.split(',')[0]?.trim();
  if(type==='BOOLEAN'&&!['on','off','0','1'].includes(raw))continue;
  const value=type==='BOOLEAN'?(raw==='on'||raw==='1'?1:0):Number(raw);if(!Number.isFinite(value))continue;
  const items=Number(block.match(/items=(\d+)/)?.[1]);
  const c={id:Number(head[1]),name:head[2],min:type==='BOOLEAN'||type==='ENUMERATED'?0:Number(range?.[1]),max:type==='BOOLEAN'?1:type==='ENUMERATED'?items-1:Number(range?.[2]),value,type};
  if(type==='ENUMERATED'&&items>0&&items<=16){
   const options=Array.from(block.matchAll(/^\s*;\s*Item #(\d+) '([^']*)'\s*$/gm),m=>({value:Number(m[1]),label:m[2]}));
   if(options.length===items&&new Set(options.map(o=>o.value)).size===items&&options.every(o=>o.value>=0&&o.value<items&&o.label.length<=80))c.options=options;
  }
  if(allowed(c.name)&&Number.isFinite(c.min)&&Number.isFinite(c.max)&&c.max>=c.min)controls.push(c);
  else if(type==='BOOLEAN'&&(/^(?:Fault|Warning) /.test(c.name)||/Thermal|Overcurrent|PVDD|Clock Error|DC Fault|DSP\/Memory/.test(c.name)))faults.push({name:c.name,active:value===1});
 }
 return {controls:controls.slice(0,20),faults:faults.slice(0,20)};
}
/** Reserve headroom before active EQ changes; inactive curves may be restored safely. */
export function dspTransitionChanges(controls,input){
 const byId=new Map(controls.map(c=>[c.id,c])),seen=new Set();let changes=input.map(c=>({...c}));
 for(const v of changes){const c=byId.get(v.id);if(!c||seen.has(v.id)||!Number.isInteger(v.id)||!Number.isInteger(v.value)||v.value<c.min||v.value>c.max||(/Channel .* Gain/.test(c.name)&&v.value>0))throw Error('Unsupported DSP control or range');seen.add(v.id);}
 const projected=controls.map(c=>({...c,value:changes.find(v=>v.id===c.id)?.value??c.value}));
 const active=list=>{const eq=list.find(c=>c.name==='Equalizer');try{return !eq||eq.value===equalizerOnValue(eq);}catch{return true;}};
 const sum=list=>list.filter(c=>/^(?:EQ )?\d{5}(?: Hz)?$/.test(c.name)).reduce((n,c)=>n+Math.max(0,c.value),0);
 const afterActive=active(projected),headroom=afterActive?Math.max(active(controls)?sum(controls):0,sum(projected)):0;
 if(headroom){const gains=controls.filter(c=>/^Channel (Left|Right) Gain$/.test(c.name));if(gains.length!==2||gains.some(c=>c.min> -headroom))throw Error('EQ boost exceeds available digital headroom');for(const c of gains){const requested=changes.find(v=>v.id===c.id),value=Math.min(requested?.value??c.value,-headroom);if(requested)requested.value=value;else changes.push({id:c.id,value});}}
 const order=v=>{const c=byId.get(v.id);if(c.name==='Equalizer')return afterActive?4:0;if(/^Channel (Left|Right) Gain$/.test(c.name))return 1;return v.value<c.value?2:3;};
 return changes.sort((a,b)=>order(a)-order(b));
}
export function dspController({run,statePath='/var/lib/daw-one-manager/standby.json'}){async function get(){try{const raw=await run('/usr/bin/amixer',['-c','LouderRaspberry','contents']);const parsed=parseDsp(raw);return {supported:parsed.controls.length>0,card:'LouderRaspberry',...parsed};}catch{return {supported:false,controls:[],faults:[]};}}return {get,async standby(enabled){const current=await get();const gains=current.controls.filter(c=>/^Channel (Left|Right) Gain$/.test(c.name));if(!current.supported||gains.length!==2)throw Error('Local amplifier standby is unavailable; use screen rest');if(enabled){if(!existsSync(statePath)){writeFileSync(statePath+'.tmp',JSON.stringify(gains)+'\n',{mode:0o600});renameSync(statePath+'.tmp',statePath);}for(const c of gains)await run('/usr/bin/amixer',['-c','LouderRaspberry','--','cset','numid='+c.id,String(c.min)]);}else{let saved=[];try{saved=JSON.parse(readFileSync(statePath,'utf8'));}catch{}for(const c of saved){const actual=gains.find(v=>v.id===c.id&&v.name===c.name);if(!actual||!Number.isInteger(c.value)||c.value<actual.min||c.value>actual.max)throw Error('Standby restore needs local administrator attention');await run('/usr/bin/amixer',['-c','LouderRaspberry','--','cset','numid='+c.id,String(c.value)]);}rmSync(statePath,{force:true});}return {muted:enabled,supported:true};},async set(changes){if(existsSync(statePath))throw Error('Exit standby before changing DSP');const before=await get();if(!before.supported)throw Error('Louder ALSA controls are unavailable');const map=new Map(before.controls.map(c=>[c.id,c]));changes=dspTransitionChanges(before.controls,changes);const applied=[];try{for(const change of changes){await run('/usr/bin/amixer',['-c','LouderRaspberry','--','cset','numid='+change.id,String(change.value)]);applied.push(change.id);}const current=await get();if(changes.some(c=>current.controls.find(v=>v.id===c.id)?.value!==c.value))throw Error();return {saved:true,...current};}catch{for(const id of applied.reverse()){const c=map.get(id);await run('/usr/bin/amixer',['-c','LouderRaspberry','--','cset','numid='+id,String(c.value)]).catch(()=>{});}throw Error('DSP change failed; previous ALSA values were restored where possible');}}};}
