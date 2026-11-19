/** Bump this release ID for every user-visible release; it is compiled into the UI. */
export const release = Object.freeze({
  id: "2026.11.19-lively.3",
  label: "GUI 3.11.2 · ENDLESS",
  /** Shown on TuneBox when this update is offered. Keep it short and user-facing. */
  notes: "Endless: "Keep the music playing" is on by default. When your queue ends, Music Assistant adds similar tracks from sources such as Tidal, Spotify or YouTube Music. Switching it on first checks with Music Assistant whether it can work. It applies to this TuneBox only, never to other rooms.",
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
