import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const policy = new URL("../deploy/install-target.sh", import.meta.url).pathname;
function check(target, architecture, model, virtualization) {
  return spawnSync(
    "bash",
    [
      "-c",
      'source "$1"; daw_validate_install_target "$2" "$3" "$4" "$5"',
      "check",
      policy,
      target,
      architecture,
      model,
      virtualization,
    ],
    { encoding: "utf8" },
  ).status;
}
test("Pi remains the default target policy and a non-Pi is rejected", () => {
  assert.equal(
    check("pi4", "aarch64", "Raspberry Pi 4 Model B Rev 1.5", "none"),
    0,
  );
  assert.equal(check("pi4", "aarch64", "linux,dummy-virt", "qemu"), 1);
});
test("VM installation requires explicit VM detection and ARM64, never a fake Pi model", () => {
  assert.equal(check("vm", "aarch64", "linux,dummy-virt", "qemu"), 0);
  assert.equal(check("vm", "aarch64", "", "apple"), 0);
  assert.equal(check("vm", "aarch64", "", "none"), 1);
  assert.equal(check("vm", "aarch64", "", ""), 1);
  assert.equal(check("vm", "x86_64", "", "qemu"), 1);
  assert.equal(check("invalid", "aarch64", "", "qemu"), 2);
});
