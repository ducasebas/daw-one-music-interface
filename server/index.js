import express from "express";
import { fileURLToPath } from "node:url";
import { DeviceRuntime, runScenario, scenarios } from "../shared/runtime.js";
import { musicConfig } from "./ma-config.js";
import { LiveMusicService } from "./ma-service.js";
const config = musicConfig(),
  app = express(),
  runtime = new DeviceRuntime(),
  clients = new Set();
const music =
  config.mode === "music-assistant" ? new LiveMusicService(config) : null;
runtime.dispatch({ type: "boot-complete" });
const snapshot = () => {
  const state = runtime.snapshot();
  if (music)
    return {
      ...state,
      mode: "music-assistant",
      hardwareMode: "simulation",
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
const broadcast = () => {
  const body = `data: ${JSON.stringify(snapshot())}\n\n`;
  for (const client of clients)
    if (!client.write(body)) {
      client.end();
      clients.delete(client);
    }
};
music?.on("change", broadcast);
music?.start();
app.use(express.json({ limit: "8kb" }));
app.get("/api/health", (_q, r) =>
  r.json({
    ok: true,
    mode: config.mode,
    hardware: "unverified",
    device: runtime.device.mode,
    musicAssistant: music?.publicStatus().status || "mock",
  }),
);
app.get("/api/state", (_q, r) => r.json(snapshot()));
app.get("/api/events", (q, r) => {
  r.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  r.flushHeaders();
  r.write(`data: ${JSON.stringify(snapshot())}\n\n`);
  clients.add(r);
  q.on("close", () => clients.delete(r));
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
    } else if (q.body.type === "volume" || q.body.type === "mute") {
      if (q.body.type === "volume" && !Number.isFinite(q.body.value))
        throw Error("Invalid volume");
      runtime.record(
        Date.now(),
        "preview-volume",
        runtime.device.mode,
        "Local volume preview only",
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
const keepalive = setInterval(() => {
  for (const c of clients) c.write(": heartbeat\n\n");
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
    for (const c of clients) c.end();
    clearInterval(clock);
    clearInterval(keepalive);
    server.close(() => process.exit(0));
  });
