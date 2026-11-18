import {existsSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {powerDefaults,powerSettings} from '../../shared/power-settings.js';
import {canUpdate} from '../ota/policy.mjs';
import {atomicJson,readJson} from './io.mjs';

const path='/etc/daw-one-power/settings.json';
const unit='/etc/systemd/system/daw-one-power.service';
const pdUnit='/etc/systemd/system/daw-one-pd-request.service';
const qualification='/var/lib/daw-one-power/qualification.json';
const runtime='/run/daw-one-pd';
const qualified=s=>s?.qualified===true&&s.phase==='ready'&&s.cable5AVerified===true&&s.source==='HUSB238'&&s.volts===20&&s.amps===5;

// Keep the four legacy reader booleans usable by a rolled-back GUI. New clients
// combine the separate startup policy with those settings; it is never hidden
// inside a configuration object that an older strict validator cannot read.
export function powerResponse(value){
 if(!value.settings)return value;
 const {startup100W,...settings}=value.settings;
 return {...value,settings,startup100W:startup100W===true};
}

export function assertPdRequestIdle(state,hardwareIdle=false){
 if(!canUpdate(state))throw Error('Pause playback and finish audio tests before the 100 W setup');
 if(state.mode==='music-assistant'&&state.activity?.localIndependent!==true)throw Error('Remove TuneBox from its group before the 100 W setup');
 if(state.mode==='simulation'&&!hardwareIdle)throw Error('The physical audio output must be idle before the 100 W setup');
}

export function powerMonitoring({run,exists=existsSync,read=readJson,write=atomicJson,context=async()=>null,hardwareIdle=()=>false,now=Date.now,id=()=>randomBytes(16).toString('hex')}={}){
 const status=()=>{
  const supported=exists(unit)&&exists('/dev/i2c-1'),negotiationSupported=supported&&exists(pdUnit);
  const proof=read(qualification,{}),pdQualified=qualified(proof);
  const lastPdRequest=proof?.phase==='requesting'?'interrupted':proof?.phase==='failed'?'failed':pdQualified?'verified':'not-configured';
  let settings;
  try{settings=powerSettings(read(path,exists(path)?null:powerDefaults));}
  catch{return {supported,negotiationSupported,pdQualified,lastPdRequest,settings:null,error:'Power configuration is unavailable',readOnly:true};}
  return {supported,negotiationSupported,pdQualified,lastPdRequest,settings,models:['INA228','HUSB238'],shuntOhms:.015,readOnly:true};
 };
 const activate=value=>run('/usr/bin/systemctl',[(value.ina228||value.husb238)?'enable':'disable','--now','daw-one-power.service']);
 const startup=value=>run('/usr/bin/systemctl',[value?'enable':'disable','daw-one-pd-startup.service']);
 async function configure(value){
  let settings=powerSettings(value);const before=status();
  if(!before.supported)throw Error('Complete the device update to install power monitoring on I2C bus 1');
  if(!before.settings)throw Error('Repair the power configuration before changing it');
  if(!Object.hasOwn(value,'startup100W'))settings=powerSettings({...settings,startup100W:settings.husb238&&before.settings.startup100W});
  if(settings.startup100W&&(!before.negotiationSupported||!before.pdQualified))throw Error('Complete the 100 W setup successfully before enabling automatic setup');
  write(path,settings,0o644);
  try{
   await activate(settings);
   if(settings.startup100W!==before.settings.startup100W)await startup(settings.startup100W);
   return {...status(),saved:true};
  }catch{
   write(path,before.settings,0o644);
   await activate(before.settings).catch(()=>{});
   if(settings.startup100W!==before.settings.startup100W)await startup(before.settings.startup100W).catch(()=>{});
   throw Error('Power monitoring could not start. Previous settings were restored.');
  }
 }
 async function request100W(args){
  if(args.confirmed!==true||args.cable5AVerified!==true||typeof args.startup!=='boolean')throw Error('Confirm the 100 W supply and 5 A cable first');
  const before=status();
  if(!before.negotiationSupported||!before.settings)throw Error('Complete the device update to install the 100 W setup');
  const state=await context();
  assertPdRequestIdle(state,state?.mode==='simulation'&&hardwareIdle());
  const requestId=id(),started=now();
  write(runtime+'/request.json',{id:requestId,confirmed:true,cable5AVerified:true,expiresAt:started+20000},0o644);
  let failed=false;
  try{await run('/usr/bin/systemctl',['start','daw-one-pd-request.service']);}catch{failed=true;}
  const result=read(runtime+'/result.json',{});
  const fresh=result?.requestId===requestId&&Number.isInteger(result.observedAt)&&result.observedAt>=started&&result.observedAt<=now()+1000&&now()-result.observedAt<15000;
  if(failed||!fresh||!qualified(result)||result.status!=='ready')throw Error(fresh&&typeof result.error==='string'?result.error.slice(0,240):'The 20 V / 5 A contract was not confirmed. No automatic retry was queued.');
  try{
   const saved=await configure({...before.settings,husb238:true,startup100W:args.startup});
   return {...saved,pd:{volts:20,amps:5,watts:100,verified:true}};
  }catch{throw Error('20 V / 5 A was confirmed, but the monitoring or startup policy could not be saved. Previous settings were restored.');}
 }
 return {status,configure,request100W};
}
