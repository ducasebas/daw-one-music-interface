import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  symlinkSync,
  chmodSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import {
  deviceProfile,
  profileSettings,
  profileTheme,
} from "../shared/profile.js";
import { packRelease, verifyRelease } from "../deploy/release-bundle.js";
import { release } from "../shared/release.js";
test("Pi3 caps presentation without changing saved preferences or hardware permissions", () => {
  const p = deviceProfile("?profile=pi3");
  const prefs = { artwork: "video", volume: 42 };
  const theme = { tokens: { glow: 8 } };
  assert.equal(p.clockMs, 1000);
  assert.equal(profileSettings(prefs, p).artwork, "cover");
  assert.equal(prefs.artwork, "video");
  assert.equal(profileTheme(theme, p).tokens.glow, 0);
  assert.equal(theme.tokens.glow, 8);
  assert.equal(deviceProfile("?profile=anything").lowPower, false);
  assert.equal(profileSettings(prefs, deviceProfile()), prefs);
});
test("Pi3 explicitly accepts B+ ARM64 only and requires prebuilt installation", () => {
  const check = (arch, model) =>
    spawnSync("bash", [
      "-c",
      'source deploy/install-target.sh; daw_validate_install_target pi3-experimental "$1" "$2" none',
      "test",
      arch,
      model,
    ]).status;
  assert.equal(check("aarch64", "Raspberry Pi 3 Model B Plus Rev 1.3"), 0);
  for (const [arch, model] of [
    ["armv7l", "Raspberry Pi 3 Model B Plus"],
    ["aarch64", "Raspberry Pi 3 Model B Rev 1.2"],
    ["aarch64", "Raspberry Pi 4 Model B"],
    ["x86_64", "Raspberry Pi 3 Model B Plus"],
  ])
    assert.equal(check(arch, model), 1);
  const r = spawnSync(
    "bash",
    ["deploy/install.sh", "--target", "pi3-experimental"],
    { encoding: "utf8" },
  );
  assert.equal(r.status, 2);
  assert.match(r.stderr, /requires --prebuilt/);
});
test("release archive excludes development and secrets, detects corruption and stale builds", () => {
  const root = mkdtempSync(join(tmpdir(), "pi3-test-"));
  try {
    for (const dir of [
      "dist/assets",
      "server",
      "shared",
      "deploy",
      "docs",
      "node_modules",
      ".tunebox-state",
    ])
      mkdirSync(join(root, dir), { recursive: true });
    writeFileSync(join(root, "dist/index.html"), "html");
    writeFileSync(join(root, "dist/assets/app.js"), release.id);
    for (const file of [
      "package.json",
      "package-lock.json",
      "LICENSE",
      "THIRD_PARTY_NOTICES.md",
      ".env",
      "node_modules/secret",
      ".tunebox-state/boot.json",
    ])
      writeFileSync(join(root, file), "{}");
    chmodSync(join(root,"package.json"),0o600);
    chmodSync(join(root,"server"),0o700);
    const archive = join(root, "bundle.tar.gz");
    packRelease(root, archive);
    const listing = execFileSync("tar", ["-tzf", archive], {
      encoding: "utf8",
    });
    assert.doesNotMatch(listing, /node_modules|\.env|\.tunebox-state/);
    assert.match(listing, /^LICENSE$/m);
    assert.match(listing, /^THIRD_PARTY_NOTICES\.md$/m);
    const out = join(root, "out");
    mkdirSync(out);
    execFileSync("tar", ["-xzpf", archive, "-C", out]);
    assert.equal(verifyRelease(out).release, release.id);
    assert.equal(statSync(join(out,"package.json")).mode & 0o777,0o644);
    assert.equal(statSync(join(out,"server")).mode & 0o777,0o755);
    assert.equal(statSync(join(out,"release-manifest.json")).mode & 0o777,0o644);
    writeFileSync(join(out, "package.json"), "changed");
    assert.throws(() => verifyRelease(out), /integrity/);
    writeFileSync(join(root, "dist/assets/app.js"), "old-release");
    assert.throws(() => packRelease(root, archive), /release ID/);
    writeFileSync(join(root, "dist/assets/app.js"), release.id);
    symlinkSync("/etc/passwd", join(root, "docs/link"));
    assert.throws(() => packRelease(root, archive), /symlinks/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
