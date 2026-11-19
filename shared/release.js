/** Bump this release ID for every user-visible release; it is compiled into the UI. */
export const release = Object.freeze({
  id: "2026.11.19-lively.2",
  label: "GUI 3.11.1 · STYLE",
  /** Shown on TuneBox when this update is offered. Keep it short and user-facing. */
  notes: "Style: Inter is the new, easy-to-read interface font everywhere, with Manrope Heavy or your skin font as alternatives under Appearance. Settings now shows the same soft album-art background as Now Playing. Mute also works on players without a built-in mute, and restores exactly your previous volume.",
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
