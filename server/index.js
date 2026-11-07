import {AudioAnalysis} from "./audio-analysis.js";
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
let inventory = bootInventory();
const config = musicConfig(),
  app = express(),
  runtime = new DeviceRuntime(Date.now(), startupStore.load()),
  clients = new Set();
const music =
  config.mode === "music-assistant" ? new LiveMusicService(config) : null;
const audioAnalysis=new AudioAnalysis({onStatus:status=>{runtime.record(Date.now(),"audio-analysis",runtime.device.mode,"Local PCM measurement: "+status);broadcast();}});
const library = music ? new MusicLibrary(music) : null;
const artwork = music ? new ArtworkCache(config) : null;
runtime.dispatch({ type: "boot-complete" });
const snapshot = () => {
  const state = {
    ...runtime.snapshot(),
    build: release,
    hardwareTelemetry: readSensorTelemetry(process.env.DAW_SENSOR_FILE),
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
const broadcast = () => {
  const body = `data: ${JSON.stringify(snapshot())}\n\n`;
  for (const client of clients) streamWriter.write(client, body);
};
music?.on("change", broadcast);
music?.start();
app.use(express.json({ limit: "8kb" }));
const simulatedManager=process.env.NODE_ENV!=="production"&&config.mode==="simulation"&&!process.env.DAW_MANAGER_SOCKET?simulatedDevice({snapshot,directory:process.env.DAW_STATE_DIR||".tunebox-state",onEvent:phase=>runtime.record(Date.now(),"software-update",runtime.device.mode,"Simulated update: "+phase)}):null;
const manage=request=>simulatedManager?simulatedManager.request(request):deviceRequest(request);
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
 try{r.json(await manage(q.body));}catch(error){r.status(409).json({error:String(error.message).slice(0,180)});}
});
app.get("/api/audio",(q,r)=>r.set("Cache-Control","no-store").json(audioAnalysis.get({watch:q.query.watch==="1",awake:runtime.device.displayAwake&&runtime.device.mode!=="shutdown",selectedId:music?.publicStatus().playerId})));
app.post("/api/audio/settings",(q,r)=>{
 if(!validDeviceRequest(q))return r.status(403).json({error:"Reload TuneBox before changing measurement settings"});
 try{if(!q.body||Object.keys(q.body).length!==1||!Object.hasOwn(q.body,"enabled"))throw Error("Only enabled can be changed");audioAnalysis.setEnabled(q.body.enabled);r.json(audioAnalysis.get());}catch(error){r.status(400).json({error:error.message});}
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
  runtime.dispatch({ type: "tick" }, now);
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
    music?.stop();
    audioAnalysis.close();
    for (const c of clients) c.end();
    clearInterval(clock);
    clearInterval(inventoryClock);
    clearInterval(keepalive);
    server.close(() => process.exit(0));
  });
