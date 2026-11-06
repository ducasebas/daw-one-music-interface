import {createConnection} from 'node:net';
import {randomBytes,timingSafeEqual} from 'node:crypto';
export const controlToken=randomBytes(24).toString('hex');
export function validDeviceRequest(request){
 const supplied=request.get('X-TuneBox-Control')||'';
 if(Buffer.byteLength(supplied)!==Buffer.byteLength(controlToken)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(controlToken)))return false;
 if(request.get('Sec-Fetch-Site')==='cross-site')return false;
 const origin=request.get('Origin');
 try{return !origin||new URL(origin).host===request.get('host')||new URL(origin).host===request.get('x-forwarded-host');}catch{return false;}
}
export function deviceRequest(request,socketPath=process.env.DAW_MANAGER_SOCKET||'/run/daw-one-manager/control.sock'){
 return new Promise((resolve,reject)=>{
  const socket=createConnection(socketPath);let text='';
  socket.setTimeout(30000,()=>socket.destroy(Error('Device manager timed out')));
  socket.on('connect',()=>socket.write(JSON.stringify(request)+'\n'));
  socket.on('data',chunk=>{text+=chunk;if(text.length>32768)return socket.destroy(Error('Device response too large'));if(text.includes('\n')){socket.end();try{const v=JSON.parse(text.split('\n')[0]);if(v.ok)resolve(v.result);else reject(Error(v.error||'Device action failed'));}catch(e){reject(e);}}});
  socket.on('error',()=>reject(Error('Device manager unavailable; install the device manager first')));
  socket.on('end',()=>{if(!text.includes('\n'))reject(Error('Incomplete device response'));});
 });
}
