import { test } from "node:test";
import assert from "node:assert/strict";
import { smoothTemperature } from "../shared/sensor-display.js";
test("temperature display suppresses small jitter but responds quickly to rising heat", () => {
  const a = smoothTemperature(null, 20, 1000),
    slow = smoothTemperature(a, 20.125, 4000),
    fast = smoothTemperature(a, 22, 4000);
  assert.ok(slow.value < 20.05);
  assert.ok(fast.value > 21.5);
  assert.equal(a.raw, 20);
});
test("same timestamps do not advance filtering; failed samples clear and long gaps reset", () => {
  const a = smoothTemperature(null, 20, 1000);
  assert.equal(smoothTemperature(a, 30, 1000), a);
  assert.equal(smoothTemperature(a, null, 4000), null);
  assert.equal(smoothTemperature(a, 30, 20000).value, 30);
});
