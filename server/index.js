import express from "express";
import { fileURLToPath } from "node:url";
import { DeviceRuntime, runScenario, scenarios } from "../shared/runtime.js";
const app = express(),
  runtime = new DeviceRuntime();
runtime.dispatch({ type: "boot-complete" });
app.use(express.json({ limit: "8kb" }));
app.get("/api/health", (_q, r) =>
  r.json({
    ok: true,
    mode: "simulation",
    hardware: "unverified",
    device: runtime.device.mode,
    musicAssistant: "mock",
  }),
);
app.get("/api/state", (_q, r) => r.json(runtime.snapshot()));
app.get("/api/scenarios", (_q, r) => r.json(Object.keys(scenarios)));
app.post("/api/scenario", (q, r) => {
  try {
    r.json(runScenario(runtime, q.body.name));
  } catch (e) {
    runtime.record(Date.now(), "error", runtime.device.mode, e.message);
    r.status(400).json({ error: e.message });
  }
});
app.post("/api/event", (q, r) => {
  try {
    r.json(runtime.dispatch(q.body));
  } catch (e) {
    runtime.record(Date.now(), "error", runtime.device.mode, e.message);
    r.status(400).json({ error: e.message });
  }
});
app.use(express.static(fileURLToPath(new URL("../dist", import.meta.url))));
app.use((error, _q, r, _next) =>
  r.status(400).json({ error: "Invalid request" }),
);
const clock = setInterval(() => {
  const now = Date.now();
  if (runtime.sensors.heartbeatEnabled) runtime.sensors.lastHeartbeat = now;
  runtime.dispatch({ type: "tick" }, now);
}, 500);
clock.unref();
app.listen(
  Number(process.env.PORT || 3001),
  process.env.HOST || "127.0.0.1",
  () => console.log("DAW ONE · SIMULATED HARDWARE · http://127.0.0.1:3001"),
);
