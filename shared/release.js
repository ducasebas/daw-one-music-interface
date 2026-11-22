/** Bump this release ID for every user-visible release; it is compiled into the UI. */
export const release = Object.freeze({
  id: "2026.11.22-hotfix.1",
  label: "GUI 3.16.1 · HOTFIX",
  /** Shown on TuneBox when this update is offered. Keep it short and user-facing. */
  notes: "Stability and audio tuning for Raspberry Pi 4 + Louder HAT: continuous Squeezelite playback without ALSA close hangs, 44.1–96 kHz sample-rate protection, settle delay and gentler DSP ramping, 60 fps visualizer capture, Chromium Wayland stability, and disabled Wi-Fi powersave.",
});
/** "GUI 3.10.0 · POLISH" → "Polish · GUI 3.10.0": the update name first, then the version. */
export function releaseTitle(value = release) {
  const label = String(value?.label || "").trim();
  const match = /^(GUI\s+[\d.]+)\s*·\s*(.+)$/u.exec(label);
  if (!match) return label;
  const name = match[2].trim().toLocaleLowerCase("en").replace(/(^|\s)\p{L}/gu, (c) => c.toLocaleUpperCase("en"));
  return `${name} · ${match[1]}`;
}
export function buildAlignment(frontend, backend, offline = false) {
  if (offline) return "offline";
  if (!backend?.id) return "unknown";
  return frontend.id === backend.id ? "matched" : "mismatch";
}
