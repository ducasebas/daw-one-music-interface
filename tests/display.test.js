import { test } from "node:test";
import assert from "node:assert/strict";
import { displayMode, displayGeometry } from "../shared/display.js";
test("explicit display modes and legacy kiosk route use fixed production components", () => {
  assert.equal(displayMode("?display=hdmi-development"), "hdmi-development");
  assert.equal(
    displayMode("?screen=1&display=dsi-production"),
    "dsi-production",
  );
  assert.equal(displayMode("?screen=1"), "dsi-production");
  assert.equal(displayMode("?display=unknown"), null);
  assert.equal(displayMode("?lab=1"), null);
});
test("HDMI remains native 1280x400 on Full HD and scales down only for smaller monitors", () => {
  assert.deepEqual(displayGeometry("hdmi-development", 1920, 1080), {
    width: 1280,
    height: 400,
    scale: 1,
    renderedWidth: 1280,
    renderedHeight: 400,
  });
  assert.equal(displayGeometry("hdmi-development", 3840, 2160).scale, 1);
  const small = displayGeometry("hdmi-development", 1024, 768);
  assert.equal(small.width, 1280);
  assert.equal(small.height, 400);
  assert.equal(small.scale, 0.8);
  assert.equal(displayGeometry("dsi-production", 1280, 400).scale, 1);
  assert.equal(displayGeometry("dsi-production", 1024, 768).scale, 1);
});

test("kiosk scripts reject unknown modes before contacting hardware or changing configuration", async () => {
  const { spawnSync } = await import("node:child_process");
  for (const file of ["kiosk.sh", "set-display-mode.sh"]) {
    const args =
      file === "kiosk.sh" ? ["--mode", "unsupported"] : ["unsupported"];
    const result = spawnSync(
      "bash",
      [new URL(`../deploy/${file}`, import.meta.url).pathname, ...args],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 2);
  }
});
