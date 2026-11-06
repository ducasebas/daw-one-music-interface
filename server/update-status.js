import {readFileSync} from 'node:fs';
const commit=v=>/^[a-f0-9]{40}$/.test(v)?v:null;
const text=(v,max=100)=>typeof v==='string'?v.slice(0,max):null;
const version=v=>v&&typeof v==='object'?{release:text(v.release),commit:commit(v.commit),notes:text(v.notes,500)}:null;
export function publicUpdateStatus(v={}) {
 return {status:text(v.status,40)||'unknown',channel:['preview','stable'].includes(v.channel)?v.channel:null,commit:commit(v.commit),release:text(v.release),checkedAt:typeof v.checkedAt==='string'&&Number.isFinite(Date.parse(v.checkedAt))?v.checkedAt:null,percent:typeof v.percent==='number'&&Number.isFinite(v.percent)?Math.min(100,Math.max(0,Math.floor(v.percent))):null,downloadedBytes:Number.isSafeInteger(v.downloadedBytes)?Math.max(0,v.downloadedBytes):null,totalBytes:Number.isSafeInteger(v.totalBytes)?Math.max(0,v.totalBytes):null,current:version(v.current),available:version(v.available)};
}
export function updateStatus(path='/var/lib/daw-one-update-status/status.json'){
 try{const raw=readFileSync(path,'utf8');if(raw.length>4096)throw Error();return publicUpdateStatus(JSON.parse(raw));}catch{return publicUpdateStatus({status:'not-configured'});}
}
export function deploymentCommit(){try{const v=JSON.parse(readFileSync(new URL('../deployment-ota.json',import.meta.url),'utf8'));return commit(v.commit);}catch{return null;}}
