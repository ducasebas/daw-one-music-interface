import {existsSync,readFileSync} from 'node:fs';
export function maintainAppliance(candidate,run,enabled){
 if(!enabled)return false;
 const path=candidate+'/deploy/update-appliance.sh';
 if(!existsSync(path))throw Error('Signed candidate is missing appliance maintenance');
 const manifest=JSON.parse(readFileSync(candidate+'/release-manifest.json','utf8'));
 if(!manifest.files.some(f=>f.path==='deploy/update-appliance.sh'))throw Error('Appliance maintenance is outside the signed inventory');
 run('/usr/bin/env',['TUNEBOX_APPLIANCE_LOCKED=1','TUNEBOX_APPLIANCE_OTA=1','/bin/bash',path,'--apply']);
 return true;
}
