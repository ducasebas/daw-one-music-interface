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
// User activity affects the shared display timer, never MA playback or verification.
app.post("/api/activity", (_q, r) => {
  const awake = runtime.device.displayAwake;
  runtime.dispatch({ type: "activity" });
  if (awake !== runtime.device.displayAwake) broadcast();
  r.json({ ok: true });
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
