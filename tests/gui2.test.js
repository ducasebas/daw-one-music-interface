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
