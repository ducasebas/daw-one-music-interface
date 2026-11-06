import {readFileSync} from 'node:fs';
export function updateStatus(path='/var/lib/daw-one-update-status/status.json'){
 try{const raw=readFileSync(path,'utf8');if(raw.length>2048)throw Error();const v=JSON.parse(raw);return {status:String(v.status||'unknown').slice(0,40),channel:['preview','stable'].includes(v.channel)?v.channel:null,commit:/^[a-f0-9]{40}$/.test(v.commit)?v.commit:null,checkedAt:v.checkedAt||null};}catch{return {status:'not-configured',channel:null,commit:null,checkedAt:null};}
}
export function deploymentCommit(){try{const v=JSON.parse(readFileSync(new URL('../deployment-ota.json',import.meta.url),'utf8'));return /^[a-f0-9]{40}$/.test(v.commit)?v.commit:null;}catch{return null;}}
