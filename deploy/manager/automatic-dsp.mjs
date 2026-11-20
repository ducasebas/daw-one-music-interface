import {blockingFaults} from './dsp.mjs';
import {existsSync} from 'node:fs';
import {atomicJson,readJson} from './io.mjs';
import {automaticDspSettings,automaticDspDefaults,automaticDspProposal,dspEqSnapshot,effectiveDspBaseline,sameDspEq,dspRamp} from '../../shared/automatic-dsp.js';

/** Root-owned baseline; browser metadata cannot provide ALSA ids or gains. */
export class AutomaticDsp {
  constructor({dsp,context,read=readJson,write=atomicJson,exists=existsSync,path='/var/lib/daw-one-manager/automatic-dsp.json',publicPath='/run/daw-one-dsp/status.json',sleep=ms=>new Promise(r=>setTimeout(r,ms)),now=()=>Date.now()}={}){
    Object.assign(this,{dsp,context,read,write,exists,path,publicPath,sleep,now});
    const saved=read(path,null);
    this.recoveryRequired=exists(path)&&(!saved||saved.schema!==1);
    try{this.state=saved?.schema===1?{...saved,settings:automaticDspSettings(saved.settings)}:{schema:1,settings:automaticDspDefaults()};}
    catch{this.state={schema:1,settings:automaticDspDefaults()};this.recoveryRequired=true;}
  }
  publicStatus(supported){
    return {supported:supported??this.supported??false,settings:this.state.settings,activeProfile:this.state.activeProfile||null,reason:this.state.reason||null,error:this.state.error||null,recoveryRequired:this.recoveryRequired,baselineSaved:!!this.state.baseline,lastAppliedAt:this.state.lastAppliedAt||null};
  }
  save(){this.write(this.path,this.state);this.write(this.publicPath,this.publicStatus(),0o644);}
  async status(){
    const actual=await this.dsp.get();try{dspEqSnapshot(actual.controls);this.supported=actual.supported===true;}catch{this.supported=false;}
    return this.publicStatus();
  }
  async configure(input){
    const settings=automaticDspSettings(input);
    if(this.recoveryRequired)throw Error('Saved sound settings need administrator recovery; no DSP was changed');
    const actual=await this.dsp.get();this.supported=actual.supported===true;
    if(!settings.enabled){
      if(this.state.settings.enabled&&this.state.original){
        if(!sameDspEq(actual.controls,this.state.lastApplied)){
          this.state={...this.state,settings,reason:'External DSP change preserved',error:null};this.save();return {...this.publicStatus(),saved:true};
        }
        await this.dsp.set(this.state.original.map(({id,value})=>({id,value})));
      }
      this.state={...this.state,settings,activeProfile:null,error:null,reason:'Manual sound'};this.save();return {...this.publicStatus(),saved:true};
    }
    const context=await this.context();
    if(!context.ready||blockingFaults(actual.faults).length)throw Error('Wake TuneBox and resolve audio hardware activity or faults before configuring automatic sound');
    dspEqSnapshot(actual.controls);
    if(this.state.settings.enabled&&!sameDspEq(actual.controls,this.state.lastApplied)){
      this.state={...this.state,settings:{...this.state.settings,enabled:false},reason:'External DSP change preserved',error:'The equalizer changed outside automatic sound. Review it before enabling again.'};this.save();throw Error(this.state.error);
    }
    if(!this.state.settings.enabled){
      const factory=this.read('/var/lib/daw-one-manager/starting-sound.json',null),factoryWarm=factory?.status==='applied'&&sameDspEq(actual.controls,factory.applied);const baseline=effectiveDspBaseline(actual.controls).map(c=>({...c,value:factoryWarm&&c.name!=='Equalizer'?0:c.value}));this.state={schema:1,settings,original:dspEqSnapshot(actual.controls),baseline,baselineKind:factoryWarm?'factory-reference':'current-eq',lastApplied:dspEqSnapshot(actual.controls)};this.save();
      // An inactive custom curve is not an audible baseline. Normalize its bands
      // while EQ remains off, then ramp the bounded voicing and enable EQ last.
      const eq=actual.controls.find(c=>c.name==='Equalizer'),target=this.state.baseline.find(c=>c.name==='Equalizer');
      if(eq.value!==target.value){
        const changes=this.state.baseline.filter(c=>c.name!=='Equalizer'&&actual.controls.find(v=>v.id===c.id)?.value!==c.value).map(({id,value})=>({id,value}));
        if(changes.length){const result=await this.dsp.set(changes);this.state.lastApplied=dspEqSnapshot(result.controls);this.save();}
      }
    }else{this.state.settings=settings;this.save();}
    return {...await this.update({force:true}),saved:true};
  }
  async update({force=false}={}){
    if(!this.state.settings.enabled||this.recoveryRequired)return this.publicStatus();
    const context=await this.context();
    if(!context.ready||!force&&!context.bluetooth&&(!context.playing||!context.selectedLocal))return {...this.publicStatus(),deferred:true};
    const trackKey=context.trackKey||null,source=context.bluetooth?'bluetooth':context.selectedLocal?'local':'unselected';
    // Late/changed metadata is used on the next track, not halfway through a song.
    if(!force&&trackKey===this.state.trackKey&&source===this.state.source)return this.publicStatus();
    const actual=await this.dsp.get();this.supported=actual.supported===true;
    if(!actual.supported||blockingFaults(actual.faults).length)return {...this.publicStatus(),deferred:true};
    if(!sameDspEq(actual.controls,this.state.lastApplied)){
      this.state={...this.state,settings:{...this.state.settings,enabled:false},reason:'External DSP change preserved',error:'Automatic sound stopped because the equalizer changed.'};this.save();return this.publicStatus();
    }
    const proposal=automaticDspProposal(actual.controls,this.state.baseline,this.state.settings,context.selectedLocal&&!context.bluetooth?context.genres:[]);
    let current=actual;
    try{
      const frames=dspRamp(current.controls,proposal.changes);
      for(let i=0;i<frames.length;i++){
        const check=await this.context();if(!check.ready||check.bluetooth!==context.bluetooth||check.trackKey!==context.trackKey||check.selectedLocal!==context.selectedLocal)throw Error('Audio source changed during sound adjustment');
        current=await this.dsp.set(frames[i]);this.state.lastApplied=dspEqSnapshot(current.controls);this.save();
        if(i<frames.length-1)await this.sleep(180);
      }
      this.state={...this.state,trackKey,source,activeProfile:proposal.profile,reason:proposal.reason,error:null,lastAppliedAt:frames.length?this.now():this.state.lastAppliedAt||this.now()};this.save();
      return this.publicStatus();
    }catch{
      // Keep bounded attenuation on failure. Do not raise levels or overwrite a
      // potentially external change by guessing a restoration state.
      this.state={...this.state,settings:{...this.state.settings,enabled:false},error:'Automatic sound stopped. Review the local equalizer before enabling again.',reason:'Sound adjustment interrupted'};this.save();
      throw Error(this.state.error);
    }
  }
}
