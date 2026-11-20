/** Bump this release ID for every user-visible release; it is compiled into the UI. */
export const release = Object.freeze({
  id: "2026.11.20-sync.1",
  label: "GUI 3.15.1 · SYNC",
  /** Shown on TuneBox when this update is offered. Keep it short and user-facing. */
  notes: "Picture & meter sync is more precise: it aligns on beats and transients, ignores the microphone’s start-up, and measures the screen delay without letting one slow frame widen the margin. Failed attempts now show why, also later. Needs “sudo bash /opt/daw-one/deploy/update-appliance.sh --apply” once on the Pi.",
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
