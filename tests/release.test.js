import test from "node:test";
import assert from "node:assert/strict";
import { release, buildAlignment } from "../shared/release.js";
test("build alignment distinguishes old, missing and offline backends", () => {
  assert.equal(buildAlignment(release, release), "matched");
  assert.equal(buildAlignment(release, { id: "old" }), "mismatch");
  assert.equal(buildAlignment(release, null), "unknown");
  assert.equal(buildAlignment(release, release, true), "offline");
});
