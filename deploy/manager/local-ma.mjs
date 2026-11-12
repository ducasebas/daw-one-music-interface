import {existsSync,readFileSync} from 'node:fs';
import {assessHost} from '../host-capacity.js';
import {atomicJson,readJson} from './io.mjs';
const base='/var/lib/daw-one-manager/local-ma.json';
export function localMaController({run,assess=assessHost}={}){
 const target=()=>{try{return readFileSync('/opt/daw-one/deployment-target','utf8').trim();}catch{return 'unknown';}};
 const status=async()=>{const capacity=assess(target());const docker=await run('/usr/bin/docker',['compose','version']).then(()=>true,()=>false);const active=(await run('/usr/bin/systemctl',['is-active','daw-one-local-ma-install.service']).catch(()=>'')).trim();const saved=readJson(base,{});return {capacity,dockerAvailable:docker,installing:['activating','active'].includes(active),job:saved,url:'http://127.0.0.1:8095',supported:true};};
 return {status,async install(){const value=await status();if(!value.capacity.eligible)throw Error('Insufficient measured capacity for local Music Assistant');if(!value.dockerAvailable)throw Error('Install Docker Engine and Compose first; no remote bootstrap is run');if(value.installing)throw Error('Local Music Assistant installation is already running');if(existsSync('/etc/daw-one/music-assistant.compose.yml'))throw Error('A local server configuration already exists; inspect it before reinstalling');atomicJson(base,{phase:'queued',observedAt:Date.now()});await run('/usr/bin/systemctl',['start','--no-block','daw-one-local-ma-install.service']);return {queued:true};}};
}
