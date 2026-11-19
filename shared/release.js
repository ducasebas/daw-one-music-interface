/** Bump this release ID for every user-visible release; it is compiled into the UI. */
export const release = Object.freeze({
  id: "2026.11.19-offline.1",
  label: "GUI 3.13.0 · OFFLINE",
  /** Shown on TuneBox when this update is offered. Keep it short and user-facing. */
  notes: "Offline: when Music Assistant is unreachable, Now Playing still lets you pause and change the volume on this TuneBox, never louder than before. Developer → Services now guides you through running Music Assistant on the TuneBox itself, with a setup QR and a one-tap connect.",
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
