import {existsSync,readFileSync,writeFileSync,renameSync,chmodSync,rmSync} from 'node:fs';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {updateSettings} from '../../shared/update-settings.js';
import {canUpdate} from '../ota/policy.mjs';
import {MusicAssistantTransport} from '../../server/ma-transport.js';
import {atomicJson,readJson,boundedJson} from './io.mjs';
import {powerController} from './power.mjs';
import {networkController} from './network.mjs';
import {clockController} from './clock.mjs';
import {measurementController} from './measurement.mjs';
import {localMaController} from './local-ma.mjs';
import {dspController} from './dsp.mjs';
const exec=promisify(execFile);
const configPath='/etc/daw-one-updater/config.json',base='/var/lib/daw-one-updater';
const run=async(command,args,options={})=>(await exec(command,args,{timeout:15000,maxBuffer:32768,env:{...process.env,LC_ALL:"C"},...options})).stdout;
async function idle(){return canUpdate(await boundedJson(await fetch('http://127.0.0.1:3001/api/state',{signal:AbortSignal.timeout(3000)})));}
export function setEnvironment(text,values){
 let output=text;for(const [key,value] of Object.entries(values)){if(!/^[A-Z_]+$/.test(key)||/[\r\n\0"'\\]/.test(value))throw Error('Invalid configuration value');const line=key+'='+value;const pattern=new RegExp('^'+key+'=.*$','m');output=pattern.test(output)?output.replace(pattern,()=>line):output.trimEnd()+'\n'+line+'\n';}return output;
}
export async function networkStatus(){
 try{
  const raw=await run('/usr/bin/nmcli',['--terse','--escape','no','--fields','DEVICE,TYPE,STATE','device','status']);
  const interfaces=raw.trim().split('\n').map(line=>{const [name,type,state]=line.split(':');return {name,type,state};}).filter(x=>x.type==='wifi'&&/^wl[a-zA-Z0-9_-]{0,20}$/.test(x.name));
  let signal=null,link={};
  try {
    const rows=await run('/usr/bin/nmcli',['--terse','--escape','no','--fields','IN-USE,SIGNAL','device','wifi','list','--rescan','no']);
    const active=rows.split('\n').find(line=>line.startsWith('*:'));
    const value=active&&/^\*:[0-9]{1,3}$/.test(active)?Number(active.split(':')[1]):NaN;
    if(Number.isFinite(value)&&value>=0&&value<=100)signal=value;
  } catch {}
  const activeInterface=interfaces.find(x=>x.state==='connected');if(activeInterface)try{const raw=await run('/usr/sbin/iw',['dev',activeInterface.name,'link']);const speed=raw.match(/tx bitrate:\s*([0-9.]+)\s*MBit\/s/i),dbm=raw.match(/signal:\s*(-?[0-9.]+)\s*dBm/),ssid=raw.match(/SSID: ([^\n]{1,64})/);link={interface:activeInterface.name,linkMbps:speed?Number(speed[1]):null,signalDbm:dbm?Number(dbm[1]):null,ssid:ssid?ssid[1]:null};}catch{}
  return {...link,supported:true,interfaces,connected:interfaces.some(x=>x.state==='connected'),signal,observedAt:Date.now(),simulated:false};
 }catch{return {supported:false,interfaces:[],connected:null};}
}
async function musicProbe(args){
 const token=args.token||existingToken();const client=new MusicAssistantTransport({url:args.url,token});
 try{const info=await client.connect();const players=await client.command('players/all',{}, {maxItems:100});return {serverVersion:info.server_version,players:players.map(p=>({id:p.player_id,name:String(p.name||p.player_id).slice(0,120),available:p.available===true})).slice(0,100)};}catch{throw Error('Music Assistant connection/authentication failed; check the local address and token');}finally{client.close();}
}
function existingToken(){try{return readFileSync('/etc/daw-one/music-assistant.token','utf8').trim();}catch{return '';}}
async function trigger(action){
 if((await run('/usr/bin/systemctl',['is-active','daw-one-update.service']).catch(()=>'' )).trim()==='active'||existsSync(base+'/request.json'))throw Error('Update action already queued or running');
 if(!existsSync('/etc/daw-one-updater/public.pem'))throw Error('No pinned project signing key; configure OTA first');
 atomicJson(base+'/request.json',{action});
 try{await run('/usr/bin/systemctl',['start','--no-block','daw-one-update.service']);}catch{rmSync(base+'/request.json',{force:true});throw Error('Update service unavailable; rerun the OTA installer');}return {queued:true};
}
export function rootAdapter(){const power=powerController({run}),network=networkController({run}),clock=clockController({run}),dsp=dspController({run}),localMa=localMaController({run}),measurement=measurementController({run});return {
 async status(){
  const config=readJson(configPath,{}),installed=readJson(base+'/installed.json',{}),setup=readJson('/var/lib/daw-one-manager/setup.json',{});
  return {managed:true,simulated:false,configured:existsSync('/etc/daw-one-updater/public.pem')&&['preview','stable'].includes(config.channel),channel:config.channel||null,policy:updateSettings(config.policy||{}),current:installed.commit||null,previousAvailable:typeof installed.previous==='string'&&existsSync(installed.previous),setupComplete:setup.complete===true,networkSupported:existsSync('/usr/bin/nmcli'),audioTestSupported:existsSync('/usr/bin/aplay'),progressDisplay:true,appliance:readJson('/var/lib/daw-one-manager/appliance.json',null),powerOffSupported:power.supported(),powerOffQueued:power.queued};
 },
 async perform(command,args){
  if(power.queued)throw Error('Power off already queued');
  if(['dsp-set','local-standby','measurement-apply','measurement-undo','local-ma-install'].includes(command)&&(await measurement.status()).running)throw Error('Stop the room measurement before changing audio hardware or installing a server');
  if(command==='power-off')return power.queue();
  if(command==='policy'){const config=readJson(configPath,{});atomicJson(configPath,{...config,policy:args});return {saved:true,policy:args};}
  if(['check','install','rollback'].includes(command)){
   if(command==='rollback'&&!await idle())throw Error('Stop playback and clear faults before rollback');
   return trigger(command);
  }
  if(command==='measurement-status')return measurement.status();
  if(command==='measurement-start'){if(!await idle())throw Error('Stop playback before the audible room measurement');return measurement.start(args);}
  if(command==='measurement-apply')return measurement.apply(args.target);
  if(command==='measurement-undo')return measurement.undo();
  if(command==='measurement-stop')return measurement.stop();
  if(command==='local-ma-status')return localMa.status();
  if(command==='local-ma-install'){if(!await idle())throw Error('Stop playback before installing a local server');return localMa.install();}
  if(command==='network')return networkStatus();
  if(command==='wifi-scan')return network.scan(args.interface);
  if(command==='hotspot-start'){if(!await idle())throw Error('Stop playback before starting the setup hotspot');return network.hotspot(args);}
  if(command==='hotspot-stop')return network.stop();
  if(command==='clock')return clock.get();
  if(command==='clock-set')return clock.set(args);
  if(command==='dsp')return dsp.get();
  if(command==='local-standby')return dsp.standby(args.enabled);
  if(command==='dsp-set')return dsp.set(args.controls);
  if(command==='erase-setup'){
   if(!await idle())throw Error('Stop playback before erasing setup');if((await measurement.status()).running)throw Error('Stop the room measurement before erasing setup');for(const path of ['/var/lib/daw-one-measurement/status.json','/var/lib/daw-one-measurement/request.json'])rmSync(path,{force:true});
   const previous=existsSync('/etc/daw-one/connection.env')?readFileSync('/etc/daw-one/connection.env','utf8'):'';
   const clean=setEnvironment(previous,{DAW_PLAYBACK_MODE:'simulation',MA_URL:'',MA_TOKEN:'',MA_TOKEN_FILE:'',MA_PLAYER_ID:'',MA_ALLOW_CONTROL:'false'});
   if(existsSync('/etc/daw-one.env'))writeFileSync('/etc/daw-one.env',setEnvironment(readFileSync('/etc/daw-one.env','utf8'),{DAW_PLAYBACK_MODE:'simulation',MA_URL:'',MA_TOKEN:'',MA_TOKEN_FILE:'',MA_PLAYER_ID:'',MA_ALLOW_CONTROL:'false'}),{mode:0o640});
   writeFileSync('/etc/daw-one/connection.env',clean,{mode:0o640});await run('/usr/bin/chown',['root:dawone','/etc/daw-one/connection.env']);rmSync('/etc/daw-one/music-assistant.token',{force:true});
   atomicJson('/var/lib/daw-one-manager/setup.json',{complete:false});setTimeout(()=>run('/usr/bin/systemctl',['restart','--no-block','daw-one.service']).catch(()=>{}),1200);return {erased:true,restarting:true};
  }
  if(command==='wifi'){
   if(!await idle())throw Error('Stop playback before changing Wi-Fi');return network.connect(args);
  }
  if(command==='probe-music')return musicProbe(args);
  if(command==='save-music'){
   if(!await idle())throw Error('Stop playback before changing the Music Assistant connection');
   const result=await musicProbe(args);if(!result.players.some(p=>p.id===args.playerId&&p.available))throw Error('Select an available Music Assistant player');
   // Credentials are stored only in the root-managed file, never returned to the browser.
   if(args.token){writeFileSync('/etc/daw-one/music-assistant.token.tmp',args.token+'\n',{mode:0o640});await run('/usr/bin/chown',['root:dawone','/etc/daw-one/music-assistant.token.tmp']);renameSync('/etc/daw-one/music-assistant.token.tmp','/etc/daw-one/music-assistant.token');}
   const token=existingToken();
   const previous=existsSync('/etc/daw-one/connection.env')?readFileSync('/etc/daw-one/connection.env','utf8'):'';
   const value=setEnvironment(previous,{DAW_PLAYBACK_MODE:'music-assistant',MA_URL:args.url,MA_TOKEN_FILE:token?'/etc/daw-one/music-assistant.token':'',MA_PLAYER_ID:args.playerId,MA_ALLOW_CONTROL:String(args.allowControl),MA_VOLUME_LIMIT:'40'});
   writeFileSync('/etc/daw-one/connection.env.tmp',value,{mode:0o640});await run('/usr/bin/chown',['root:dawone','/etc/daw-one/connection.env.tmp']);renameSync('/etc/daw-one/connection.env.tmp','/etc/daw-one/connection.env');
   setTimeout(()=>run('/usr/bin/systemctl',['restart','--no-block','daw-one.service']).catch(()=>{}),750);
   return {saved:true,restarting:true};
  }
  if(command==='audio-test'){
   if(!await idle())throw Error('Stop playback before the headphone test');
   const devices=await run('/usr/bin/aplay',['-L']);if(!devices.includes('CARD=Headphones')||!(/bcm2835.*Headphones/i.test(readFileSync('/proc/asound/cards','utf8'))))throw Error('Pi headphone output not detected; HAT outputs are blocked');
   await run('/usr/sbin/runuser',['-u','dawaudiotest','--','/usr/bin/aplay','-q','-D',args.device,'/usr/share/sounds/alsa/Front_Center.wav'],{timeout:7000}).catch(()=>{throw Error('Headphone test failed or output is busy; Squeezelite was not stopped');});
   return {played:true,simulated:false};
  }
  if(command==='complete-setup'){atomicJson('/var/lib/daw-one-manager/setup.json',{complete:true,completedAt:new Date().toISOString()});return {saved:true};}
  throw Error('Unsupported action');
 }
};}
