import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { localServerAssessment } from "../shared/host-capacity.js";
const good = {
  target: "pi4",
  arch: "aarch64",
  totalMiB: 3800,
  availableMiB: 2300,
  freeDiskMiB: 20000,
  temperatureC: 45,
  throttled: 0,
  load1: 0.5,
  cores: 4,
};
const detect = (model) =>
  spawnSync(
    "bash",
    [
      "-c",
      'source deploy/install-target.sh; daw_detect_install_target "$1"',
      "test",
      model,
    ],
    { encoding: "utf8" },
  );
test("automatic target detection is exact and refuses unknown boards and VM fallback", () => {
  assert.equal(
    detect("Raspberry Pi 3 Model B Plus Rev 1.3").stdout.trim(),
    "pi3-experimental",
  );
  assert.equal(
    detect("Raspberry Pi 3 Model B+ Rev 1.3").stdout.trim(),
    "pi3-experimental",
  );
  assert.equal(detect("Raspberry Pi 4 Model B Rev 1.5").stdout.trim(), "pi4");
  for (const model of [
    "",
    "linux,dummy-virt",
    "Raspberry Pi 3 Model B Rev 1.2",
    "Raspberry Pi 5 Model B Rev 1.0",
  ])
    assert.notEqual(detect(model).status, 0);
});
test("co-hosting snapshot admits a spacious Pi4 but never Pi3, VM or low-memory Pi4", () => {
  assert.equal(localServerAssessment(good).eligible, true);
  for (const patch of [
    { target: "pi3-experimental" },
    { target: "vm" },
    { totalMiB: 1900 },
    { availableMiB: 500 },
    { freeDiskMiB: 100 },
    { arch: "armv7l" },
  ])
    assert.equal(localServerAssessment({ ...good, ...patch }).eligible, false);
});
test("co-hosting denies unknown/faulted health and loaded or hot hosts; historical flags alone are not current faults", () => {
  for (const patch of [
    { temperatureC: null },
    { temperatureC: 70 },
    { throttled: null },
    { throttled: 0x50005 },
    { load1: 3 },
    { load1: NaN },
    { cores: 0 },
    { freeDiskMiB: NaN },
  ])
    assert.equal(localServerAssessment({ ...good, ...patch }).eligible, false);
  assert.equal(
    localServerAssessment({ ...good, throttled: 0x50000 }).eligible,
    true,
  );
});
test("invalid optional-server flags fail before installation side effects", () => {
  for (const args of [["--music-assistant", "maybe"], ["--music-assistant"]])
    assert.equal(spawnSync("bash", ["deploy/install.sh", ...args]).status, 2);
});

test("missing telemetry is denied and optional-server helper refuses Pi3 without invoking Docker", () => {
  assert.equal(localServerAssessment().eligible, false);
  const r = spawnSync(
    "bash",
    ["deploy/music-assistant-local.sh", "--install", "pi3-experimental"],
    { encoding: "utf8" },
  );
  assert.equal(r.status, 1);
  assert.match(r.stdout, /Keep Music Assistant on your existing server/);
  assert.equal(
    spawnSync("bash", ["deploy/music-assistant-local.sh", "--invalid", "pi4"])
      .status,
    2,
  );
});
