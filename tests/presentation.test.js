import { test } from "node:test";
import assert from "node:assert/strict";
import { DeviceRuntime, runScenario } from "../shared/runtime.js";
import { devicePresentation } from "../shared/presentation.js";
const setup = () => {
  const r = new DeviceRuntime(1000);
  runScenario(r, "Playback", 1000);
  return r;
};
test("case speakers only show drive when shared safety gate and playback permit it", () => {
  const r = setup();
  assert.equal(
    devicePresentation(r.snapshot(1000), { now: 1000 }).driven,
    true,
  );
  r.dispatch({ type: "amplifier-fault" }, 1001);
  const p = devicePresentation(r.snapshot(1001), { now: 1001 });
  assert.equal(p.driven, false);
  assert.equal(p.led, "fault");
  assert.equal(p.modules.find((m) => m.id === "amplifier").status, "fault");
});
test("display sleep preserves simulated speaker drive; standby removes it and lights amber", () => {
  const r = setup();
  r.dispatch({ type: "display-timeout" }, 1001);
  const p = devicePresentation(r.snapshot(1001), { now: 1001 });
  assert.equal(p.displayAwake, false);
  assert.equal(p.driven, true);
  r.dispatch({ type: "button", button: "standby" }, 1002);
  assert.equal(
    devicePresentation(r.snapshot(1002), { now: 1002 }).led,
    "standby",
  );
  assert.equal(
    devicePresentation(r.snapshot(1002), { now: 1002 }).driven,
    false,
  );
  r.dispatch({ type: "button", button: "wake" }, 1003);
  assert.equal(r.device.mode, "ready");
});
test("offline, stale heartbeat, muted preview and unverified boot never show active speakers", () => {
  const r = setup(),
    s = r.snapshot(1000);
  assert.equal(
    devicePresentation(s, { offline: true, now: 1000 }).driven,
    false,
  );
  assert.ok(
    devicePresentation(s, { offline: true, now: 1000 }).modules.every(
      (m) => m.status === "unknown",
    ),
  );
  assert.equal(devicePresentation(s, { now: 5000 }).driven, false);
  assert.equal(devicePresentation(s, { volume: 0, now: 1000 }).driven, false);
  runScenario(r, "Cold boot", 2000);
  r.dispatch({ type: "play" }, 2001);
  assert.equal(
    devicePresentation(r.snapshot(2001), { now: 2001 }).driven,
    false,
  );
});
