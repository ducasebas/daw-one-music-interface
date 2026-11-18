import {powerMonitoring,powerResponse} from './power-telemetry.mjs';
import {initializeStartingSound} from './starting-sound.mjs';
import {playbackHardwareIdle} from './audio-idle.mjs';
import {existsSync,readFileSync,writeFileSync,renameSync,chmodSync,rmSync} from 'node:fs';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {updateSettings} from '../../shared/update-settings.js';
import {canUpdate} from '../ota/policy.mjs';
import {AutomaticDsp} from './automatic-dsp.mjs';
import {syncController} from './sync.mjs';
import {MusicAssistantTransport} from '../../server/ma-transport.js';
import {atomicJson,readJson,boundedJson} from './io.mjs';
import {powerController} from './power.mjs';
import {networkController,networkStatus as readNetworkStatus,assertConnectionChange} from './network.mjs';
import {clockController} from './clock.mjs';
import {measurementController} from './measurement.mjs';
import {localMaController} from './local-ma.mjs';
import {dspController} from './dsp.mjs';
import {environmentValue,musicToken} from './music-credentials.mjs';
import {bluetoothController} from './bluetooth.mjs';
import {withUpdateLock} from './update-lock.mjs';
const exec=promisify(execFile);
const configPath='/etc/daw-one-updater/config.json',base='/var/lib/daw-one-updater';
const run=async(command,args,options={})=>(await exec(command,args,{timeout:15000,maxBuffer:32768,env:{...process.env,LC_ALL:"C"},...options})).stdout;
async function idle(){return canUpdate(await boundedJson(await fetch('http://127.0.0.1:3001/api/state',{signal:AbortSignal.timeout(3000)})));}
export function setEnvironment(text,values){
 let output=text;for(const [key,value] of Object.entries(values)){if(!/^[A-Z_]+$/.test(key)||/[\r\n\0"'\\]/.test(value))throw Error('Invalid configuration value');const line=key+'='+value;const pattern=new RegExp('^'+key+'=.*$','m');output=pattern.test(output)?output.replace(pattern,()=>line):output.trimEnd()+'\n'+line+'\n';}return output;
}
export async function networkStatus(){return readNetworkStatus({run});}
async function connectionChange(args,kind='network'){const state=await boundedJson(await fetch('http://127.0.0.1:3001/api/state',{signal:AbortSignal.timeout(3000)}));assertConnectionChange(state,{confirmed:args.confirmed===true,kind});}
async function musicProbe(args){
 const token=connectionToken(args);const client=new MusicAssistantTransport({url:args.url,token});
 try{const info=await client.connect();const players=await client.command('players/all',{}, {maxItems:100});return {serverVersion:info.server_version,players:players.map(p=>({id:p.player_id,name:String(p.name||p.player_id).slice(0,120),available:p.available===true})).slice(0,100)};}catch{throw Error('Music Assistant connection/authentication failed; check the local address and token');}finally{client.close();}
}
function existingToken(){try{return readFileSync('/etc/daw-one/music-assistant.token','utf8').trim();}catch{return '';}}
function connectionToken(args){let text='';for(const path of ['/etc/daw-one.env','/etc/daw-one/connection.env']){try{text+='\n'+readFileSync(path,'utf8');}catch{}}return musicToken({...args,currentUrl:environmentValue(text,'MA_URL'),storedToken:existingToken()});}
async function trigger(action){
 if((await run('/usr/bin/systemctl',['is-active','daw-one-update.service']).catch(()=>'' )).trim()==='active'||existsSync(base+'/request.json'))throw Error('Update action already queued or running');
 if(!existsSync('/etc/daw-one-updater/public.pem'))throw Error('No pinned project signing key; configure OTA first');
 atomicJson(base+'/request.json',{action});
 try{await run('/usr/bin/systemctl',['start','--no-block','daw-one-update.service']);}catch{rmSync(base+'/request.json',{force:true});throw Error('Update service unavailable; rerun the OTA installer');}return {queued:true};
}
export function rootAdapter(){const powerReader=powerMonitoring({run,context:()=>localState(),hardwareIdle:playbackHardwareIdle});const power=powerController({run}),network=networkController({run}),clock=clockController({run}),dsp=dspController({run}),localMa=localMaController({run}),measurement=measurementController({run}),bluetooth=bluetoothController({run});
 const localState=async()=>boundedJson(await fetch('http://127.0.0.1:3001/api/state',{signal:AbortSignal.timeout(3000)}));
 const automatic=new AutomaticDsp({dsp,context:async()=>{const s=await localState();return {ready:s.device?.mode==='ready'&&!s.device?.faults?.length&&!s.activity?.roomMeasurement&&!s.activity?.syncCalibration&&!s.activity?.roomControl&&!existsSync('/var/lib/daw-one-manager/standby.json')&&(s.bluetooth?.active||s.mode!=='music-assistant'||s.localAudio?.available===true),playing:s.localAudio?.playing===true,selectedLocal:s.localAudio?.ready===true,bluetooth:s.bluetooth?.active===true,trackKey:s.localAudio?.trackKey||null,genres:s.localAudio?.genres||[]};}});
 atomicJson('/run/daw-one-dsp/status.json',automatic.publicStatus(),0o644);
 const sync=syncController({run,context:async()=>boundedJson(await fetch('http://127.0.0.1:3001/api/sync/context',{signal:AbortSignal.timeout(3000)}))});
 const adapter={
 async status(){
  const config=readJson(configPath,{}),installed=readJson(base+'/installed.json',{}),setup=readJson('/var/lib/daw-one-manager/setup.json',{});
  return {powerMonitoring:powerResponse(powerReader.status()),automaticDsp:automatic.publicStatus(),managed:true,simulated:false,configured:existsSync('/etc/daw-one-updater/public.pem')&&['preview','stable'].includes(config.channel),channel:config.channel||null,policy:updateSettings(config.policy||{}),current:installed.commit||null,previousAvailable:typeof installed.previous==='string'&&existsSync(installed.previous),setupComplete:setup.complete===true,networkSupported:existsSync('/usr/bin/nmcli'),audioTestSupported:existsSync('/usr/bin/aplay'),progressDisplay:true,appliance:readJson('/var/lib/daw-one-manager/appliance.json',null),powerOffSupported:power.supported(),powerOffQueued:power.queued};
 },
 async perform(command,args){
  if(power.queued)throw Error('Power off already queued');
  if(command==='power-status')return powerResponse(powerReader.status());
  if(command==='power-config')return powerResponse(await powerReader.configure(args.settings));
  if(command==='power-request-100w'){if(bluetooth.active()||(await measurement.status()).running||(await sync.status()).running)throw Error('Finish other audio activity before the 100 W setup');return powerResponse(await powerReader.request100W(args));}
  if(command==='rollback'&&automatic.state.settings.enabled)throw Error('Switch automatic sound to Manual before rolling back');
  if(command==='sync-status')return sync.status();
  if(command==='sync-stop')return sync.stop();
  if(command==='sync-start'){if(bluetooth.active()||(await measurement.status()).running)throw Error('Finish other audio activity before synchronization');return sync.start(args);}
  if(command==='dsp-initialize')return initializeStartingSound({dsp,preference:(await localState()).preferences?.speakers?.voicing,blocked:automatic.state.settings.enabled||existsSync('/var/lib/daw-one-manager/standby.json')||(await sync.status()).running||(await measurement.status()).running});
  if(command==='dsp-auto-status')return automatic.status();
  if(command==='dsp-auto-config'){if((await sync.status()).running||(await measurement.status()).running)throw Error('Finish microphone capture before changing automatic sound');const value=await automatic.configure(args.settings);if(!args.settings.enabled&&!existsSync('/var/lib/daw-one-manager/starting-sound.json'))atomicJson('/var/lib/daw-one-manager/starting-sound.json',{status:'manual-selected',at:new Date().toISOString()});return value;}
  if(command==='dsp-auto-update'){if((await sync.status()).running||(await measurement.status()).running)return {...automatic.publicStatus(),deferred:true};return automatic.update();}
  if(['dsp-set','measurement-start','measurement-apply','measurement-undo'].includes(command)&&automatic.state.settings.enabled)throw Error('Switch automatic sound to Manual before changing the baseline or measuring the room');
  if(['dsp-set','measurement-start','measurement-apply','measurement-undo','bluetooth-start','save-music','erase-setup'].includes(command)&&(await sync.status()).running)throw Error('Finish synchronization before changing the audio path');
  if(bluetooth.active()&&['dsp-set','local-standby','measurement-start','measurement-apply','measurement-undo','save-music','erase-setup'].includes(command))throw Error('Switch back to Music Assistant before changing this audio setup');
  if(['dsp-set','local-standby','measurement-apply','measurement-undo','local-ma-install'].includes(command)&&(await measurement.status()).running)throw Error('Stop the room measurement before changing audio hardware or installing a server');
  if(command==='power-off'){if((await sync.status()).running)await sync.stop();if(bluetooth.active())await bluetooth.stop({restartPlayers:false});return power.queue();}
  if(command.startsWith('bluetooth-')){
   if((await measurement.status()).running)throw Error('Finish the microphone measurement before switching sources');
   if(command==='bluetooth-stop')return bluetooth.stop();
   if(command==='bluetooth-pair')return bluetooth.pair();
   if(command==='bluetooth-close-pairing'){await bluetooth.closePairing();return {closed:true};}
   if(command==='bluetooth-confirm')return bluetooth.confirm(args);
   if(command==='bluetooth-forget')return bluetooth.device('forget',args.address);
   if(command==='bluetooth-disconnect')return bluetooth.device('disconnect',args.address);
   const state=await localState(),limit=state.musicAssistant?.volumeLimit??(state.preferences?.prefs?.volumeLimitConfigured===true?state.preferences.maxVolume:Math.min(40,state.preferences?.maxVolume??40));
   if(!Number.isInteger(limit)||limit<0||limit>100)throw Error('Read the saved TuneBox volume limit first');
   if(command==='bluetooth-volume')return bluetooth.volume(args.value,limit,args.sessionId);
   if(command==='bluetooth-start'){if(!canUpdate(state)||(state.mode==='music-assistant'?state.activity?.localIndependent!==true||state.activity?.localSelected!==true:!playbackHardwareIdle()))throw Error('Pause the local output and leave its group before switching sources. Without Music Assistant, the ALSA output must be idle.');return bluetooth.start(limit);}
  }
  if(command==='policy'){const config=readJson(configPath,{});atomicJson(configPath,{...config,policy:args});return {saved:true,policy:args};}
  if(['check','install','rollback'].includes(command)){
   if(command==='rollback'&&!await idle())throw Error('Stop playback and clear faults before rollback');
   return trigger(command);
  }
  if(command==='measurement-status')return measurement.status();
  if(command==='measurement-start'){const state=await boundedJson(await fetch('http://127.0.0.1:3001/api/state',{signal:AbortSignal.timeout(3000)}));if(!canUpdate(state)||state.activity?.localIndependent!==true)throw Error('Pause playback and remove TuneBox from its group before the audible room measurement');return measurement.start(args);}
  if(command==='measurement-apply')return measurement.apply(args.target);
  if(command==='measurement-undo')return measurement.undo();
  if(command==='measurement-stop')return measurement.stop();
  if(command==='local-ma-status')return localMa.status();
  if(command==='local-ma-install'){if(!await idle())throw Error('Stop playback before installing a local server');return localMa.install();}
  if(command==='network')return networkStatus();
  if(command==='wifi-scan')return network.scan(args.interface);
  if(command==='hotspot-start'){await connectionChange(args);return network.hotspot(args);}
  if(command==='hotspot-stop')return network.stop();
  if(command==='clock')return clock.get();
  if(command==='clock-set')return clock.set(args);
  if(command==='dsp')return dsp.get();
  if(command==='local-standby')return dsp.standby(args.enabled);
  if(command==='dsp-set')return dsp.set(args.controls);
  if(command==='erase-setup'){
   if(!await idle())throw Error('Stop playback before erasing setup');if((await measurement.status()).running)throw Error('Stop the room measurement before erasing setup');if(automatic.state.settings.enabled)await automatic.configure({...automatic.state.settings,enabled:false});for(const path of ['/var/lib/daw-one-measurement/status.json','/var/lib/daw-one-measurement/request.json','/var/lib/daw-one-measurement/baseline.json'])rmSync(path,{force:true});
   const previous=existsSync('/etc/daw-one/connection.env')?readFileSync('/etc/daw-one/connection.env','utf8'):'';
   const clean=setEnvironment(previous,{DAW_PLAYBACK_MODE:'simulation',MA_URL:'',MA_TOKEN:'',MA_TOKEN_FILE:'',MA_PLAYER_ID:'',MA_ALLOW_CONTROL:'false'});
   if(existsSync('/etc/daw-one.env'))writeFileSync('/etc/daw-one.env',setEnvironment(readFileSync('/etc/daw-one.env','utf8'),{DAW_PLAYBACK_MODE:'simulation',MA_URL:'',MA_TOKEN:'',MA_TOKEN_FILE:'',MA_PLAYER_ID:'',MA_ALLOW_CONTROL:'false'}),{mode:0o640});
   writeFileSync('/etc/daw-one/connection.env',clean,{mode:0o640});await run('/usr/bin/chown',['root:dawone','/etc/daw-one/connection.env']);rmSync('/etc/daw-one/music-assistant.token',{force:true});
   rmSync('/var/lib/daw-one-manager/starting-sound.json',{force:true});atomicJson('/var/lib/daw-one-manager/setup.json',{complete:false});setTimeout(()=>run('/usr/bin/systemctl',['restart','--no-block','daw-one.service']).catch(()=>{}),1200);return {erased:true,restarting:true};
  }
  if(command==='wifi'){
   await connectionChange(args);return network.connect(args);
  }
  if(command==='probe-music')return musicProbe(args);
  if(command==='save-music'){
   await connectionChange(args,'music');
   const result=await musicProbe(args);if(!result.players.some(p=>p.id===args.playerId&&p.available))throw Error('Select an available Music Assistant player');
   // Credentials are stored only in the root-managed file, never returned to the browser.
   const token=connectionToken(args);
   if(token){writeFileSync('/etc/daw-one/music-assistant.token.tmp',token+'\n',{mode:0o640});await run('/usr/bin/chown',['root:dawcontrol','/etc/daw-one/music-assistant.token.tmp']);chmodSync('/etc/daw-one/music-assistant.token.tmp',0o640);renameSync('/etc/daw-one/music-assistant.token.tmp','/etc/daw-one/music-assistant.token');}else rmSync('/etc/daw-one/music-assistant.token',{force:true});
   const previous=existsSync('/etc/daw-one/connection.env')?readFileSync('/etc/daw-one/connection.env','utf8'):'';
   const value=setEnvironment(previous,{DAW_PLAYBACK_MODE:'music-assistant',MA_URL:args.url,MA_TOKEN:'',MA_TOKEN_FILE:token?'/etc/daw-one/music-assistant.token':'',MA_PLAYER_ID:args.playerId,MA_ALLOW_CONTROL:String(args.allowControl),MA_VOLUME_LIMIT:'40'});
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
};return {status:()=>adapter.status(),perform:(command,args)=>['power-config','power-request-100w','bluetooth-start','measurement-start','sync-start','dsp-initialize','dsp-auto-config','dsp-auto-update'].includes(command)?withUpdateLock(()=>adapter.perform(command,args)):adapter.perform(command,args)};}
