import {settingsAttention} from '../shared/interface.js';
import {LocalAudio} from './local-audio.js';
import {screenOffDue} from '../shared/screen-off.js';
import {RestPhoto,restPhotoLimits} from './rest-photo.js';
import {nextPowerHistory,powerDrop} from '../shared/power-history.js';
import {SyncProfiles,synchronizationContext,playbackRoute} from './sync-profiles.js';
import {AutomaticSound} from './automatic-sound.js';
import {AudioAnalysis} from "./audio-analysis.js";
import { DisplayStore } from './display-store.js';
import { VideoLibrary } from './video-library.js';
import {YoutubeService} from './youtube-service.js';
import {requestPolicy,applianceCsp} from './request-policy.js';
import {bluetoothState} from './bluetooth-state.js';
import { readFileSync, writeFileSync, renameSync,existsSync,rmSync } from 'node:fs';
import {join} from 'node:path';
import {PresencePolicy} from './presence.js';
import {PreferencesStore} from './preferences-store.js';
import {HostTelemetry} from './host-telemetry.js';
import {DebugLog} from './debug-log.js';
import {roomProfile,roomDefaults} from '../shared/room-measurement.js';
import {DeviceSecurity} from './security.js';
import {prepareMeasurement} from './measurement-prepare.js';
import {readPlayerStartupBlock} from './player-block.js';
import {RemoteAccess,remoteAddress,remoteView,remoteEvent,remoteQueueOptions} from './remote-control.js';
import {createServer} from 'node:http';
import {finished} from 'node:stream/promises';
import {timingSafeEqual,randomUUID} from 'node:crypto';
import {deviceRequest,controlToken,validDeviceRequest} from "./device-client.js";
import {simulatedDevice} from "./simulated-device.js";
import {updateStatus, deploymentCommit} from "./update-status.js";
import {ManualUpdate} from './manual-update.js';
import { MusicLibrary } from "./music-library.js";
import { ArtworkCache } from "./artwork.js";
import { readSensorTelemetry } from "./sensor-telemetry.js";
import { BootStore } from "./boot-store.js";
import { bootInventory } from "./boot-inventory.js";
import { bootReport, BootMonitor } from "../shared/boot.js";
import { release } from "../shared/release.js";
import { snapshotWriter } from "./event-stream.js";
import express from "express";
import { fileURLToPath } from "node:url";
import { DeviceRuntime, runScenario, scenarios } from "../shared/runtime.js";
import { musicConfig } from "./ma-config.js";
import { LiveMusicService } from "./ma-service.js";
import {MultiroomService} from './multiroom.js';
import {savedVolumeLimit} from '../shared/volume.js';
const startupStore = new BootStore(
  process.env.DAW_STATE_DIR || ".tunebox-state",
);
const liveBootMonitor = new BootMonitor();
const displayStore = new DisplayStore(process.env.DAW_STATE_DIR || '.tunebox-state');
const videos = new VideoLibrary(process.env.DAW_STATE_DIR || '.tunebox-state');
let displayConfiguration = displayStore.load();
const stateDirectory=process.env.DAW_STATE_DIR||'.tunebox-state';
let previousAudio=false;try{previousAudio=JSON.parse(readFileSync(join(stateDirectory,'audio-analysis.json'),'utf8')).enabled===true;}catch{}
const preferences=new PreferencesStore(stateDirectory,{display:displayConfiguration,audioEnabled:previousAudio});
const security=new DeviceSecurity(stateDirectory);
const remote=new RemoteAccess(stateDirectory);
const restPhoto=new RestPhoto(stateDirectory);
// Highest PD contract read on this TuneBox; a later lower contract gets an explanation (read-only, never requests power).
const powerHistoryPath=join(stateDirectory,'power-history.json');
let powerHistory=(()=>{try{return JSON.parse(readFileSync(powerHistoryPath,'utf8'));}catch{return {};}})();
const updatePowerHistory=(now=Date.now())=>{const next=nextPowerHistory(powerHistory,host.value.power,now);if(next.highestWatts!==powerHistory.highestWatts){try{writeFileSync(powerHistoryPath+'.tmp',JSON.stringify({...next,lowerSince:null})+'\n',{mode:0o600});renameSync(powerHistoryPath+'.tmp',powerHistoryPath);}catch{}}powerHistory=next;};
const host=new HostTelemetry();
const debug=new DebugLog(stateDirectory);
const presence=new PresencePolicy(process.env.DAW_PRESENCE_FILE);
displayConfiguration=preferences.get().display;
let inventory = bootInventory();
const config = musicConfig(),
  app = express(),
  runtime = new DeviceRuntime(Date.now(), startupStore.load()),
  clients = new Set();
runtime.displayTimeoutMs = displayConfiguration.timeoutSeconds === 0 ? Infinity : displayConfiguration.timeoutSeconds * 1000;
const music =
  config.mode === "music-assistant" ? new LiveMusicService(config) : null;
if(music)music.setVolumeLimit(savedVolumeLimit(preferences.get(),music.defaultVolumeLimit));
music?.wantKeepPlaying(preferences.get().prefs?.keepPlaying!==false);
const audioAnalysis=new AudioAnalysis({onStatus:status=>{runtime.record(Date.now(),"audio-analysis",runtime.device.mode,"Local PCM measurement: "+status);broadcast();}});
const multiroom = new MultiroomService(music,{localId:audioAnalysis.playerId||config.playerId});
const library = music ? new MusicLibrary(music) : null;
const localAudio=new LocalAudio(music,multiroom,{onChange:()=>{automaticSound.schedule();broadcast();}});
const youtube = new YoutubeService(music,stateDirectory);
const artwork = music ? new ArtworkCache(config) : null;
runtime.dispatch({ type: "boot-complete" });
let buttonWakeId=null,videoRevision=0;
const syncProfiles=new SyncProfiles(stateDirectory);
const publicAutomaticDsp=()=>{try{const raw=readFileSync('/run/daw-one-dsp/status.json','utf8');return raw.length<16384?JSON.parse(raw):{};}catch{return {};}};
const synchronizationRunning=()=>{try{const s=JSON.parse(readFileSync('/var/lib/daw-one-sync/status.json','utf8'));return ['queued','measuring','analysing'].includes(s.phase)&&Number.isFinite(s.observedAt)&&Math.abs(Date.now()-s.observedAt)<35000;}catch{return false;}};
let routeCache={at:0,value:null};
function syncContext(){
 if(performance.now()-routeCache.at>500||!routeCache.at)routeCache={at:performance.now(),value:playbackRoute()};
 const rooms=multiroom.status(),audio=audioAnalysis.get({selectedId:music?.playerId});
 return synchronizationContext({rooms,playback:music?.playback,audio,route:routeCache.value,connected:music?.status==='connected',bluetooth:bluetoothState().active,busy:multiroom.busy||music?.controlBusy===true});
}
let localStandby=false,localVolume={level:100,active:false};
const snapshot = () => {
  const bluetooth=bluetoothState();
  const profileCount=syncProfiles.profiles.length,context=profileCount?syncContext():null;
  let roomMeasurement=false;try{const value=JSON.parse(readFileSync('/var/lib/daw-one-measurement/status.json','utf8'));roomMeasurement=['queued','measuring-left','measuring-right','analysing'].includes(value.phase)&&Number.isFinite(value.observedAt)&&Math.abs(Date.now()-value.observedAt)<90000;}catch{}
  const state = {
    ...runtime.snapshot(),
    screenOff,
    restPhoto:restPhoto.status(),
    powerHistory:{highestWatts:powerHistory.highestWatts??null,highestAt:powerHistory.highestAt??null,drop:powerDrop(powerHistory,host.value.power)},
    build: release,
    automaticDsp:publicAutomaticDsp(),
    localAudio:localAudio.get(),
    sync:{active:syncProfiles.active(context),profiles:profileCount,context:context?.key||null},
    navigation:{buttonWakeId},
    youtube:youtube.get(),
    bluetooth,
    remoteControl:{phones:remote.phones.length,pairing:remote.pairing(),pinRequired:remotePinRequired()},
    localControl:{standby:localStandby,level:localVolume.level,lowered:localVolume.active,needed:!!music&&music.status!=='connected'},
    playerBlocked:music?readPlayerStartupBlock(music.status==='connected'?(music.players||[]).some(p=>p.player_id===multiroom.localId):music.errorCode==='player-missing'?false:null):null,
    videoRevision,
    hardwareTelemetry: readSensorTelemetry(process.env.DAW_SENSOR_FILE),
    hostTelemetry:host.value,
    activity:{syncCalibration:synchronizationRunning(),roomMeasurement,roomControl:multiroom.busy||music?.controlBusy===true,localPlayback:multiroom.localPlayback(),localIndependent:multiroom.localIndependent(),localSelected:music?.playerId===multiroom.localId,bluetoothActive:bluetooth.active},
    displaySettings: displayConfiguration,
    preferences:preferences.get(),
    setupStatus:{roomProfile:existsSync(join(stateDirectory,'room-profile.json')),audioConfigured:audioAnalysis.configured},
    presenceTelemetry:presence.value,
    onboardingRequired:existsSync(join(stateDirectory,'first-start'))&&!preferences.get().setupCompleted,
  };
  if (music)
    return {
      ...state,
      mode: "music-assistant",
      hardwareMode: "simulation",
      boot: {
        ...liveBootMonitor.update(
          bootReport({
            simulated: false,
            device: state.device,
            inventory,
            music: music.publicStatus(),
            playback: music.playback,
          }),
          runtime.record.bind(runtime),
          Date.now(),
        ),
        settings: runtime.startupSettings,
        radioStatus: runtime.startupSettings.radioEnabled
          ? "blocked-live-adapter"
          : "disabled",
      },
      device: { ...state.device, verified: false, amplifierEnabled: false },
      playback: music.playback,
      musicAssistant: music.publicStatus(),
    };
  return {
    ...state,
    musicAssistant: {
      mode: "simulation",
      connected: false,
      controlEnabled: false,
      players: [],
    },
  };
};
const streamWriter = snapshotWriter();
const remoteWriter=snapshotWriter(),remoteClients=new Set();let lastRemoteView='';
let screenOff=false;
const updateScreenOff=(now=Date.now())=>{const next=screenOffDue({display:displayConfiguration,displayAwake:runtime.device.displayAwake,idleMs:now-runtime.lastActivity,playing:(music?.playback||runtime.playback)?.playing===true||bluetoothState().active});if(next===screenOff)return false;screenOff=next;runtime.record(now,next?'screen-off':'screen-on',runtime.device.mode,next?'Screen preservation: backlight off after inactivity; music unchanged':'Screen preservation ended');return true;};
const publishDisplay=()=>{try{const path='/run/daw-one-display/activity.json';writeFileSync(path+'.tmp',JSON.stringify({awake:runtime.device.displayAwake,screenOff,mode:runtime.device.mode,observedAt:Date.now()})+'\n',{mode:0o660});renameSync(path+'.tmp',path);}catch{}};
const broadcast = () => {
  updateScreenOff();
  publishDisplay();
  const body = `data: ${JSON.stringify(snapshot())}\n\n`;
  for (const client of clients) streamWriter.write(client, body);
  if(remoteClients.size){const view=JSON.stringify(phoneView());if(view!==lastRemoteView){lastRemoteView=view;for(const client of remoteClients)remoteWriter.write(client,`data: ${view}\n\n`);}}
};
music?.on("change", broadcast);
music?.start();
app.use(requestPolicy);
// The phone remote listener serves the app shell, static assets and a small API allowlist.
app.use((q,r,next)=>{
 if(!q.remote)return next();
 if(q.path.startsWith('/docs'))return r.sendStatus(404);
 if(q.method==='GET'&&(q.path==='/'||q.path==='/index.html'))return r.redirect(302,'/remote.html');
 next();
});
app.use('/api/preferences',express.json({limit:'64kb'}));
app.use(express.json({ limit: "8kb" }));
app.disable('x-powered-by');
app.use((_q,r,next)=>{r.set('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), hid=(), display-capture=(), fullscreen=()');r.set('Referrer-Policy','same-origin');r.set('X-Content-Type-Options','nosniff');r.set('X-Frame-Options','SAMEORIGIN');if(process.env.NODE_ENV==='production')r.set('Content-Security-Policy',applianceCsp);next();});
let phoneServer=null;
const provisionCommands=['network','wifi-scan','wifi','hotspot-stop'];
app.use('/api',(q,r,next)=>{
 try{
  const mutating=!['GET','HEAD','OPTIONS'].includes(q.method),path=q.path;
  if(q.remote){
   const open=q.method==='GET'&&path==='/remote/session'||q.method==='POST'&&path==='/remote/pair';
   const paired=q.method==='GET'&&(['/remote/state','/remote/events','/remote/search'].includes(path)||/^\/artwork\/[^/]+$/.test(path))||q.method==='POST'&&['/remote/event','/remote/play','/remote/leave','/remote/invite','/remote/rest-photo'].includes(path);
   if(!open&&!paired)return r.status(403).json({error:'This remote can only control playback'});
   if(paired&&!remote.phone(q))return r.status(401).json({error:'Scan the remote code shown on TuneBox'});
   return next();
  }
  if(path.startsWith('/remote/')&&!['/remote/pairing','/remote/party','/remote/forget'].includes(path)&&!(q.method==='GET'&&path==='/remote/phones'))return r.status(404).json({error:'Not found'});
  if(q.provisioning){
   const allowed=q.method==='GET'&&['/updates','/network','/security/status'].includes(path)||q.method==='POST'&&(path==='/setup/pair'||path==='/device'&&provisionCommands.includes(q.body?.command));
   if(!allowed)return r.status(403).json({error:'This setup connection only controls Wi-Fi'});
   if(mutating&&path!=='/setup/pair'&&security.session(q)?.role!=='provision')return r.status(423).json({error:'Scan the setup link shown on the TuneBox'});
  }
   const admin=mutating&&(['/remote/pairing','/remote/forget','/rest-photo','/device','/preferences','/music/keep-playing/check','/reset','/display','/audio/settings','/video','/video/upload','/video/timing','/video/youtube','/youtube/settings','/boot/settings','/debug','/measurement/profile'].includes(path)||path==='/rooms'&&['group','leave','transfer','join'].includes(q.body?.action)||path==='/event'&&!['play','pause','next','previous','seek','volume','mute','queue-select','queue-remove','activity','display-timeout'].includes(q.body?.type));
  if(admin&&!(q.provisioning&&path==='/device'&&provisionCommands.includes(q.body?.command)))security.requireAdmin(q);
  next();
 }catch(e){r.status(e.status||423).json({error:e.message});}
});
// GUI 3.13 OFFLINE: when Music Assistant is unreachable, pause (local amplifier standby) and
// volume (amplifier gains, never above the level when local control began) still work here.
app.post('/api/local',async(q,r)=>{
 if(!validDeviceRequest(q))return r.status(403).json({error:'Reload TuneBox before using local controls.'});
 const action=q.body?.action;
 try{
  if(!['pause','resume','quieter','louder','restore'].includes(action)||Object.keys(q.body).length!==1)throw Error('Choose pause, resume, quieter, louder or restore');
  const away=!!music&&music.status!=='connected';
  if(['pause','quieter','louder'].includes(action)&&!away)throw Error('Music Assistant is connected: use the normal controls.');
  if(action==='pause'||action==='resume'){const state=await manage({command:'local-standby',args:{enabled:action==='pause'}});localStandby=state.muted===true;}
  else{const state=await manage({command:'local-volume',args:{step:action==='quieter'?-1:action==='louder'?1:0}});localVolume={level:Number.isInteger(state.level)?state.level:100,active:state.active===true};}
  broadcast();r.set('Cache-Control','no-store').json(snapshot());
 }catch(e){r.status(409).json({error:e.message});}
});
app.post('/api/button',async(q,r)=>{
 try{let token;try{token=readFileSync(process.env.DAW_BUTTON_TOKEN_FILE||'/run/daw-one-button/token','utf8').trim();}catch{return r.sendStatus(403);}const given=q.get('X-TuneBox-Button')||'';if(!/^[a-f0-9]{64}$/.test(token)||Buffer.byteLength(token)!==Buffer.byteLength(given)||!timingSafeEqual(Buffer.from(token),Buffer.from(given)))return r.sendStatus(403);
 if(q.body.type==='long'){await manage({command:'power-off',args:{confirmed:true}});return r.json({queued:true});}
 if(q.body.type!=='short')throw Error('Unsupported button event');
 if(runtime.device.displayAwake===false){
  if(localStandby){const state=await manage({command:'local-standby',args:{enabled:false}});localStandby=state.muted;}
  runtime.dispatch({type:'activity'});buttonWakeId=randomUUID();
 }else if(preferences.get().buttonAction==='local-standby'){const state=await manage({command:'local-standby',args:{enabled:true}});localStandby=state.muted;runtime.device={...runtime.device,displayAwake:!localStandby};}else runtime.dispatch({type:'display-timeout'});
 broadcast();r.json({ok:true,standby:localStandby});}catch(e){r.status(409).json({error:e.message});}
});
app.get('/api/security/status',(q,r)=>r.set('Cache-Control','no-store').json(security.status(q)));
app.post('/api/security/:action',(q,r)=>{
 if(!validDeviceRequest(q))return r.status(403).json({error:'Reload before changing security settings'});
 try{const action=q.params.action;let value;if(action==='unlock')value=security.unlock(q.body.pin,q,r);else if(action==='set-pin')value=security.setPin(q.body.pin,q.body.confirmation,q,r);else if(action==='lock'){security.lock(q,r);value=security.status(q);}else if(action==='disable'){security.requireAdmin(q);security.clear(q,r);value=security.status(q);}else throw Error('Unknown security action');r.set('Cache-Control','no-store').json(value);}catch(e){r.status(e.status||400).json({error:e.message});}
});
// Dismissing onboarding changes presentation only; it must not trap a locked user.
// A provision-only phone session cannot reach this route (see the API whitelist).
app.post('/api/setup/defer',(q,r)=>{
 if(!validDeviceRequest(q))return r.status(403).json({error:'Reload setup before continuing'});
 if(!q.body||Array.isArray(q.body)||Object.keys(q.body).length)return r.status(400).json({error:'Unexpected setup argument'});
 const current=preferences.get();if(!current.setupDeferred)preferences.save(current.revision,{setupDeferred:true});
 broadcast();r.json({deferred:true});
});
app.post('/api/setup/pair',(q,r)=>{if(!validDeviceRequest(q))return r.status(403).json({error:'Reload setup'});try{r.json(security.pair(q.body.token,r));}catch(e){r.status(403).json({error:e.message});}});
function applyPreferences(value){if(value.audioEnabled!==audioAnalysis.enabled)audioAnalysis.setEnabled(value.audioEnabled);if(music)music.setVolumeLimit(savedVolumeLimit(value,music.defaultVolumeLimit));music?.wantKeepPlaying?.(value.prefs?.keepPlaying!==false);displayConfiguration=value.display;runtime.displayTimeoutMs=value.display.timeoutSeconds===0?Infinity:value.display.timeoutSeconds*1000;broadcast();}
app.get('/api/preferences',(_q,r)=>r.set('Cache-Control','no-store').json(preferences.get()));
app.post('/api/music/keep-playing/check',async(q,r)=>{if(!validDeviceRequest(q))return r.status(403).json({error:'Reload TuneBox before checking.'});try{r.set('Cache-Control','no-store').json(music?await music.checkKeepPlaying():{ok:false,reason:'no-music'});}catch{r.status(502).json({ok:false,reason:'check-failed'});}});
app.post('/api/preferences',(q,r)=>{
 if(!validDeviceRequest(q))return r.status(403).json({error:'Reload before saving settings'});
 try{if(Object.keys(q.body||{}).some(k=>!['revision','patch'].includes(k)))throw Error('Invalid settings request');if(q.body.patch?.audioEnabled===true&&!audioAnalysis.configured)throw Error('Install the PCM reader before enabling measurement');const value=preferences.save(q.body.revision,q.body.patch);applyPreferences(value);r.json({settings:value,snapshot:snapshot()});}catch(e){r.status(e.status||400).json({error:e.message});}
});
const simulatedManager=process.env.NODE_ENV!=="production"&&config.mode==="simulation"&&!process.env.DAW_MANAGER_SOCKET?simulatedDevice({snapshot,directory:process.env.DAW_STATE_DIR||".tunebox-state",onEvent:phase=>runtime.record(Date.now(),"software-update",runtime.device.mode,"Simulated update: "+phase)}):null;
const manage=request=>simulatedManager?simulatedManager.request(request):deviceRequest(request);
const systemReport=()=>({schema:1,generatedAt:new Date().toISOString(),build:release,host:host.value,sensors:readSensorTelemetry(process.env.DAW_SENSOR_FILE),presence:presence.value,health:{backend:'ok',musicAssistant:music?.publicStatus().status||'simulation',hardware:'unverified'},settings:{display:preferences.get().display,dashboard:preferences.get().dashboard,language:preferences.get().language},history:runtime.log.slice(-100).map(e=>({at:e.at,type:e.type,state:e.state,simulated:e.simulated})),debug:debug.status()});
app.get('/api/system',(_q,r)=>r.set('Cache-Control','no-store').json(systemReport()));
app.get('/api/debug',(q,r)=>{try{security.requireAdmin(q);r.set('Cache-Control','no-store').json(debug.status());}catch(e){r.status(e.status||423).json({error:e.message});}});
app.post('/api/debug',(q,r)=>{if(!validDeviceRequest(q))return r.status(403).json({error:'Reload before changing debug capture'});try{if(Object.keys(q.body).some(k=>!['enabled','clear'].includes(k)))throw Error('Invalid debug action');if(q.body.clear===true)debug.clear();if(q.body.enabled!==undefined)debug.set(q.body.enabled);r.json(debug.status());}catch(e){r.status(400).json({error:e.message});}});
app.get('/api/debug/download',(q,r)=>{try{security.requireAdmin(q);r.set({'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="tunebox-debug.json"'}).send(JSON.stringify({...systemReport(),events:debug.read()},null,2)+'\n');}catch(e){r.status(e.status||423).json({error:e.message});}});
app.get('/api/measurement/profile',(q,r)=>{try{security.requireAdmin(q);let value=roomDefaults();try{value=roomProfile(JSON.parse(readFileSync(join(stateDirectory,'room-profile.json'),'utf8')));}catch{}r.set('Cache-Control','no-store').json(value);}catch(e){r.status(e.status||423).json({error:e.message});}});
app.post('/api/measurement/profile',(q,r)=>{if(!validDeviceRequest(q))return r.status(403).json({error:'Reload before saving the room profile'});try{const value=roomProfile(q.body),p=join(stateDirectory,'room-profile.json');writeFileSync(p+'.tmp',JSON.stringify(value)+'\n',{mode:0o600});renameSync(p+'.tmp',p);r.json(value);}catch(e){r.status(400).json({error:e.message});}});
app.get('/api/measurement/genres',async(q,r)=>{try{security.requireAdmin(q);if(!music||music.status!=='connected')throw Error('Connect Music Assistant to import favorite genres');const value=await music.transport.command('music/tracks/library_items',{favorite:true,limit:50,offset:0}),rows=Array.isArray(value)?value:value?.items;if(!Array.isArray(rows))throw Error('Genre metadata is unavailable');const count=new Map();for(const row of rows.slice(0,50)){const genres=row.metadata?.genres||row.genres||[];if(Array.isArray(genres))for(const genre of genres){if(typeof genre==='string'&&genre.length<=50&&!/[\x00-\x1f]/.test(genre))count.set(genre,(count.get(genre)||0)+1);}}r.set('Cache-Control','no-store').json({genres:[...count].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([g])=>g),source:'Metadata from up to 50 Music Assistant favorite tracks',sampled:rows.length});}catch(e){r.status(e.status||409).json({error:e.message});}});
app.get('/api/measurement/result',async(q,r)=>{try{security.requireAdmin(q);const value=await manage({command:'measurement-status'});if(!value.result)return r.status(404).json({error:'No microphone measurement is available'});r.set({'Cache-Control':'no-store','Content-Type':'application/json','Content-Disposition':'attachment; filename="tunebox-room-measurement.json"'}).send(JSON.stringify(value.result,null,2)+'\n');}catch(e){r.status(e.status||409).json({error:e.message});}});
let networkCache=null,networkRead=null;
app.get("/api/network",async(_q,r)=>{
  r.set("Cache-Control","no-store");
  if(!networkCache||Date.now()-networkCache.observedAt>30000){
    networkRead ||= (async()=>{
      try {const value=await manage({command:"network",args:{}});networkCache={...value,observedAt:Date.now()};}
      catch {networkCache={supported:false,connected:null,signal:null,observedAt:Date.now()};}
    })().finally(()=>{networkRead=null;});
    await networkRead;
  }
  r.json(networkCache);
});
async function readUpdates(){
 let manager;try{manager=await manage({command:"status"});}catch{manager={managed:false,simulated:false,configured:false};}
 const status=simulatedManager?simulatedManager.status():updateStatus();
 return {...status,current:status.current?.release?status.current:{release:release.id,commit:deploymentCommit()},manager,controlToken};
}
const manualUpdate=new ManualUpdate({snapshot,status:readUpdates,manage,music,multiroom,pauseSimulation:()=>{runtime.dispatch({type:'pause'});broadcast();}});
const automaticSound=new AutomaticSound({context:()=>{const status=publicAutomaticDsp();return {enabled:status.settings?.enabled===true,settings:status.settings,connected:music?.status==='connected',localSelected:localAudio.get().ready===true,playing:localAudio.get().playing===true,bluetooth:bluetoothState().active,trackKey:localAudio.get().trackKey};},perform:()=>manage({command:'dsp-auto-update',args:{}}),onChange:broadcast});
music?.on('change',()=>{localAudio.refresh(publicAutomaticDsp().settings?.enabled===true);automaticSound.schedule();});
app.get('/api/sync/context',(_q,r)=>r.set('Cache-Control','no-store').json(syncContext()));
app.get('/api/sync/clock',(_q,r)=>{const a=audioAnalysis.get({watch:true,selectedId:music?.playerId});r.set('Cache-Control','no-store').json({now:Number(process.hrtime.bigint())/1e6,capturedAt:a.measurement?.capturedMonotonicMs??null,windowMs:a.measurement?.windowMs??null});});
app.get('/api/sync/profiles',(q,r)=>{try{security.requireAdmin(q);r.set('Cache-Control','no-store').json({profiles:syncProfiles.list(),context:syncContext()});}catch(e){r.status(e.status||409).json({error:e.message});}});
app.post('/api/sync/profiles',async(q,r)=>{
 if(!validDeviceRequest(q))return r.status(403).json({error:'Reload before saving synchronization'});
 try{security.requireAdmin(q);if(q.body.action==='adjust'){if(q.body.confirmed!==true||Object.keys(q.body).some(k=>!['action','confirmed','contextKey','fineMs','useVideo'].includes(k))||q.body.contextKey!==syncContext().key)throw Error('Confirm the current output timing');const profile=syncProfiles.adjust(syncContext(),{fineMs:q.body.fineMs,useVideo:q.body.useVideo});broadcast();return r.set('Cache-Control','no-store').json({saved:true,profile,snapshot:snapshot()});}if(q.body.confirmed!==true||Object.keys(q.body).some(k=>!['confirmed','resultId','useVideo','fineMs'].includes(k)))throw Error('Confirm the measured synchronization result');
  const current=await manage({command:'sync-status'});if(current.running||current.phase!=='complete'||current.result?.id!==q.body.resultId)throw Error('Complete a fresh synchronization measurement first');
  const profile=syncProfiles.save(current.result,syncContext(),{useVideo:q.body.useVideo??false,fineMs:q.body.fineMs??0});
  const p=preferences.get();applyPreferences(preferences.save(p.revision,{prefs:{...p.prefs,syncAutomatic:true}}));r.set('Cache-Control','no-store').json({saved:true,profile,snapshot:snapshot()});
 }catch(e){r.status(e.status||409).json({error:e.message});}
});
app.get("/api/updates",async(_q,r)=>{
 r.set("Cache-Control","no-store").json(await readUpdates());
});
app.post("/api/device",async(q,r)=>{
 if(!validDeviceRequest(q))return r.status(403).json({error:"Reload TuneBox before changing device settings"});
 try{if(q.body.command!=='install')manualUpdate.assertAvailable();let value;
   if(q.body.command==='install')value=await manualUpdate.install(q.body);
   else if(q.body.command==='measurement-start'&&q.body.args?.stopOthers===true){
    // Confirmed in the sweep dialog: stop interfering audio on this TuneBox first.
    const {stopOthers,...args}=q.body.args;
    const stopped=await prepareMeasurement({bluetooth:bluetoothState,syncRunning:synchronizationRunning,manage,music,multiroom,runtime});
    if(stopped.length){localAudio.refresh(publicAutomaticDsp().settings?.enabled===true);broadcast();}
    value={...await manage({command:'measurement-start',args}),stopped};
   }else if(q.body.command==='power-discover-20v'&&q.body.args?.stopOthers===true){
    // Owner 20 Nov 2026: tapping power setup pauses this TuneBox (and leaves its group) itself; the contract only changes while silent.
    const stopped=await prepareMeasurement({bluetooth:bluetoothState,syncRunning:synchronizationRunning,manage,music,multiroom,runtime,purpose:'power'});
    if(stopped.length){localAudio.refresh(publicAutomaticDsp().settings?.enabled===true);broadcast();await new Promise(r=>setTimeout(r,stopped.includes('playback')?800:0));}
    value={...await manage({command:'power-discover-20v',args:{}}),stopped};
   }else value=await manage(q.body);if(q.body.command==='hotspot-start'){
   if(!value.simulated&&!phoneServer){phoneServer=createServer((request,response)=>{request.provisioning=true;app(request,response);});await new Promise((resolve,reject)=>{phoneServer.once('error',reject);phoneServer.listen(3003,'10.42.0.1',resolve);});}
   value.pairingToken=security.createPair();value.setupUrl=(value.url||'http://10.42.0.1:3003/?setup=phone')+'#pair='+value.pairingToken;
  }if(['bluetooth-start','bluetooth-stop','dsp-auto-config'].includes(q.body.command)){localAudio.refresh(publicAutomaticDsp().settings?.enabled===true);automaticSound.schedule();}if(['wifi','hotspot-stop'].includes(q.body.command)){networkCache=null;if(phoneServer){phoneServer.close();phoneServer=null;}}
  r.set('Cache-Control','no-store').json(value);
  debug.record('device',q.body.command||'unknown',{accepted:true});
 }catch(error){debug.record('device','rejected');if(q.body.command==='hotspot-start'&&phoneServer){phoneServer.close();phoneServer=null;await manage({command:'hotspot-stop',args:{}}).catch(()=>{});}r.status(409).json({error:String(error.message).slice(0,180),...(error.code==='update-group-confirmation'?{code:error.code,rooms:error.rooms,roomsRevision:error.roomsRevision}:{})});}
});
app.get('/api/bluetooth',(_q,r)=>r.set('Cache-Control','no-store').json(bluetoothState()));
app.get("/api/audio",(q,r)=>{if(bluetoothState().active)return r.set('Cache-Control','no-store').json({enabled:false,configured:audioAnalysis.configured,status:'source-unavailable',source:'bluetooth',simulated:false,measurement:null});r.set("Cache-Control","no-store").json(audioAnalysis.get({watch:q.query.watch==="1",awake:!screenOff&&(runtime.device.displayAwake||['vu','bars','spectrum'].includes(preferences.get().prefs.screen.mode))&&runtime.device.mode!=="shutdown",selectedId:music?.publicStatus().playerId}));});
app.post("/api/audio/settings",(q,r)=>{
 if(!validDeviceRequest(q))return r.status(403).json({error:"Reload TuneBox before changing measurement settings"});
 try{if(!q.body||Object.keys(q.body).length!==1||!Object.hasOwn(q.body,"enabled"))throw Error("Only enabled can be changed");audioAnalysis.setEnabled(q.body.enabled);preferences.save(preferences.get().revision,{audioEnabled:q.body.enabled});r.json(audioAnalysis.get());}catch(error){r.status(400).json({error:error.message});}
});
app.get('/api/power',(_q,r)=>r.set('Cache-Control','no-store').json({power:host.value.power||null}));
app.get("/api/health", (_q, r) =>
  r.json({
    ok: true,
    deploymentCommit: deploymentCommit(),
    build: release,
    mode: config.mode,
    hardware: "unverified",
    device: runtime.device.mode,
    musicAssistant: music?.publicStatus().status || "mock",
  }),
);
app.get('/api/display', (_q,r) => {
  let backlight = { supported:false };
  try {
    const raw = readFileSync('/run/daw-one-display/status.json','utf8');
    if (raw.length <= 4096) {
      const value = JSON.parse(raw);
      if (Number.isFinite(value.observedAt) && Date.now()-value.observedAt < 5000) backlight = value;
    }
  } catch {}
  r.set('Cache-Control','no-store').json({ settings:displayConfiguration, backlight });
});
const currentVideoTrack=()=>{const p=music?.playback||runtime.playback;return p.queue[p.index];};
const currentVideoLink=()=>{
 const track=currentVideoTrack();return youtube.videoLink(track,videos.get(track));
};
app.get('/api/youtube/status',async(_q,r)=>{r.set('Cache-Control','no-store');try{r.json(await youtube.status());}catch(e){r.status(503).json({error:e.message});}});
app.get('/api/youtube/settings',(_q,r)=>r.set('Cache-Control','no-store').json(youtube.get()));
app.post('/api/youtube/settings',(q,r)=>{if(!validDeviceRequest(q))return r.status(403).json({error:'Reload before changing YouTube settings'});try{const saved=youtube.save(q.body);broadcast();r.set('Cache-Control','no-store').json(saved);}catch(e){r.status(409).json({error:e.message});}});
app.get('/api/video',(_q,r)=>r.set('Cache-Control','no-store').json(currentVideoLink()));
app.post('/api/video/youtube',(q,r)=>{if(!validDeviceRequest(q))return r.status(403).json({error:'Reload before linking a YouTube video'});try{videos.linkYoutube(currentVideoTrack(),q.body);videoRevision++;broadcast();r.json(currentVideoLink());}catch(e){r.status(409).json({error:e.message});}});
app.post('/api/video/timing',(q,r)=>{if(!validDeviceRequest(q))return r.status(403).json({error:'Reload before saving video timing'});try{const link=currentVideoLink();if(link.automatic){if(q.body.trackKey!==link.trackKey||q.body.id!==link.id||q.body.revision!==link.revision||Object.keys(q.body).some(k=>!['trackKey','id','revision','sync'].includes(k)))throw Error('Track or video changed. Reload before saving video timing.');videos.linkYoutube(currentVideoTrack(),{trackKey:link.trackKey,video:link.videoId,sync:q.body.sync});}else videos.timing(currentVideoTrack(),q.body);videoRevision++;broadcast();r.json(currentVideoLink());}catch(e){r.status(409).json({error:e.message});}});
app.get('/api/video/file/:id',(q,r)=>{const path=videos.path(q.params.id);if(!path)return r.sendStatus(404);r.set('Cache-Control','private, max-age=600').sendFile(q.params.id,{root:videos.directory,dotfiles:'deny'});});
app.post('/api/video/upload',async(q,r)=>{
  // A closing upstream connection can reset a proxy's upload if we reply while
  // it is still sending. Drain without buffering and wait for end before rejection.
  const rejectUpload=async(status,message)=>{q.resume();await finished(q,{cleanup:true,signal:AbortSignal.timeout(30000)});return r.status(status).json({error:message});};
  try{
    if(!validDeviceRequest(q))return await rejectUpload(403,'Reload TuneBox before linking a video');
    const track={...currentVideoTrack()};
    if(q.get('X-TuneBox-Track')&&q.get('X-TuneBox-Track')!==videos.get(track).trackKey)return await rejectUpload(409,'Track changed. Open video settings again.');
    const saved=await videos.upload(q,track,q.get('Content-Type')?.split(';')[0],q.get('Content-Length'));videoRevision++;broadcast();r.json(saved);
  }catch(error){if(!r.headersSent&&!r.destroyed)r.status(400).json({error:error.message});}
});
app.delete('/api/video', (q,r)=>{
  if(!validDeviceRequest(q))return r.status(403).json({error:'Reload TuneBox before removing a video'});
  try{const track=currentVideoTrack(),link=currentVideoLink();if(q.get('X-TuneBox-Track')&&q.get('X-TuneBox-Track')!==link.trackKey||q.get('X-TuneBox-Video')&&q.get('X-TuneBox-Video')!==link.id)return r.status(409).json({error:'Track or video changed. Reload before removing it.'});const result=videos.remove(track,{disableAutomatic:youtube.get().followCurrent});videoRevision++;broadcast();r.json(result);}catch(error){r.status(409).json({error:error.message});}
});
app.post('/api/display', (q,r) => {
  if (!validDeviceRequest(q)) return r.status(403).json({error:'Reload TuneBox before changing display settings'});
  try {
    displayConfiguration = displayStore.save(q.body);
    preferences.save(preferences.get().revision,{display:displayConfiguration});
    runtime.displayTimeoutMs = displayConfiguration.timeoutSeconds === 0 ? Infinity : displayConfiguration.timeoutSeconds * 1000;
    runtime.dispatch({type:'activity'});
    broadcast();
    r.json({ settings:displayConfiguration });
  } catch { r.status(400).json({error:'Invalid display settings'}); }
});
app.post('/api/reset',async(q,r)=>{
 if(!validDeviceRequest(q))return r.status(403).json({error:'Reload before resetting settings'});
 try{if(!['preferences','setup'].includes(q.body.kind)||q.body.confirmed!==true)throw Error('Confirm the reset');if(q.body.kind==='setup')await manage({command:'erase-setup',args:{confirmed:'ERASE TUNEBOX'}});const value=preferences.reset({setup:q.body.kind==='setup'});rmSync(join(stateDirectory,'room-profile.json'),{force:true});if(q.body.kind==='setup'){debug.clear();youtube.reset();syncProfiles.clear();}audioAnalysis.setEnabled(false);if(q.body.kind==='setup'){security.clear(q,r);writeFileSync(join(stateDirectory,'first-start'),'1\n',{mode:0o600});}applyPreferences(value);r.json({reset:true,restarting:q.body.kind==='setup',settings:value});}catch(e){r.status(409).json({error:e.message});}
});
app.post('/api/display/ready', (q,r) => {
  if (!validDeviceRequest(q)) return r.status(403).json({error:'Reload TuneBox before revealing the display'});
  try {
    const path='/run/daw-one-display/ready.json';
    writeFileSync(path+'.tmp',JSON.stringify({ready:true,observedAt:Date.now()})+'\n',{mode:0o660});
    renameSync(path+'.tmp',path);
    r.json({ready:true});
  } catch { r.json({ready:false,supported:false}); }
});
// User activity affects the shared display timer, never MA playback or verification.
app.post("/api/activity", (_q, r) => {
  // The tap that starts screen rest also reports activity; that report can arrive just after the rest request.
  if(Date.now()-restRequestedAt<1200&&runtime.device.displayAwake===false)return r.json({ok:true,ignored:'screen-rest'});
  const awake = runtime.device.displayAwake;
  runtime.dispatch({ type: "activity" });
  if (awake !== runtime.device.displayAwake) broadcast();
  r.json({ ok: true });
});
app.post("/api/boot/settings", (q, r) => {
  if (music)
    return r.status(409).json({
      error:
        "Live autoradio requires a verified route/station adapter; simulation settings only",
    });
  try {
    runtime.startupSettings = startupStore.save(q.body);
    runtime.record(
      Date.now(),
      "startup-settings",
      runtime.device.mode,
      "Saved for next simulated cold boot; current playback unchanged",
    );
    broadcast();
    r.json(snapshot());
  } catch {
    r.status(400).json({ error: "Startup settings could not be saved" });
  }
});
app.get("/api/library", async (q, r) => {
  if (!library)
    return r
      .status(409)
      .json({ error: "Live bibliotheek vereist Music Assistant-modus" });
  try {
    r.json(
      await library.browse({
        kind: q.query.type || "albums",
        q: q.query.q || "",
        offset: Number(q.query.offset || 0),
        parent: q.query.parent || "",
        favorite: q.query.favorite === "true",
        source:q.query.source||"all",
      }),
    );
  } catch {
    r.status(503).json({
      error:
        "Bibliotheek niet beschikbaar; controleer verbinding, rechten en MA-versie",
    });
  }
});
async function musicControl(run){
  manualUpdate.assertAvailable();
  if(bluetoothState().active)throw Error('Switch back to Music Assistant before using its playback controls.');
  if(multiroom.busy||music?.controlBusy)throw Error('Wait for the room change to finish.');
  music.controlBusy=true;
  try{return await run();}finally{music.controlBusy=false;}
}
app.post("/api/library/play", async (q, r) => {
  if (!library)
    return r.status(409).json({ error: "Live bibliotheek niet actief" });
  try {
    await musicControl(()=>library.enqueue(q.body.id, q.body.option, {confirmReplace:q.body.confirmReplace===true}));
    r.json(snapshot());
  } catch (e) {
    if(e.code==='queue-not-empty')return r.status(409).json({error:e.message,code:e.code,upcoming:e.upcoming});
    runtime.record(Date.now(),'library-play-rejected',runtime.device.mode,e.message);
    debug.record('music','library-play-rejected',{code:Number.isFinite(e.code)?e.code:0});
    r.status(409).json({
      error: e.message.startsWith("Music Assistant")
        ? "Music Assistant weigerde de actie; deze is niet opnieuw verstuurd"
        : e.message,
    });
  }
});
app.post('/api/library/save-queue',async(q,r)=>{
  if(!library)return r.status(409).json({error:'Live library not active'});
  if(!q.body||Object.keys(q.body).some(k=>k!=='name')||q.body.name!==undefined&&typeof q.body.name!=='string')return r.status(400).json({error:'Invalid playlist request'});
  try{r.set('Cache-Control','no-store').json(await musicControl(()=>library.saveQueue(q.body.name)));}
  catch(e){debug.record('music','save-queue-rejected',{});r.status(409).json({error:String(e.message).startsWith('Music Assistant')||/command|unknown/i.test(e.message)?'Music Assistant could not save the queue as a playlist. Nothing was replaced.':String(e.message).slice(0,160)});}
});
app.post('/api/library/favorite',async(q,r)=>{
 if(!validDeviceRequest(q))return r.status(403).json({error:'Reload before changing favorites'});
 try{security.requireAdmin(q);if(!library)throw Error('Connect Music Assistant first');if(!q.body||Object.keys(q.body).some(k=>!['id','enabled'].includes(k)))throw Error('Invalid favorite request');r.json(await musicControl(()=>library.favorite(q.body.id,q.body.enabled)));}
 catch(e){r.status(e.status||409).json({error:e.message.startsWith('Music Assistant')?'Music Assistant could not update the favorite. Reload to check its current state.':e.message});}
});
app.get("/api/artwork/:id", async (q, r) => {
  if (!artwork) return r.sendStatus(404);
  try {
    const image = await artwork.get(q.params.id);
    r.set({
      "Content-Type": image.type,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    }).send(image.body);
  } catch {
    r.sendStatus(404);
  }
});
app.get("/api/state", (_q, r) => r.json(snapshot()));
app.get("/api/events", (q, r) => {
  r.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  r.flushHeaders();
  streamWriter.write(r, `data: ${JSON.stringify(snapshot())}\n\n`);
  clients.add(r);
  q.on("close", () => {
    clients.delete(r);
    streamWriter.remove(r);
  });
});
app.get("/api/scenarios", (_q, r) =>
  r.json(music ? [] : Object.keys(scenarios)),
);
const roomsFor = q => {const auth=security.status(q);return {...multiroom.status(),locked:auth.enabled&&!auth.unlocked};};
app.get('/api/rooms',async(q,r)=>{
  try{await multiroom.read();r.set('Cache-Control','no-store').json(roomsFor(q));}
  catch{r.status(503).json({error:'Rooms could not be refreshed. Check the Music Assistant connection.'});}
});
app.post('/api/rooms',async(q,r)=>{
  if(!validDeviceRequest(q))return r.status(403).json({error:'Reload TuneBox before changing rooms.'});
  try{manualUpdate.assertAvailable();if(bluetoothState().active)throw Error('Switch back to Music Assistant before changing rooms.');await multiroom.act(q.body);broadcast();r.set('Cache-Control','no-store').json({rooms:roomsFor(q),snapshot:snapshot()});}
  catch(e){r.status(e.status||400).json({error:e.message,rooms:roomsFor(q)});}
});
app.post("/api/player", async (q, r) => {
  try {
    manualUpdate.assertAvailable();
    if(bluetoothState().active)throw Error('Switch back to Music Assistant before selecting another player.');
    if (!music)
      throw Error("Select live music mode in server configuration first");
    await music.selectPlayer(q.body.id);
    r.json(snapshot());
  } catch (e) {
    r.status(400).json({ error: e.message });
  }
});
app.post("/api/scenario", (q, r) => {
  try {
    manualUpdate.assertAvailable();
    if (music)
      return r
        .status(409)
        .json({ error: "Scenarios disabled in live music mode" });
    runScenario(runtime, q.body.name);
    broadcast();
    r.json(snapshot());
  } catch (e) {
    runtime.record(Date.now(), "error", runtime.device.mode, e.message);
    r.status(400).json({ error: e.message });
  }
});
/** Shared by the wall display and the phone remote, so both obey the same gates. */
async function playbackEvent(body){
    if(!['activity','display-timeout'].includes(body.type))manualUpdate.assertAvailable();
    const bt=bluetoothState();
    if(body.sourceId!==undefined&&body.sourceId!==bt.sessionId)throw Error('The audio source changed; adjust its current volume again.');
    if(bt.active&&['play','pause','previous','next','seek','volume','mute','queue-select','queue-remove','queue-add'].includes(body.type)){
      if(body.type!=='volume'||!Number.isInteger(body.value)||body.sourceId!==bt.sessionId||Object.keys(body).some(k=>!['type','value','sourceId'].includes(k)))throw Error('Control Bluetooth playback on your phone, or switch back to Music Assistant.');
      await manage({command:'bluetooth-volume',args:{value:body.value,sessionId:bt.sessionId}});broadcast();return;
    }
    if(body.type==='volume'&&Number.isFinite(body.value)&&body.value>preferences.get().maxVolume&&preferences.get().revision>0)throw Error('Volume exceeds the saved limit');
    if (['activity','display-timeout'].includes(body.type)) {
      runtime.dispatch(body);
    } else if (music) {
      const selected=multiroom.status().rooms.find(p=>p.id===music.playerId);
      if(selected?.type==='group'&&['volume','mute'].includes(body.type)){
        const value=body.type==='volume'&&Number.isFinite(body.value)?Math.max(0,Math.min(music.config.volumeLimit,Math.round(body.value))):body.value;
        await multiroom.act({action:body.type==='volume'?'group-volume':'group-mute',playerId:selected.id,value,revision:multiroom.status().revision});
      }else await musicControl(()=>music.control(body));
      runtime.record(
        Date.now(),
        "music-command",
        runtime.device.mode,
        `Music Assistant ${body.type} completed`,
      );
    } else runtime.dispatch(body);
    broadcast();
}
let restRequestedAt=0;
app.post("/api/event", async (q, r) => {
  try {
    if(q.body?.type==='display-timeout')restRequestedAt=Date.now();
    await playbackEvent(q.body);
    r.json(snapshot());
  } catch (e) {
    runtime.record(Date.now(), "error", runtime.device.mode, e.message);
    broadcast();
    r.status(music ? 409 : 400).json({ error: e.message });
  }
});
// ---- Phone remote control -------------------------------------------------
// A separate LAN listener runs only while a phone is paired or a QR code is shown.
const remotePort=Number(process.env.DAW_REMOTE_PORT||3005),remoteHost=process.env.DAW_REMOTE_HOST||'0.0.0.0';
let remoteServer=null,remoteStarting=null,remoteExpiry=null,remoteStop=null;
async function startRemoteServer(){
 clearTimeout(remoteStop);if(remoteServer)return;
 remoteStarting||=new Promise((resolve,reject)=>{const s=createServer((request,response)=>{request.remote=true;app(request,response);});s.once('error',reject);s.listen(remotePort,remoteHost,()=>{remoteServer=s;resolve();});}).finally(()=>{remoteStarting=null;});
 await remoteStarting;
}
// A revoked phone briefly still reaches the listener, so it can show "scan again" instead of an outage.
function stopRemoteServerWhenUnused(){
 if(remote.phones.length||remote.pairing()||!remoteServer)return;
 clearTimeout(remoteStop);remoteStop=setTimeout(()=>{if(remote.phones.length||remote.pairing()||!remoteServer)return;for(const c of remoteClients)c.end();remoteClients.clear();remoteServer.close();remoteServer=null;},Number(process.env.DAW_REMOTE_IDLE_MS||30000));remoteStop.unref();
}
const remoteStatus=()=>({phones:remote.list(),pairing:remote.pairing(),listening:!!remoteServer,address:remoteAddress(),port:remotePort,limit:8,pinRequired:remotePinRequired()});
// Hoisted: snapshot() may run during startup, before the security store is defined below.
function remoteNotifications(){try{const updates=simulatedManager?simulatedManager.status():updateStatus();return settingsAttention(snapshot(),updates,{}).filter(n=>!['unlock','setup'].includes(n.id));}catch{return [];}}
function phoneView(){return remoteView(snapshot(),{notifications:remoteNotifications()});}
function remotePinRequired(){try{return security.status({headers:{}}).enabled===true;}catch{return false;}}
app.get('/api/remote/phones',(q,r)=>{try{security.requireAdmin(q);r.set('Cache-Control','no-store').json(remoteStatus());}catch(e){r.status(e.status||423).json({error:e.message});}});
// The Party sheet shows the pairing code without unlocking settings: when a settings PIN
// exists the phone must enter that PIN, so the code alone never grants control.
async function remotePairing(q,r,{party=false}={}){
 const status=()=>party?{...remoteStatus(),phones:remote.list().length}:remoteStatus();
 try{
  if(q.body?.action==='cancel'){remote.cancelPair();stopRemoteServerWhenUnused();return r.set('Cache-Control','no-store').json(status());}
  if(q.body?.action!=='start'||Object.keys(q.body).length!==1)throw Error('Unknown remote action');
  const address=process.env.DAW_REMOTE_ADDRESS||remoteAddress();if(!address)throw Error('Connect TuneBox to your home network first');
  const pair=remote.createPair();await startRemoteServer();
  clearTimeout(remoteExpiry);remoteExpiry=setTimeout(stopRemoteServerWhenUnused,pair.expiresAt-Date.now()+1000);remoteExpiry.unref();
  r.set('Cache-Control','no-store').json({...status(),url:`http://${address}:${remotePort}/remote.html#pair=${pair.token}`,expiresAt:pair.expiresAt});
 }catch(e){r.status(e.status||409).json({error:e.code==='EADDRINUSE'?'The remote port is in use':e.message});}
}
// Where a person on the home network finishes onboarding of a Music Assistant server on this Pi.
app.get('/api/local-ma/address',(_q,r)=>{const address=process.env.DAW_REMOTE_ADDRESS||remoteAddress();r.set('Cache-Control','no-store').json({url:address?`http://${address}:8095`:null});});
app.post('/api/remote/pairing',async(q,r)=>{if(!validDeviceRequest(q))return r.status(403).json({error:'Reload TuneBox before pairing a remote'});return remotePairing(q,r);});
app.post('/api/remote/party',async(q,r)=>{if(!validDeviceRequest(q))return r.status(403).json({error:'Reload TuneBox before showing the party code'});return remotePairing(q,r,{party:true});});
app.post('/api/remote/forget',(q,r)=>{
 if(!validDeviceRequest(q))return r.status(403).json({error:'Reload TuneBox before forgetting a phone'});
 try{if(q.body?.all===true)remote.forgetAll();else if(typeof q.body?.id==='string')remote.forget(q.body.id);else throw Error('Choose a phone');for(const c of [...remoteClients])if(!remote.phone(c.req)){c.end();remoteClients.delete(c);}stopRemoteServerWhenUnused();r.set('Cache-Control','no-store').json(remoteStatus());}
 catch(e){r.status(409).json({error:e.message});}
});
// Routes below are reached by paired phones through the remote listener only.
const remoteOnly=(q,r)=>{if(q.remote)return true;r.status(404).json({error:'Not found'});return false;};
app.get('/api/remote/session',(q,r)=>{if(!remoteOnly(q,r))return;const phone=remote.phone(q);r.set('Cache-Control','no-store').json({paired:!!phone,name:phone?.name||null});});
app.post('/api/remote/pair',(q,r)=>{
 if(!remoteOnly(q,r))return;
 try{if(!q.body||Object.keys(q.body).some(k=>!['token','name','pin'].includes(k)))throw Error('Unexpected pairing request');
  // With a settings PIN, the phone proves it knows that PIN before the single-use code is spent.
  if(remotePinRequired()){
   if(!remote.pairing())throw Error('This remote code expired or was already used. Show a new code on TuneBox.');
   if(q.body.pin===undefined)return r.status(403).json({error:'Enter the TuneBox settings PIN to pair this phone.',code:'pin-required'});
   try{security.verify(q.body.pin);}catch(e){return r.status(e.status||403).json({error:e.status===429?e.message:'That PIN is not correct.',code:e.status===429?'pin-locked':'pin-wrong'});}
  }
  const result=remote.complete(q.body.token,q.body.name);r.setHeader('Set-Cookie',remote.cookie(result.credential));clearTimeout(remoteExpiry);broadcast();r.set('Cache-Control','no-store').json({paired:true});}
 catch(e){r.status(403).json({error:e.message});}
});
// A paired phone can invite another phone: a new single-use code (10 minutes). A settings PIN still applies when the new phone pairs.
app.post('/api/remote/invite',(q,r)=>{if(!remoteOnly(q,r))return;try{if(q.body&&Object.keys(q.body).length)throw Error('Unexpected invite request');const address=process.env.DAW_REMOTE_ADDRESS||remoteAddress();if(!address)throw Error('TuneBox is not on the home network');const pair=remote.createPair();clearTimeout(remoteExpiry);remoteExpiry=setTimeout(stopRemoteServerWhenUnused,pair.expiresAt-Date.now()+1000);remoteExpiry.unref();debug.record('remote','invite',{accepted:true});broadcast();r.set('Cache-Control','no-store').json({url:`http://${address}:${remotePort}/remote.html#pair=${pair.token}`,expiresAt:pair.expiresAt,pinRequired:remotePinRequired()});}catch(e){r.status(409).json({error:e.message});}});
app.post('/api/remote/leave',(q,r)=>{if(!remoteOnly(q,r))return;try{remote.forget(remote.phone(q).id);}catch{}r.setHeader('Set-Cookie','tunebox_remote=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');setTimeout(stopRemoteServerWhenUnused,250).unref();r.json({paired:false});});
// Own screen-rest photo: a paired phone sends it, TuneBox itself accepts it (see server/rest-photo.js).
app.post('/api/remote/rest-photo',express.raw({type:'image/jpeg',limit:restPhotoLimits.bytes}),(q,r)=>{if(!remoteOnly(q,r))return;try{const status=restPhoto.upload(q.body,remote.phone(q)?.name);debug.record('remote','rest-photo',{accepted:true});broadcast();r.json({pending:true,status});}catch(e){r.status(400).json({error:String(e.message).slice(0,120)});}});
app.get('/api/rest-photo/:which',(q,r)=>{const file=['current','pending'].includes(q.params.which)?restPhoto.file(q.params.which):null;if(!file)return r.status(404).json({error:'No photo'});r.set({'Content-Type':'image/jpeg','Cache-Control':'no-cache'}).sendFile(file.path);});
app.post('/api/rest-photo',(q,r)=>{if(!validDeviceRequest(q))return r.status(403).json({error:'Reload TuneBox before changing the photo'});try{const status=restPhoto.act(q.body?.action);broadcast();r.json(status);}catch(e){r.status(409).json({error:e.message});}});
app.get('/api/remote/state',(q,r)=>{if(!remoteOnly(q,r))return;r.set('Cache-Control','no-store').json(phoneView());});
app.get('/api/remote/events',(q,r)=>{
 if(!remoteOnly(q,r))return;
 if(remoteClients.size>=16)return r.status(429).json({error:'Too many remote connections'});
 r.set({"Content-Type":"text/event-stream","Cache-Control":"no-cache",Connection:"keep-alive","X-Accel-Buffering":"no"});r.flushHeaders();
 r.req=q;remoteWriter.write(r,`data: ${JSON.stringify(phoneView())}\n\n`);remoteClients.add(r);
 q.on('close',()=>{remoteClients.delete(r);remoteWriter.remove(r);});
});
app.post('/api/remote/event',async(q,r)=>{
 if(!remoteOnly(q,r))return;
 try{const view=phoneView(),body=remoteEvent(q.body,view);if(view.bluetooth&&body.type==='mute')throw Error('Use volume to quiet Bluetooth audio');
  await playbackEvent(view.bluetooth&&body.type==='volume'?{...body,sourceId:bluetoothState().sessionId}:body);debug.record('remote',body.type,{accepted:true});r.json(phoneView());}
 catch(e){debug.record('remote','rejected');r.status(409).json({error:String(e.message).slice(0,180),state:phoneView()});}
});
app.get('/api/remote/search',async(q,r)=>{
 if(!remoteOnly(q,r))return;
 try{if(!library)throw Error('Search needs Music Assistant');const text=typeof q.query.q==='string'?q.query.q.trim():'',offset=Number(q.query.offset||0);if(!text||text.length>120)throw Error('Type something to search');r.set('Cache-Control','no-store').json(await library.browse({kind:'tracks',q:text,offset}));}
 catch(e){r.status(409).json({error:e.message==='Music Assistant is niet verbonden'?'Music Assistant is not connected':String(e.message).slice(0,180)});}
});
app.post('/api/remote/play',async(q,r)=>{
 if(!remoteOnly(q,r))return;
 try{if(!library)throw Error('Search needs Music Assistant');if(!q.body||Object.keys(q.body).some(k=>!['id','option','confirmReplace'].includes(k))||typeof q.body.id!=='string'||!remoteQueueOptions.includes(q.body.option)||q.body.confirmReplace!==undefined&&typeof q.body.confirmReplace!=='boolean')throw Error('Choose play now or add to queue');
  await musicControl(()=>library.enqueue(q.body.id,q.body.option,{confirmReplace:q.body.confirmReplace===true}));debug.record('remote','library-'+q.body.option,{accepted:true});broadcast();r.json(phoneView());}
 catch(e){if(e.code==='queue-not-empty')return r.status(409).json({error:e.message,code:e.code,upcoming:e.upcoming});r.status(409).json({error:String(e.message).startsWith('Music Assistant')?'Music Assistant refused the request; it was not retried':String(e.message).slice(0,180)});}
});
if(remote.phones.length)startRemoteServer().catch(e=>console.error('Remote control listener unavailable:',e.code||e.message));
// Public documentation only; never expose the repository root or configuration.
app.get(["/docs", "/docs/"], (_q, r) =>
  r
    .type("html")
    .send(
      `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DAW ONE installation</title><body style="background:#111417;color:#f2efe9;font:18px Arial;padding:24px;line-height:1.7"><h1>DAW ONE installation and kiosk</h1><ul><li><a style="color:#c9a674" href="/docs/mac-vm.md">Mac ARM64 VM setup</a></li><li><a style="color:#c9a674" href="/docs/mac-vm.md">Mac ARM64 VM setup</a></li><li><a style="color:#c9a674" href="/docs/pi-first-run.md">Pi first installation and Music Assistant test</a></li><li><a style="color:#c9a674" href="/docs/display-modes.md">HDMI / DSI kiosk modes</a></li><li><a style="color:#c9a674" href="/docs/music-assistant.md">Music Assistant configuration</a></li><li><a style="color:#c9a674" href="/docs/raspberry-pi.md">Raspberry Pi deployment details</a></li></ul></body></html>`,
    ),
);
app.use(
  "/docs",
  express.static(fileURLToPath(new URL("../docs", import.meta.url)), {
    dotfiles: "deny",
    index: false,
    setHeaders: (r, path) => {
      if (path.endsWith(".md"))
        r.setHeader("Content-Type", "text/plain; charset=utf-8");
    },
  }),
);
app.use(express.static(fileURLToPath(new URL("../dist", import.meta.url))));
app.use((error, _q, r, _next) =>
  r.status(400).json({ error: "Invalid request" }),
);
const clock = setInterval(() => {
  const now = Date.now();
  if (runtime.sensors.heartbeatEnabled) runtime.sensors.lastHeartbeat = now;
  const before = runtime.device;
  presence.tick(preferences.get(),runtime,now);
  const screenChanged=updateScreenOff(now);
  publishDisplay();
  const savedTimeout=runtime.displayTimeoutMs;
  if(presence.value.status==='ok')runtime.displayTimeoutMs=Infinity;
  runtime.dispatch({ type: "tick" }, now);
  runtime.displayTimeoutMs=savedTimeout;
  if (
    before.mode !== runtime.device.mode ||
    before.displayAwake !== runtime.device.displayAwake || screenChanged ||
    (!music && runtime.playback.playing)
  )
    broadcast();
}, 500);
clock.unref();
const inventoryClock = setInterval(() => {
  inventory = bootInventory();
}, 30000);
inventoryClock.unref();
const hostClock=setInterval(()=>{host.sample();updatePowerHistory();debug.record('host','sample',{cpuPercent:host.value.cpu.usagePercent,availableMiB:host.value.memory.availableBytes/1048576,temperatureC:host.value.cpu.temperatureC});broadcast();},5000);hostClock.unref();
const keepalive = setInterval(() => {
  for (const c of clients)
    if (!streamWriter.blocked(c)) streamWriter.write(c, ": heartbeat\n\n");
}, 15000);
keepalive.unref();
const server = app.listen(
  Number(process.env.PORT || 3001),
  process.env.HOST || "127.0.0.1",
  () => console.log(`DAW ONE · ${config.mode} music · SIMULATED HARDWARE`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    phoneServer?.close();
    for(const c of remoteClients)c.end();remoteServer?.close();
    music?.stop();
    audioAnalysis.close();automaticSound.close();localAudio.close();
    for (const c of clients) c.end();
    clearInterval(clock);
    clearInterval(inventoryClock);
    clearInterval(hostClock);
    clearInterval(keepalive);
    server.close(() => process.exit(0));
  });
