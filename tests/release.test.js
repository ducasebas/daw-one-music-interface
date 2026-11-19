import test from "node:test";
import assert from "node:assert/strict";
import { release, buildAlignment } from "../shared/release.js";
test("build alignment distinguishes old, missing and offline backends", () => {
  assert.equal(buildAlignment(release, release), "matched");
  assert.equal(buildAlignment(release, { id: "old" }), "mismatch");
  assert.equal(buildAlignment(release, null), "unknown");
  assert.equal(buildAlignment(release, release, true), "offline");
});
import { releaseTitle } from "../shared/release.js";
test("the startup title names the update first, then the version", () => {
  assert.equal(releaseTitle({ label: "GUI 3.10.0 · POLISH" }), "Polish · GUI 3.10.0");
  assert.equal(releaseTitle({ label: "GUI 3.9.0 · REMOTE" }), "Remote · GUI 3.9.0");
  assert.equal(releaseTitle({ label: "Custom build" }), "Custom build");
  assert.equal(releaseTitle({}), "");
  assert.match(releaseTitle(), /^\S.* · GUI \d+\.\d+\.\d+$/);
});
