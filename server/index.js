import {AudioAnalysis} from "./audio-analysis.js";
import { DisplayStore } from './display-store.js';
import { VideoLibrary } from './video-library.js';
import { readFileSync, writeFileSync, renameSync,existsSync,rmSync } from 'node:fs';
import {join} from 'node:path';
import {PresencePolicy} from './presence.js';
import {PreferencesStore} from './preferences-store.js';
import {HostTelemetry} from './host-telemetry.js';
import {DebugLog} from './debug-log.js';
import {roomProfile,roomDefaults} from '../shared/room-measurement.js';
import {DeviceSecurity} from './security.js';
import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {deviceRequest,controlToken,validDeviceRequest} from "./device-client.js";
import {simulatedDevice} from "./simulated-device.js";
import {updateStatus, deploymentCommit} from "./update-status.js";
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
const audioAnalysis=new AudioAnalysis({onStatus:status=>{runtime.record(Date.now(),"audio-analysis",runtime.device.mode,"Local PCM measurement: "+status);broadcast();}});
const library = music ? new MusicLibrary(music) : null;
const artwork = music ? new ArtworkCache(config) : null;
runtime.dispatch({ type: "boot-complete" });
const snapshot = () => {
  let roomMeasurement=false;try{const value=JSON.parse(readFileSync('/var/lib/daw-one-measurement/status.json','utf8'));roomMeasurement=['queued','measuring-left','measuring-right','analysing'].includes(value.phase)&&Number.isFinite(value.observedAt)&&Math.abs(Date.now()-value.observedAt)<90000;}catch{}
  const state = {
    ...runtime.snapshot(),
    build: release,
    hardwareTelemetry: readSensorTelemetry(process.env.DAW_SENSOR_FILE),
    hostTelemetry:host.value,
    activity:{roomMeasurement},
    displaySettings: displayConfiguration,
    preferences:preferences.get(),
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
const publishDisplay=()=>{try{const path='/run/daw-one-display/activity.json';writeFileSync(path+'.tmp',JSON.stringify({awake:runtime.device.displayAwake,mode:runtime.device.mode,observedAt:Date.now()})+'\n',{mode:0o660});renameSync(path+'.tmp',path);}catch{}};
const broadcast = () => {
  publishDisplay();
  const body = `data: ${JSON.stringify(snapshot())}\n\n`;
  for (const client of clients) streamWriter.write(client, body);
};
music?.on("change", broadcast);
music?.start();
app.use('/api/preferences',express.json({limit:'64kb'}));
app.use(express.json({ limit: "8kb" }));
let phoneServer=null;
const provisionCommands=['network','wifi-scan','wifi','hotspot-stop'];
app.use('/api',(q,r,next)=>{
 try{
  const mutating=!['GET','HEAD','OPTIONS'].includes(q.method),path=q.path;
  if(q.provisioning){
   const allowed=q.method==='GET'&&['/updates','/network','/security/status'].includes(path)||q.method==='POST'&&(path==='/setup/pair'||path==='/device'&&provisionCommands.includes(q.body?.command));
   if(!allowed)return r.status(403).json({error:'This setup connection only controls Wi-Fi'});
   if(mutating&&path!=='/setup/pair'&&security.session(q)?.role!=='provision')return r.status(423).json({error:'Scan the setup link shown on the TuneBox'});
  }
  const admin=mutating&&(['/device','/preferences','/reset','/display','/audio/settings','/video','/video/upload','/boot/settings','/debug','/measurement/profile'].includes(path)||path==='/event'&&!['play','pause','next','previous','seek','volume','mute','activity','display-timeout'].includes(q.body?.type));
  if(admin&&!(q.provisioning&&path==='/device'&&provisionCommands.includes(q.body?.command)))security.requireAdmin(q);
  next();
 }catch(e){r.status(e.status||423).json({error:e.message});}
});
let localStandby=false;
app.post('/api/button',async(q,r)=>{
 try{let token;try{token=readFileSync('/run/daw-one-button/token','utf8').trim();}catch{return r.sendStatus(403);}const given=q.get('X-TuneBox-Button')||'';if(!/^[a-f0-9]{64}$/.test(token)||Buffer.byteLength(token)!==Buffer.byteLength(given)||!timingSafeEqual(Buffer.from(token),Buffer.from(given)))return r.sendStatus(403);
 if(q.body.type==='long'){await manage({command:'power-off',args:{confirmed:true}});return r.json({queued:true});}
 if(q.body.type!=='short')throw Error('Unsupported button event');
 if(preferences.get().buttonAction==='local-standby'){const state=await manage({command:'local-standby',args:{enabled:!localStandby}});localStandby=state.muted;runtime.device={...runtime.device,displayAwake:!localStandby};}else runtime.dispatch({type:runtime.device.displayAwake?'display-timeout':'activity'});
 broadcast();r.json({ok:true,standby:localStandby});}catch(e){r.status(409).json({error:e.message});}
});
app.get('/api/security/status',(q,r)=>r.set('Cache-Control','no-store').json(security.status(q)));
app.post('/api/security/:action',(q,r)=>{
 if(!validDeviceRequest(q))return r.status(403).json({error:'Reload before changing security settings'});
 try{const action=q.params.action;let value;if(action==='unlock')value=security.unlock(q.body.pin,q,r);else if(action==='set-pin')value=security.setPin(q.body.pin,q.body.confirmation,q,r);else if(action==='lock'){security.lock(q,r);value=security.status(q);}else if(action==='disable'){security.requireAdmin(q);security.clear(q,r);value=security.status(q);}else throw Error('Unknown security action');r.set('Cache-Control','no-store').json(value);}catch(e){r.status(e.status||400).json({error:e.message});}
});
app.post('/api/setup/pair',(q,r)=>{if(!validDeviceRequest(q))return r.status(403).json({error:'Reload setup'});try{r.json(security.pair(q.body.token,r));}catch(e){r.status(403).json({error:e.message});}});
function applyPreferences(value){if(value.audioEnabled!==audioAnalysis.enabled)audioAnalysis.setEnabled(value.audioEnabled);displayConfiguration=value.display;runtime.displayTimeoutMs=value.display.timeoutSeconds===0?Infinity:value.display.timeoutSeconds*1000;broadcast();}
app.get('/api/preferences',(_q,r)=>r.set('Cache-Control','no-store').json(preferences.get()));
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
app.get("/api/updates",async(_q,r)=>{
 let manager;try{manager=await manage({command:"status"});}catch{manager={managed:false,simulated:false,configured:false};}
 const status=simulatedManager?simulatedManager.status():updateStatus();
 r.set("Cache-Control","no-store").json({...status,current:status.current?.release?status.current:{release:release.id,commit:deploymentCommit()},manager,controlToken});
});
app.post("/api/device",async(q,r)=>{
 if(!validDeviceRequest(q))return r.status(403).json({error:"Reload TuneBox before changing device settings"});
 try{const value=await manage(q.body);if(q.body.command==='hotspot-start'){
   if(!value.simulated&&!phoneServer){phoneServer=createServer((request,response)=>{request.provisioning=true;app(request,response);});await new Promise((resolve,reject)=>{phoneServer.once('error',reject);phoneServer.listen(3003,'10.42.0.1',resolve);});}
   value.pairingToken=security.createPair();value.setupUrl=(value.url||'http://10.42.0.1:3003/?setup=phone')+'#pair='+value.pairingToken;
  }if(['wifi','hotspot-stop'].includes(q.body.command)){networkCache=null;if(phoneServer){phoneServer.close();phoneServer=null;}}
  r.set('Cache-Control','no-store').json(value);
  debug.record('device',q.body.command||'unknown',{accepted:true});
 }catch(error){debug.record('device','rejected');if(q.body.command==='hotspot-start'&&phoneServer){phoneServer.close();phoneServer=null;await manage({command:'hotspot-stop',args:{}}).catch(()=>{});}r.status(409).json({error:String(error.message).slice(0,180)});}
});
app.get("/api/audio",(q,r)=>r.set("Cache-Control","no-store").json(audioAnalysis.get({watch:q.query.watch==="1",awake:(runtime.device.displayAwake||['vu','bars','spectrum'].includes(preferences.get().prefs.screen.mode))&&runtime.device.mode!=="shutdown",selectedId:music?.publicStatus().playerId})));
app.post("/api/audio/settings",(q,r)=>{
 if(!validDeviceRequest(q))return r.status(403).json({error:"Reload TuneBox before changing measurement settings"});
 try{if(!q.body||Object.keys(q.body).length!==1||!Object.hasOwn(q.body,"enabled"))throw Error("Only enabled can be changed");audioAnalysis.setEnabled(q.body.enabled);preferences.save(preferences.get().revision,{audioEnabled:q.body.enabled});r.json(audioAnalysis.get());}catch(error){r.status(400).json({error:error.message});}
});
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
app.get('/api/video',(_q,r)=>r.set('Cache-Control','no-store').json(videos.get(currentVideoTrack())));
app.get('/api/video/file/:id',(q,r)=>{const path=videos.path(q.params.id);if(!path)return r.sendStatus(404);r.set('Cache-Control','private, max-age=600').sendFile(q.params.id,{root:videos.directory,dotfiles:'deny'});});
app.post('/api/video/upload',async(q,r)=>{
  if(!validDeviceRequest(q))return r.status(403).json({error:'Reload TuneBox before linking a video'});
  try{r.json(await videos.upload(q,currentVideoTrack(),q.get('Content-Type')?.split(';')[0],q.get('Content-Length')));}catch(error){if(!r.headersSent&&!r.destroyed)r.status(400).json({error:error.message});}
});
app.delete('/api/video', (q,r)=>{
  if(!validDeviceRequest(q))return r.status(403).json({error:'Reload TuneBox before removing a video'});
  try{r.json(videos.remove(currentVideoTrack()));}catch(error){r.status(409).json({error:error.message});}
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
 try{if(!['preferences','setup'].includes(q.body.kind)||q.body.confirmed!==true)throw Error('Confirm the reset');if(q.body.kind==='setup')await manage({command:'erase-setup',args:{confirmed:'ERASE TUNEBOX'}});const value=preferences.reset({setup:q.body.kind==='setup'});rmSync(join(stateDirectory,'room-profile.json'),{force:true});if(q.body.kind==='setup')debug.clear();audioAnalysis.setEnabled(false);if(q.body.kind==='setup'){security.clear(q,r);writeFileSync(join(stateDirectory,'first-start'),'1\n',{mode:0o600});}applyPreferences(value);r.json({reset:true,restarting:q.body.kind==='setup',settings:value});}catch(e){r.status(409).json({error:e.message});}
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
app.post("/api/library/play", async (q, r) => {
  if (!library)
    return r.status(409).json({ error: "Live bibliotheek niet actief" });
  try {
    await library.enqueue(q.body.id, q.body.option);
    r.json(snapshot());
  } catch (e) {
    r.status(409).json({
      error: e.message.startsWith("Music Assistant")
        ? "Music Assistant weigerde de actie; deze is niet opnieuw verstuurd"
        : e.message,
    });
  }
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
app.post("/api/player", async (q, r) => {
  try {
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
app.post("/api/event", async (q, r) => {
  try {
    if(q.body.type==='volume'&&Number.isFinite(q.body.value)&&q.body.value>preferences.get().maxVolume&&preferences.get().revision>0)throw Error('Volume exceeds the saved limit');
    if (music) {
      await music.control(q.body);
      runtime.record(
        Date.now(),
        "music-command",
        runtime.device.mode,
        `Music Assistant ${q.body.type} completed`,
      );
    } else runtime.dispatch(q.body);
    broadcast();
    r.json(snapshot());
  } catch (e) {
    runtime.record(Date.now(), "error", runtime.device.mode, e.message);
    broadcast();
    r.status(music ? 409 : 400).json({ error: e.message });
  }
});
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
  publishDisplay();
  const savedTimeout=runtime.displayTimeoutMs;
  if(presence.value.status==='ok')runtime.displayTimeoutMs=Infinity;
  runtime.dispatch({ type: "tick" }, now);
  runtime.displayTimeoutMs=savedTimeout;
  if (
    before.mode !== runtime.device.mode ||
    before.displayAwake !== runtime.device.displayAwake ||
    (!music && runtime.playback.playing)
  )
    broadcast();
}, 500);
clock.unref();
const inventoryClock = setInterval(() => {
  inventory = bootInventory();
}, 30000);
inventoryClock.unref();
const hostClock=setInterval(()=>{host.sample();debug.record('host','sample',{cpuPercent:host.value.cpu.usagePercent,availableMiB:host.value.memory.availableBytes/1048576,temperatureC:host.value.cpu.temperatureC});broadcast();},5000);hostClock.unref();
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
    music?.stop();
    audioAnalysis.close();
    for (const c of clients) c.end();
    clearInterval(clock);
    clearInterval(inventoryClock);
    clearInterval(hostClock);
    clearInterval(keepalive);
    server.close(() => process.exit(0));
  });
