/** Bump this release ID for every user-visible release; it is compiled into the UI. */
export const release = Object.freeze({
  id: "2026.11.20-hotfix.1",
  label: "GUI 3.14.1 · HOTFIX",
  /** Shown on TuneBox when this update is offered. Keep it short and user-facing. */
  notes: "Room measurement explains why a sweep was not accepted, with every check and its value. A microphone that is still settling no longer hides a real sweep, and slow sound output is found up to 2.5 s late. The measurement part needs “sudo bash deploy/update-appliance.sh --apply” once on the Pi.",
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
