/** Bump this release ID for every user-visible release; it is compiled into the UI. */
export const release = Object.freeze({
  id: "2026.11.25-updates.1",
  label: "GUI 3.16.6 · UPDATES",
  /** Shown on TuneBox when this update is offered. Keep it short and user-facing. */
  notes: "GUI updates keep unchanged system services running. Update tools have a smaller repair path, with clear progress after interrupted maintenance. If Music Assistant disconnects, TuneBox pauses its own amplifier automatically. The simpler message offers a connection test and no volume controls. Reconnecting keeps local audio paused until you choose Resume locally.",
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
