/** Bump this release ID for every user-visible release; it is compiled into the UI. */
export const release = Object.freeze({
  id: "2026.11.20-guide.1",
  label: "GUI 3.15.0 · GUIDE",
  /** Shown on TuneBox when this update is offered. Keep it short and user-facing. */
  notes: "Room correction is now a step-by-step wizard with a check measurement. Bluetooth explains pairing and shows the real codec, bitrate and connection stability. Updates open full screen with what’s new, how long it usually takes and what you will see. Search suggestions are readable above a smaller keyboard. Your phone receives TuneBox notifications and can invite another phone. Needs “sudo bash /opt/daw-one/deploy/update-appliance.sh --apply” once on the Pi for Bluetooth details and the update page.",
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
