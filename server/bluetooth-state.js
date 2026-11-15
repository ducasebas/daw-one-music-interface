import {readFileSync} from 'node:fs';
const read=path=>{try{return JSON.parse(readFileSync(path,'utf8'));}catch{return {};}};
const label=v=>typeof v==='string'?v.replace(/[\x00-\x1f\x7f]/g,'').slice(0,160):'';
export function bluetoothState({directory='/run/daw-one-bluetooth',configuration='/etc/daw-one/bluetooth.json',now=Date.now()}={}){
 const config=read(configuration),source=read(directory+'/source.json'),telemetry=read(directory+'/telemetry.json'),pending=read(directory+'/pairing.json');
 const active=source.active===true,fresh=Number.isFinite(telemetry.observedAt)&&Math.abs(now-telemetry.observedAt)<10000;
 return {supported:config.verified===true,active,sessionId:/^[-a-f0-9]{36}$/.test(source.sessionId)?source.sessionId:null,phase:active?(source.phase||'active'):'off',volume:Number.isInteger(source.volume)?source.volume:0,limit:Number.isInteger(source.limit)?source.limit:40,available:fresh&&telemetry.available===true,discoverable:fresh&&telemetry.discoverable===true,devices:fresh&&Array.isArray(telemetry.devices)?telemetry.devices.slice(0,16).filter(d=>/^([A-F0-9]{2}:){5}[A-F0-9]{2}$/.test(d.address)).map(d=>({address:d.address,name:label(d.name)||'Phone',connected:d.connected===true,paired:d.paired===true,title:label(d.title),artist:label(d.artist)})):[],pairing:active&&fresh&&pending.nonce&&Number.isFinite(pending.expiresAt)&&pending.expiresAt>now&&/^[a-f0-9]{32}$/.test(pending.nonce)&&/^\d{6}$/.test(pending.code)?{nonce:pending.nonce,code:pending.code,name:label(pending.name)||'Phone'}:null};
}
