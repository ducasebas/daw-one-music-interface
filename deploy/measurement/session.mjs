import {blockingFaults} from '../manager/dsp.mjs';
const units=['tunebox-player.service','squeezelite.service'];
/** Journal before touching audio; restore EQ before reopening the previous player. */
export async function prepareMeasurement({run,dsp,read,write,output,verifyCorrection=false}){
 const pending=read();if(pending)throw Error('Previous audio restoration is pending');
 const saved={schema:1,units:[],controls:[],output};
 if(output==='plughw:CARD=LouderRaspberry,DEV=0'){
  const state=await dsp.get();if(!state.supported||blockingFaults(state.faults).length)throw Error('Resolve amplifier faults before measuring');
  saved.controls=state.controls.map(({id,name,value})=>({id,name,value}));
 }
 for(const unit of units)if((await run('/usr/bin/systemctl',['is-active',unit]).catch(()=>'')).trim()==='active')saved.units.push(unit);
 write(saved);
 for(const unit of saved.units)await run('/usr/bin/systemctl',['stop',unit]);
 if(saved.controls.length&&!verifyCorrection){
  const changes=saved.controls.filter(c=>/^(?:EQ )?\d{5}(?: Hz)?$/.test(c.name)).map(c=>({id:c.id,value:0}));
  if(changes.length!==15)throw Error('A complete supported 15-band equalizer is required for the baseline');
  await dsp.set(changes);
 }
}
export async function restoreMeasurement({run,dsp,read,clear}){
 const saved=read();if(!saved)return;
 const previous=Array.isArray(saved)?{units:saved,controls:[]}:saved;
 if(!Array.isArray(previous.units)||previous.units.some(u=>!units.includes(u)))throw Error('Invalid audio restore journal');
 if(previous.controls?.length){
  const current=await dsp.get();
  if(previous.controls.some(c=>!current.controls.some(v=>v.id===c.id&&v.name===c.name&&Number.isInteger(c.value)&&c.value>=v.min&&c.value<=v.max)))throw Error('DSP restore requires administrator attention');
  await dsp.set(previous.controls.map(({id,value})=>({id,value})));
 }
 for(const unit of previous.units)await run('/usr/bin/systemctl',['start',unit]);
 clear();
}
