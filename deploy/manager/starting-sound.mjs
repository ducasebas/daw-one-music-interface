import {blockingFaults} from './dsp.mjs';
import {atomicJson,readJson} from './io.mjs';
import {dspPreset} from '../../shared/dsp-settings.js';
import {dspEqSnapshot} from '../../shared/automatic-dsp.js';

/** Initialize a genuinely flat new installation once; never replace a custom EQ. */
export async function initializeStartingSound({dsp,preference='warm',blocked=false,read=readJson,write=atomicJson,path='/var/lib/daw-one-manager/starting-sound.json'}){
 if(blocked)return {skipped:true,reason:'Audio setup is busy'};
 const previous=read(path,null);if(previous)return {skipped:true,reason:'Starting sound was already reviewed'};
 if(preference!=='warm'){write(path,{status:'manual-selected',at:new Date().toISOString()});return {skipped:true,reason:'Your starting sound choice was preserved'};}
 const current=await dsp.get();if(!current.supported||blockingFaults(current.faults).length)return {skipped:true,reason:'Louder output is unavailable'};
 let original;try{original=dspEqSnapshot(current.controls);}catch{return {skipped:true,reason:'Complete EQ metadata is unavailable'};}
 if(original.some(c=>c.name!=='Equalizer'&&c.value!==0)){write(path,{status:'custom-preserved',at:new Date().toISOString()});return {skipped:true,reason:'Existing EQ preserved'};}
 const desired=dspPreset(current.controls,'warm'),changes=desired.filter(c=>original.some(v=>v.id===c.id)&&c.value!==current.controls.find(v=>v.id===c.id).value).map(({id,value})=>({id,value}));
 const result=changes.length?await dsp.set(changes):current;
 write(path,{status:'applied',at:new Date().toISOString(),original,applied:dspEqSnapshot(result.controls)});
 return {initialized:true,profile:'warm'};
}
