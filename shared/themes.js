/** Theme schema v1. Only whitelisted tokens reach CSS; no arbitrary CSS is stored. */
export const tokenSchema = {
  background: { type: "color", label: "Background" },
  surface: { type: "color", label: "Panel color" },
  text: { type: "color", label: "Text" },
  muted: { type: "color", label: "Secondary text" },
  accent: { type: "color", label: "Accent" },
  borderColor: { type: "color", label: "Border color" },
  glowColor: { type: "color", label: "Glow color" },
  meterColor: { type: "color", label: "Meter color" },
  font: {
    type: "enum",
    label: "Typography",
    values: ["sans", "serif", "mono"],
  },
  panelOpacity: {
    type: "number",
    label: "Panel opacity",
    min: 0,
    max: 1,
    step: 0.05,
  },
  spacing: {
    type: "number",
    label: "Spacing",
    min: 0.85,
    max: 1.1,
    step: 0.05,
  },
  radius: { type: "number", label: "Corner radius", min: 0, max: 18, step: 1 },
  borderWidth: {
    type: "number",
    label: "Border width",
    min: 0,
    max: 2,
    step: 0.5,
  },
  glow: { type: "number", label: "Glow intensity", min: 0, max: 24, step: 1 },
  meter: {
    type: "enum",
    label: "Meter style",
    values: ["bars", "dots", "line"],
  },
};
const base = {
  background: "#111512",
  surface: "#253020",
  text: "#e7e9e3",
  muted: "#a3b19a",
  accent: "#c3d7a9",
  borderColor: "#40513a",
  glowColor: "#b6cf9a",
  meterColor: "#a5be8c",
  font: "sans",
  panelOpacity: 0.4,
  spacing: 1,
  radius: 5,
  borderWidth: 1,
  glow: 0,
  meter: "bars",
};
export const presets = [
  {
    id: "reference-dark",
    name: "Reference Dark",
    tokens: base,
    diagnostics: false,
  },
  {
    id: "warm-bronze",
    name: "Warm Bronze",
    tokens: {
      ...base,
      background: "#1b1512",
      surface: "#4c3023",
      text: "#f0e5db",
      muted: "#c9ad96",
      accent: "#e6ae7e",
      borderColor: "#6e4d39",
      glowColor: "#d88a4f",
      meterColor: "#dca171",
      radius: 8,
      glow: 5,
    },
    diagnostics: false,
  },
  {
    id: "champagne-gold",
    name: "Champagne Gold",
    tokens: {
      ...base,
      background: "#24211a",
      surface: "#4c4431",
      text: "#fff4dc",
      muted: "#cfc09e",
      accent: "#eed49a",
      borderColor: "#786949",
      glowColor: "#e3ca85",
      meterColor: "#e9ca83",
      font: "serif",
      panelOpacity: 0.65,
      radius: 3,
      meter: "line",
    },
    diagnostics: false,
  },
  {
    id: "cinematic",
    name: "Cinematic",
    tokens: {
      ...base,
      background: "#0c101c",
      surface: "#19233d",
      text: "#edf0ff",
      muted: "#adb8d6",
      accent: "#b6c7ff",
      borderColor: "#394b7a",
      glowColor: "#7b98ff",
      meterColor: "#a4baff",
      panelOpacity: 0.3,
      radius: 12,
      glow: 15,
      meter: "line",
    },
    diagnostics: false,
  },
  {
    id: "nerd-mode",
    name: "Nerd Mode",
    tokens: {
      ...base,
      background: "#07130f",
      surface: "#0e3126",
      text: "#ddffeb",
      muted: "#8ec6a8",
      accent: "#7cf5b1",
      borderColor: "#297d52",
      glowColor: "#2deb88",
      meterColor: "#7cf5b1",
      font: "mono",
      panelOpacity: 0.6,
      radius: 0,
      glow: 8,
      meter: "dots",
    },
    diagnostics: true,
  },
];
export function sanitizeTokens(input = {}) {
  const out = { ...base };
  if (!input || typeof input !== "object") return out;
  for (const [key, schema] of Object.entries(tokenSchema)) {
    const v = input[key];
    if (
      schema.type === "color" &&
      typeof v === "string" &&
      /^#[0-9a-f]{6}$/i.test(v)
    )
      out[key] = v;
    if (schema.type === "enum" && schema.values.includes(v)) out[key] = v;
    if (schema.type === "number" && Number.isFinite(v))
      out[key] = Math.min(schema.max, Math.max(schema.min, v));
  }
  return out;
}
export function sanitizeTheme(t) {
  return {
    id: typeof t?.id === "string" ? t.id.slice(0, 80) : "draft",
    name:
      typeof t?.name === "string"
        ? t.name.trim().slice(0, 48) || "My theme"
        : "My theme",
    tokens: sanitizeTokens(t?.tokens),
    diagnostics: t?.diagnostics === true,
  };
}
export const defaultThemePreferences = {
  version: 1,
  selected: "reference-dark",
  mode: "manual",
  day: "champagne-gold",
  night: "reference-dark",
  dayStart: 7,
  nightStart: 19,
  stateThemes: {
    fault: "nerd-mode",
    standby: "cinematic",
    playing: "warm-bronze",
    offline: "reference-dark",
  },
  custom: [],
  draft: null,
};
export function normalizeThemePreferences(raw) {
  const p = raw && typeof raw === "object" ? raw : {};
  const custom = Array.isArray(p.custom)
    ? p.custom
        .filter(
          (t) => t && typeof t.id === "string" && /^custom-[\w-]+$/.test(t.id),
        )
        .slice(0, 20)
        .map(sanitizeTheme)
    : [];
  const ids = new Set([...presets, ...custom].map((t) => t.id));
  const unique = [...new Map(custom.map((t) => [t.id, t])).values()];
  const valid = (id, fallback) => (ids.has(id) ? id : fallback);
  return {
    ...defaultThemePreferences,
    custom: unique,
    draft: p.draft ? sanitizeTheme(p.draft) : null,
    selected:
      p.selected === "draft" && p.draft
        ? "draft"
        : valid(p.selected, "reference-dark"),
    mode: ["manual", "schedule", "state"].includes(p.mode) ? p.mode : "manual",
    day: valid(p.day, "champagne-gold"),
    night: valid(p.night, "reference-dark"),
    dayStart: Number.isInteger(p.dayStart)
      ? Math.max(0, Math.min(23, p.dayStart))
      : 7,
    nightStart: Number.isInteger(p.nightStart)
      ? Math.max(0, Math.min(23, p.nightStart))
      : 19,
    stateThemes: Object.fromEntries(
      Object.entries(defaultThemePreferences.stateThemes).map(([state, id]) => [
        state,
        valid(p.stateThemes?.[state], id),
      ]),
    ),
  };
}
export function isDayHour(hour, start, end) {
  if (start === end) return false;
  return start < end
    ? hour >= start && hour < end
    : hour >= start || hour < end;
}
export function resolveTheme(raw, context = {}, date = new Date()) {
  const p = normalizeThemePreferences(raw);
  let id = p.selected,
    reason = "Manual selection";
  if (p.mode === "schedule") {
    const day = isDayHour(date.getHours(), p.dayStart, p.nightStart);
    id = day ? p.day : p.night;
    reason = `${day ? "Day" : "Night"} schedule · browser local time`;
  }
  if (p.mode === "state") {
    const state =
      context.device?.mode === "fault"
        ? "fault"
        : context.offline
          ? "offline"
          : context.device?.mode === "standby" ||
              context.device?.mode === "shutting-down"
            ? "standby"
            : context.playback?.playing
              ? "playing"
              : null;
    if (state) {
      id = p.stateThemes[state];
      reason = `Device state · ${state}`;
    } else reason = "Device state · manual fallback";
  }
  const theme =
    id === "draft" && p.draft
      ? p.draft
      : [...presets, ...p.custom].find((t) => t.id === id) || presets[0];
  return { ...theme, reason };
}
export function saveCustomTheme(raw, draft, id) {
  const p = normalizeThemePreferences(raw);
  if (!/^custom-[\w-]+$/.test(id)) throw Error("Invalid custom theme ID");
  if (p.custom.length >= 20 && !p.custom.some((t) => t.id === id))
    throw Error("Maximum 20 custom themes");
  const theme = { ...sanitizeTheme(draft), id };
  return normalizeThemePreferences({
    ...p,
    custom: [...p.custom.filter((t) => t.id !== id), theme],
    selected: id,
    mode: "manual",
    draft: null,
  });
}
export function themeVariables(theme) {
  const t = sanitizeTokens(theme.tokens);
  return {
    "--background": t.background,
    "--surface": t.surface,
    "--text": t.text,
    "--muted": t.muted,
    "--accent": t.accent,
    "--border-color": t.borderColor,
    "--glow-color": t.glowColor,
    "--meter-color": t.meterColor,
    "--font": {
      sans: 'Inter, "Segoe UI", sans-serif',
      serif: "Georgia, serif",
      mono: '"SFMono-Regular", Consolas, monospace',
    }[t.font],
    "--panel-opacity": t.panelOpacity,
    "--space": t.spacing,
    "--radius": `${t.radius}px`,
    "--border-width": `${t.borderWidth}px`,
    "--glow": `${t.glow}px`,
  };
}
