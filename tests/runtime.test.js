import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DeviceRuntime,
  runScenario,
  scenarios,
  policy,
} from "../shared/runtime.js";
for (const name of Object.keys(scenarios))
  test(`full virtual device scenario: ${name}`, () => {
    const r = new DeviceRuntime(10000);
    runScenario(r, "Playback", 10000);
    const s = runScenario(r, name, 10000);
    assert.ok(
      s.log.some((e) => e.type === "scenario" && e.reason === `Start ${name}`),
    );
    assert.ok(s.log.every((e) => e.simulated && e.at));
    if (
      [
        "Network loss",
        "Low voltage",
        "Thermal fault",
        "Controller disconnect",
        "Safe shutdown",
        "Standby",
        "Cold boot",
      ].includes(name)
    )
      assert.equal(s.device.amplifierEnabled, false);
    if (name === "Controller disconnect") {
      assert.ok(s.device.faults.includes("uart-timeout"));
      assert.ok(s.log.some((e) => e.type === "watchdog"));
    }
    if (name === "Playback") assert.equal(s.device.amplifierEnabled, true);
  });
test("sensor and button controls use same runtime; display sleep preserves playback", () => {
  const r = new DeviceRuntime(0);
  runScenario(r, "Playback", 0);
  r.dispatch({ type: "ambient", value: 12 }, 1);
  assert.equal(r.sensors.ambient, 12);
  r.dispatch({ type: "heartbeat" }, policy.displayTimeoutMs + 1);
  r.dispatch({ type: "tick" }, policy.displayTimeoutMs + 1);
  assert.equal(r.device.displayAwake, false);
  assert.equal(r.device.playing, true);
  r.dispatch(
    { type: "button", button: "play-pause" },
    policy.displayTimeoutMs + 2,
  );
  assert.equal(r.device.playing, false);
});
test("fault cannot be bypassed by simulated verification; sensor safety prerequisite enforced", () => {
  const r = new DeviceRuntime(0);
  r.dispatch({ type: "boot-complete" }, 0);
  r.dispatch({ type: "simulation-verified" }, 0);
  assert.equal(r.device.verified, false);
  runScenario(r, "Playback", 0);
  r.dispatch({ type: "amplifier-fault" }, 1);
  r.dispatch({ type: "simulation-verified" }, 2);
  assert.equal(r.device.amplifierEnabled, false);
  assert.equal(r.device.verified, false);
});
test("network recovery explicit; sensor and malformed command validation", () => {
  const r = new DeviceRuntime(0);
  runScenario(r, "Playback", 0);
  r.dispatch({ type: "wifi", value: false }, 1);
  r.dispatch({ type: "reconnect" }, 2);
  assert.equal(r.playback.connected, false);
  r.dispatch({ type: "wifi", value: true }, 3);
  r.dispatch({ type: "reconnect" }, 4);
  assert.equal(r.playback.connected, true);
  assert.throws(() => r.dispatch({ type: "temperature", value: "bad" }));
  assert.throws(() => r.dispatch({ type: "power-good", value: "yes" }));
});
