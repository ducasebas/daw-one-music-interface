import {createServer as netServer} from 'node:net';
import {createProgressServer} from './progress-server.mjs';
import {chmodSync,rmSync,writeFileSync,renameSync,existsSync} from 'node:fs';
import {DeviceManager} from '../../shared/device-manager.js';
import {rootAdapter} from './root-adapter.mjs';
import {updateStatus} from '../../server/update-status.js';
const adapter=rootAdapter(),manager=new DeviceManager(adapter),socket='/run/daw-one-manager/control.sock';
rmSync(socket,{force:true});
netServer(connection=>{
 let raw='',handled=false;connection.setTimeout(30000,()=>connection.destroy());
 connection.on('error',()=>{});
 connection.on('data',async chunk=>{if(handled)return;raw+=chunk;if(raw.length>8192)return connection.destroy();if(!raw.includes('\n'))return;handled=true;
  try{const request=JSON.parse(raw.split('\n')[0]);const result=await manager.request(request);if(request.command!=='status')console.log(JSON.stringify({component:'tunebox-manager',action:request.command,result:'accepted'}));connection.end(JSON.stringify({ok:true,result})+'\n');}catch(error){connection.end(JSON.stringify({ok:false,error:String(error.message).slice(0,180)})+'\n');}
 });
}).listen(socket,()=>chmodSync(socket,0o660));
createProgressServer({frameReady:()=>{const p='/run/daw-one-display/ready.json';if(!existsSync('/run/daw-one-display'))return;writeFileSync(p+'.frame.tmp',JSON.stringify({ready:true,observedAt:Date.now()})+'\n',{mode:0o660});renameSync(p+'.frame.tmp',p);},getStatus:()=>updateStatus(),isAppReady:async()=>{try{const response=await fetch('http://127.0.0.1:3001/api/health',{signal:AbortSignal.timeout(1000)});return response.ok&&(await response.json()).ok===true;}catch{return false;}}}).listen(3002,'127.0.0.1');
