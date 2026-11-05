import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  bootReport,
  bootSettings,
  BootMonitor,
  ColdBootRadio,
  initialBootInputs,
} from "../shared/boot.js";
import { DeviceRuntime, runScenario } from "../shared/runtime.js";
import { BootStore } from "../server/boot-store.js";
const safe = () => ({
  simulated: true,
  device: { mode: "ready", verified: true, controllerReady: true },
  sensors: { powerGood: true, temperature: 35, wifi: true },
  playback: { connected: true, playing: false },
  inputs: initialBootInputs(),
});
test("live checks never invent PD, optical, fan or amplifier verification", () => {
  const report = bootReport({
    simulated: false,
    device: { mode: "ready", verified: true },
    inventory: {
      networkReady: true,
      temperatureC: 42,
      audioCards: ["USB DAC"],
    },
    music: { connected: true, playerId: "pi" },
    playback: { connected: true },
  });
  for (const id of ["power", "hardware", "digital", "fan"])
    assert.notEqual(report.checks.find((c) => c.id === id).status, "pass");
  assert.equal(report.phase, "attention");
  assert.equal(report.displayControl, "unavailable");
  assert.equal(report.checks.find((c) => c.id === "audio").status, "pass");
});
test("boot reports offline and hot states without blocking access to local UI", () => {
  const s = safe();
  const report = bootReport({
    ...s,
    sensors: { ...s.sensors, wifi: false, temperature: 90 },
  });
  assert.equal(report.phase, "offline");
  assert.equal(
    report.checks.find((c) => c.id === "temperature").status,
    "fail",
  );
});
test("boot monitor logs each changed reason once, without duplicate periodic events", () => {
  const b = new BootMonitor(),
    log = [],
    write = (...args) => log.push(args),
    r = bootReport();
  b.update(r, write, 1);
  const n = log.length;
  b.update(r, write, 2);
  assert.equal(log.length, n);
  b.update({ ...r, phase: "ready" }, write, 3);
  assert.equal(log.length, n + 1);
});
test("autoradio defaults off, is one-shot and never starts real playback", () => {
  assert.equal(new ColdBootRadio().consider(safe()), null);
  const radio = new ColdBootRadio({ radioEnabled: true, volume: 99 });
  assert.equal(radio.consider(safe()).volume, 40);
  assert.equal(radio.consider(safe()), null);
  const live = new ColdBootRadio({ radioEnabled: true });
  assert.equal(live.consider({ ...safe(), simulated: false }), null);
  assert.equal(live.status, "blocked-live-adapter");
});
test("autoradio rejects unsafe or incomplete checks; reconnect or group changes do not replay a skipped decision", () => {
  for (const patch of [
    (s) => (s.device.verified = false),
    (s) => (s.inputs.pdWatts = null),
    (s) => (s.inputs.pdWatts = 60),
    (s) => (s.sensors.powerGood = false),
    (s) => (s.sensors.temperature = null),
    (s) => (s.sensors.temperature = 90),
    (s) => (s.sensors.wifi = false),
    (s) => (s.playback.connected = false),
    (s) => {
      s.inputs.fanExpected = true;
      s.inputs.fanRpm = 0;
    },
  ]) {
    const s = safe();
    patch(s);
    assert.equal(new ColdBootRadio({ radioEnabled: true }).consider(s), null);
  }
  for (const patch of [
    (s) => (s.inputs.groupActive = true),
    (s) => (s.playback.playing = true),
    (s) => (s.device.mode = "standby"),
    (s) => (s.device.mode = "fault"),
  ]) {
    const s = safe();
    patch(s);
    const r = new ColdBootRadio({ radioEnabled: true });
    assert.equal(r.consider(s), null);
    assert.equal(r.consider(safe()), null);
  }
});
test("simulated cold boot starts a configured radio once; wake and reconnect do not restart it", () => {
  const r = new DeviceRuntime(1000, {
    radioEnabled: true,
    station: "classical",
    volume: 12,
  });
  r.dispatch({ type: "boot-complete" }, 1000);
  r.dispatch({ type: "power-good", value: true }, 1000);
  r.dispatch({ type: "simulation-verified" }, 1000);
  assert.equal(r.playback.queue[0].id, "mock-radio-classical");
  assert.equal(r.audio.volume, 12);
  assert.equal(r.device.amplifierEnabled, true);
  r.dispatch({ type: "tick" }, 2000);
  assert.equal(r.playback.queue[0].id, "mock-radio-classical");
  r.dispatch({ type: "standby" }, 2001);
  r.dispatch({ type: "presence" }, 2002);
  r.dispatch({ type: "reconnect" }, 2003);
  assert.equal(r.playback.playing, false);
  assert.equal(r.log.filter((e) => e.type === "autoradio").length, 1);
});
test("required power and fan faults inhibit an already enabled simulated amplifier", () => {
  for (const event of [
    { type: "startup-signal", key: "pdWatts", value: 60 },
    { type: "startup-signal", key: "pdWatts", value: null },
    { type: "startup-signal", key: "fanExpected", value: true },
  ]) {
    const r = new DeviceRuntime(1000);
    runScenario(r, "Playback", 1000);
    r.dispatch(event, 1001);
    assert.equal(r.device.amplifierEnabled, false);
    r.dispatch({ type: "simulation-verified" }, 1002);
    assert.equal(r.device.amplifierEnabled, false);
  }
});
test("server boot settings survive restart, sanitize input and tolerate corrupted data", () => {
  const dir = mkdtempSync(join(tmpdir(), "tunebox-boot-"));
  try {
    const store = new BootStore(dir);
    assert.equal(store.load().radioEnabled, false);
    store.save({ radioEnabled: true, station: "classical", volume: 25 });
    assert.deepEqual(new BootStore(dir).load(), {
      radioEnabled: true,
      station: "classical",
      volume: 25,
    });
    writeFileSync(join(dir, "boot.json"), "invalid");
    assert.deepEqual(store.load(), bootSettings());
    assert.equal(
      bootSettings({
        radioEnabled: "yes",
        volume: Infinity,
        station: "<script>",
      }).radioEnabled,
      false,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("failed initial network check cannot become an autoplay on reconnect", () => {
  const radio = new ColdBootRadio({ radioEnabled: true });
  const s = safe();
  s.sensors.wifi = false;
  assert.equal(radio.consider(s), null);
  assert.equal(radio.status, "skipped-offline");
  assert.equal(radio.consider(safe()), null);
});

test("optional absent digital/fan devices do not create a false startup warning",()=>{
 const r=bootReport(safe());assert.equal(r.phase,"ready");assert.equal(r.checks.find(c=>c.id==="digital").status,"optional");
});
