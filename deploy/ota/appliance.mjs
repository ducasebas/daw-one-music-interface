import {existsSync,readFileSync} from 'node:fs';
import {maintainSoftware,recordMaintenance,maintenanceFailure} from './maintenance.mjs';
export function maintainAppliance(candidate,run,enabled,options={}){
 if(!enabled)return false;
 const path=candidate+'/deploy/update-appliance.sh';
 if(!existsSync(path))throw Error('Signed candidate is missing appliance maintenance');
 const manifest=JSON.parse(readFileSync(candidate+'/release-manifest.json','utf8'));
 if(!manifest.files.some(f=>f.path==='deploy/update-appliance.sh'))throw Error('Appliance maintenance is outside the signed inventory');
 const software=maintainSoftware(candidate,run,options);if(software!==null)return software;
 try{run('/usr/bin/env',['TUNEBOX_APPLIANCE_LOCKED=1','TUNEBOX_APPLIANCE_OTA=1','/bin/bash',path,'--apply']);}
 catch{const state=recordMaintenance('failed','failed',{...options,run,release:manifest.release});throw Error(maintenanceFailure(state));}
 return true;
}
