import test from "node:test";
import assert from "node:assert/strict";
import { DeviceRuntime, runScenario } from "../shared/runtime.js";
test("GUI2 queue actions share runtime and never bypass latched amplifier faults", () => {
  const r = new DeviceRuntime();
  runScenario(r, "Playback");
  r.dispatch({ type: "amplifier-fault" });
  r.dispatch({ type: "queue-add", id: "horizon", next: true });
  assert.equal(r.playback.queue[1].title, "A Walk");
  r.dispatch({ type: "queue-select", id: r.playback.queue[1].id });
  assert.equal(r.playback.index, 1);
  assert.equal(r.device.amplifierEnabled, false);
  assert.ok(r.device.faults.length);
});
test("queue removal preserves current track and rejects removal of current or unknown item", () => {
  const r = new DeviceRuntime();
  r.dispatch({ type: "queue-select", id: "night" });
  r.dispatch({ type: "queue-remove", id: "aurora" });
  assert.equal(r.playback.queue[r.playback.index].id, "night");
  assert.throws(() => r.dispatch({ type: "queue-remove", id: "night" }));
  assert.throws(() => r.dispatch({ type: "queue-add", id: "missing" }));
  assert.equal(r.playback.queue.length, 2);
});

test("continuous user activity postpones display timeout without changing playback or safety", () => {
  const r = new DeviceRuntime(0);
  runScenario(r, "Playback", 0);
  for (const now of [20000, 40000, 60000]) {
    r.sensors.lastHeartbeat = now;
    r.dispatch({ type: "activity" }, now);
    r.dispatch({ type: "tick" }, now + 1000);
    assert.equal(r.device.displayAwake, true);
  }
  r.sensors.lastHeartbeat = 92000;
  r.dispatch({ type: "tick" }, 92000);
  assert.equal(r.device.displayAwake, false);
  assert.equal(r.playback.playing, true);
  const enabled = r.device.amplifierEnabled;
  r.dispatch({ type: "activity" }, 92001);
  assert.equal(r.device.displayAwake, true);
  assert.equal(r.device.amplifierEnabled, enabled);
  r.dispatch({ type: "amplifier-fault" }, 93000);
  r.dispatch({ type: "activity" }, 94000);
  assert.equal(r.device.mode, "fault");
  assert.equal(r.device.amplifierEnabled, false);
  assert.equal(r.device.verified, false);
  const standby = new DeviceRuntime(0);
  runScenario(standby, "Standby", 0);
  standby.dispatch({ type: "activity" }, 1000);
  assert.equal(standby.device.mode, "standby");
  assert.equal(standby.device.amplifierEnabled, false);
});
