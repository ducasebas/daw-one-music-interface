import {existsSync} from 'node:fs';
import {powerDefaults,powerSettings} from '../../shared/power-settings.js';
import {atomicJson,readJson} from './io.mjs';
const path='/etc/daw-one-power/settings.json',unit='/etc/systemd/system/daw-one-power.service';
export function powerMonitoring({run,exists=existsSync,read=readJson,write=atomicJson}={}){
 const status=()=>{let settings;try{settings=powerSettings(read(path,exists(path)?null:powerDefaults));}catch{return {supported:exists(unit)&&exists('/dev/i2c-1'),settings:null,error:'Power configuration is unavailable',readOnly:true};}return {supported:exists(unit)&&exists('/dev/i2c-1'),settings,models:['INA228','HUSB238'],shuntOhms:.015,readOnly:true};};
 const activate=value=>run('/usr/bin/systemctl',[(value.ina228||value.husb238)?'enable':'disable','--now','daw-one-power.service']);
 return {status,async configure(value){
  const settings=powerSettings(value),before=status();if(!before.supported)throw Error('Complete the device update to install power monitoring on I2C bus 1');
  if(!before.settings)throw Error('Repair the power configuration before changing it');
  write(path,settings,0o644);
  try{await activate(settings);return {...status(),saved:true};}
  catch{write(path,before.settings,0o644);await activate(before.settings).catch(()=>{});throw Error('Power monitoring could not start. Previous settings were restored.');}
 }};
}
