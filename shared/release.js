/** Bump this release ID for every user-visible release; it is compiled into the UI. */
export const release = Object.freeze({
  id: "2026.11.19-sound.1",
  label: "GUI 3.14.0 · SOUND",
  /** Shown on TuneBox when this update is offered. Keep it short and user-facing. */
  notes: "Four updates in one: Play now asks before replacing a queue with music waiting. A Party sheet shows the phone code on Now Playing (with your settings PIN). When Music Assistant is away you can still pause and change volume locally, never louder. Audio & DSP starts with simple controls (preset, bass, treble, loudness); all amplifier controls stay under Advanced.",
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
