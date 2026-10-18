import { test } from "node:test";
import assert from "node:assert/strict";
import {
  presets,
  tokenSchema,
  sanitizeTokens,
  normalizeThemePreferences,
  resolveTheme,
  saveCustomTheme,
  themeVariables,
  isDayHour,
} from "../shared/themes.js";
test("all six presets share the complete token contract", () => {
  assert.deepEqual(
    presets.map((t) => t.name),
    [
      "Reference Dark",
      "Minimal Dark",
      "Warm Bronze",
      "Champagne Gold",
      "Cinematic",
      "Nerd Mode",
    ],
  );
  for (const t of presets)
    assert.deepEqual(
      Object.keys(t.tokens).sort(),
      Object.keys(tokenSchema).sort(),
    );
  assert.equal(presets.find((t) => t.id === "nerd-mode").diagnostics, true);
});
test("tokens reject CSS injection, unknown fields and clamp numeric ranges", () => {
  const t = sanitizeTokens({
    accent: "url(https://evil)",
    font: "evil",
    glow: 100,
    radius: -1,
    spacing: NaN,
    extra: "x",
  });
  assert.equal(t.accent, presets[0].tokens.accent);
  assert.equal(t.font, "sans");
  assert.equal(t.glow, 24);
  assert.equal(t.radius, 0);
  assert.equal(t.spacing, 1);
  assert.equal("extra" in t, false);
  assert.equal(sanitizeTokens(null).font, "sans");
});
test("custom themes save immutably and survive serialized local storage data", () => {
  const original = normalizeThemePreferences();
  const p = saveCustomTheme(
    original,
    { name: " Studio ", tokens: { accent: "#abcdef" } },
    "custom-test",
  );
  assert.equal(original.custom.length, 0);
  assert.equal(p.custom[0].name, "Studio");
  const restored = normalizeThemePreferences(JSON.parse(JSON.stringify(p)));
  assert.equal(resolveTheme(restored).tokens.accent, "#abcdef");
  assert.equal(resolveTheme(restored).id, "custom-test");
  assert.throws(() => saveCustomTheme(p, {}, "invalid"));
});
test("malformed preferences and deleted IDs fall back safely", () => {
  for (const v of [null, [], 42, "bad"])
    assert.equal(normalizeThemePreferences(v).selected, "reference-dark");
  const p = normalizeThemePreferences({
    selected: "deleted",
    mode: "x",
    custom: [null, { id: "reference-dark" }],
    dayStart: 88,
  });
  assert.equal(p.selected, "reference-dark");
  assert.equal(p.mode, "manual");
  assert.equal(p.custom.length, 0);
  assert.equal(p.dayStart, 23);
});
test("day/night boundaries, wraparound and equal hours are deterministic", () => {
  const p = { mode: "schedule", dayStart: 7, nightStart: 19 };
  for (const [h, id] of [
    [6, "reference-dark"],
    [7, "champagne-gold"],
    [18, "champagne-gold"],
    [19, "reference-dark"],
  ])
    assert.equal(resolveTheme(p, {}, new Date(2026, 0, 1, h)).id, id);
  assert.equal(isDayHour(23, 20, 6), true);
  assert.equal(isDayHour(5, 20, 6), true);
  assert.equal(isDayHour(6, 20, 6), false);
  assert.equal(isDayHour(12, 7, 7), false);
});
test("state auto switching prioritizes fault then offline then standby then playback", () => {
  const p = { mode: "state" };
  assert.equal(
    resolveTheme(p, {
      device: { mode: "fault" },
      offline: true,
      playback: { playing: true },
    }).id,
    "nerd-mode",
  );
  assert.equal(resolveTheme(p, { offline: true }).id, "reference-dark");
  assert.equal(
    resolveTheme(p, { device: { mode: "standby" } }).id,
    "cinematic",
  );
  assert.equal(
    resolveTheme(p, { playback: { playing: true } }).id,
    "warm-bronze",
  );
  assert.equal(resolveTheme(p, {}).id, "reference-dark");
});
test("CSS variables are shared and always sanitized", () => {
  const v = themeVariables({ tokens: { font: "injected", accent: "bad" } });
  assert.equal(v["--accent"], presets[0].tokens.accent);
  assert.ok(v["--font"].includes("Manrope"));
  assert.equal(v["--radius"], "5px");
});
test("Nerd diagnostics can inherit a selected palette without changing shared tokens", () => {
  const bronze = presets.find((t) => t.id === "warm-bronze");
  const p = normalizeThemePreferences({
    selected: "nerd-mode",
    diagnosticPalette: bronze.tokens,
  });
  const t = resolveTheme(p);
  assert.equal(t.diagnostics, true);
  assert.equal(t.tokens.accent, bronze.tokens.accent);
  assert.equal(presets[0].tokens.accent, "#c9a674");
});
