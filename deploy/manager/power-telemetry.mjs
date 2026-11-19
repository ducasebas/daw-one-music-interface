import {existsSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {powerDefaults,powerSettings,startupPowerKeys} from '../../shared/power-settings.js';
import {qualifiedPdProfile,maximumPdQualified,offeredPdProfile,validPdAmps} from '../../shared/pd-profile.js';
import {canUpdate} from '../ota/policy.mjs';
import {atomicJson,readJson} from './io.mjs';

const path='/etc/daw-one-power/settings.json';
const unit='/etc/systemd/system/daw-one-power.service';
const pdUnit='/etc/systemd/system/daw-one-pd-request.service';
const qualification='/var/lib/daw-one-power/qualification.json';
const runtime='/run/daw-one-pd';
const qualified=s=>qualifiedPdProfile(s)&&s.amps===5;
const startupEnabled=s=>startupPowerKeys.some(k=>s[k]);

// Keep the four legacy reader booleans usable by a rolled-back GUI. New clients
// combine the separate startup policy with those settings; it is never hidden
// inside a configuration object that an older strict validator cannot read.
export function powerResponse(value){
 if(!value.settings)return value;
 const {startup100W,startup20V,startupMaximum20V,...settings}=value.settings;
 return {...value,settings,startup100W:startup100W===true,startup20V:startup20V===true,startupMaximum20V:startupMaximum20V===true};
}

export function assertPdRequestIdle(state,hardwareIdle=false){
 if(!canUpdate(state))throw Error('Pause playback and finish audio tests before power setup');
 if(state.mode==='music-assistant'&&state.activity?.localIndependent!==true)throw Error('Remove TuneBox from its group before power setup');
 if(state.mode==='simulation'&&!hardwareIdle)throw Error('The physical audio output must be idle before power setup');
}

export function powerMonitoring({run,exists=existsSync,read=readJson,write=atomicJson,context=async()=>null,hardwareIdle=()=>false,now=Date.now,id=()=>randomBytes(16).toString('hex')}={}){
 const status=()=>{
  const supported=exists(unit)&&exists('/dev/i2c-1'),negotiationSupported=supported&&exists(pdUnit);
  const proof=read(qualification,{}),pdQualified=qualified(proof);
  const pdProfileQualified=qualifiedPdProfile(proof),profileRequestSupported=negotiationSupported;
  const verifiedProfile=pdProfileQualified?{volts:20,amps:proof.amps,watts:proof.watts}:null;
  const lastPdRequest=['requesting','querying'].includes(proof?.phase)?'interrupted':proof?.phase==='failed'?'failed':pdProfileQualified?'verified':'not-configured';
  const features={supported,negotiationSupported,profileRequestSupported,sourceDiscoverySupported:negotiationSupported,maximumRequestSupported:negotiationSupported,maximumProfileQualified:maximumPdQualified(proof),pdQualified,pdProfileQualified,verifiedProfile,lastPdRequest};
  let settings;
  try{settings=powerSettings(read(path,exists(path)?null:powerDefaults));}
  catch{return {...features,settings:null,error:'Power configuration is unavailable',readOnly:true};}
  return {...features,settings,models:['INA228','HUSB238'],shuntOhms:.015,readOnly:true};
 };
 const activate=value=>run('/usr/bin/systemctl',[(value.ina228||value.husb238)?'enable':'disable','--now','daw-one-power.service']);
 const startup=value=>run('/usr/bin/systemctl',[value?'enable':'disable','daw-one-pd-startup.service']);
 async function configure(value){
  let settings=powerSettings(value);const before=status();
  if(!before.supported)throw Error('Complete the device update to install power monitoring on I2C bus 1');
  if(!before.settings)throw Error('Repair the power configuration before changing it');
  for(const key of startupPowerKeys)if(!Object.hasOwn(value,key))settings[key]=settings.husb238&&before.settings[key];
  if(startupPowerKeys.some(k=>value[k]===true))for(const key of startupPowerKeys)if(!Object.hasOwn(value,key))settings[key]=false;
  settings=powerSettings(settings);
  if(settings.startup100W&&(!before.negotiationSupported||!before.pdQualified))throw Error('Complete the 100 W setup successfully before enabling automatic setup');
  if(settings.startup20V&&(!before.profileRequestSupported||!before.pdProfileQualified))throw Error('Verify the selected power profile before enabling automatic setup');
  if(settings.startupMaximum20V&&(!before.maximumRequestSupported||!before.maximumProfileQualified))throw Error('Complete maximum 20 V power setup before enabling automatic setup');
  write(path,settings,0o644);
  try{
   await activate(settings);
   if(startupEnabled(settings)!==startupEnabled(before.settings))await startup(startupEnabled(settings));
   return {...status(),saved:true};
  }catch{
   write(path,before.settings,0o644);
   await activate(before.settings).catch(()=>{});
   if(startupEnabled(settings)!==startupEnabled(before.settings))await startup(startupEnabled(before.settings)).catch(()=>{});
   throw Error('Power monitoring could not start. Previous settings were restored.');
  }
 }
 const freshResult=(result,requestId,started)=>result?.requestId===requestId&&Number.isInteger(result.observedAt)&&result.observedAt>=started&&result.observedAt<=now()+1000&&now()-result.observedAt<15000;
 async function discover(){
  const before=status();
  if(!before.sourceDiscoverySupported||!before.settings)throw Error('Complete the device update to install power setup');
  const state=await context();assertPdRequestIdle(state,state?.mode==='simulation'&&hardwareIdle());
  const requestId=id(),started=now();
  write(runtime+'/request.json',{id:requestId,operation:'discover',expiresAt:started+20000},0o644);
  let failed=false;try{await run('/usr/bin/systemctl',['start','daw-one-pd-request.service']);}catch{failed=true;}
  const result=read(runtime+'/result.json',{}),fresh=freshResult(result,requestId,started);
  if(failed||!fresh||result.status!=='discovered'||result.sourceCapabilitiesQueried!==true||!offeredPdProfile(result.pd)||result.pd.responseCode!==1)throw Error(fresh&&typeof result.error==='string'?result.error.slice(0,240):'Source capabilities were not confirmed; no power request was sent');
  return {...status(),sourceCapabilitiesQueried:true,discoveredPd:{...result.pd,observedAt:result.observedAt}};
 }
 async function request(args,legacy,maximum=false){
  const amps=legacy?5:args.amps;
  if(args.confirmed!==true||!validPdAmps(amps)||typeof args.cable5AVerified!=='boolean'||amps>3&&!args.cable5AVerified||typeof args.startup!=='boolean')throw Error('Confirm the selected power profile and a suitable USB-C cable first');
  const before=status();
  if(!before.negotiationSupported||!before.settings)throw Error('Complete the device update to install power setup');
  const state=await context();
  assertPdRequestIdle(state,state?.mode==='simulation'&&hardwareIdle());
  const requestId=id(),started=now();
  write(runtime+'/request.json',{id:requestId,confirmed:true,cable5AVerified:args.cable5AVerified,expiresAt:started+20000,...(!legacy?{amps}:{}),...(maximum?{strategy:'maximum20v'}:{})},0o644);
  let failed=false;
  try{await run('/usr/bin/systemctl',['start','daw-one-pd-request.service']);}catch{failed=true;}
  const result=read(runtime+'/result.json',{});
  const fresh=freshResult(result,requestId,started);
  if(failed||!fresh||!qualifiedPdProfile(result)||maximum&&!maximumPdQualified(result)||result.amps!==amps||result.cable5AVerified!==args.cable5AVerified||result.status!=='ready')throw Error(fresh&&typeof result.error==='string'?result.error.slice(0,240):'The selected 20 V power contract was not confirmed. No automatic retry was queued.');
  try{
   const saved=await configure({...before.settings,husb238:true,startup100W:legacy&&args.startup,startup20V:!legacy&&!maximum&&args.startup,startupMaximum20V:maximum&&args.startup});
   return {...saved,pd:{volts:20,amps,watts:20*amps,verified:true}};
  }catch{throw Error('The power contract was confirmed, but the monitoring or startup policy could not be saved. Previous settings were restored.');}
 }
 return {status,configure,discover,request100W:args=>request(args,true),request20V:args=>request(args,false),requestMaximum20V:args=>request(args,false,true)};
}
