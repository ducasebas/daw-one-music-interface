/** Bump this release ID for every user-visible release; it is compiled into the UI. */
export const release = Object.freeze({
  id: "2026.11.19-party.1",
  label: "GUI 3.12.0 · PARTY",
  /** Shown on TuneBox when this update is offered. Keep it short and user-facing. */
  notes: "Party: tap the Party widget on Now Playing to show the phone code to your guests. With a settings PIN, guests also enter that PIN on their phone. The sheet shows how many phones are paired, whether the music keeps playing, and which rooms the phones control.",
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
