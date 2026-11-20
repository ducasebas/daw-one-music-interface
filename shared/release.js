/** Bump this release ID for every user-visible release; it is compiled into the UI. */
export const release = Object.freeze({
  id: "2026.11.20-hotfix.2",
  label: "GUI 3.14.2 · HOTFIX",
  /** Shown on TuneBox when this update is offered. Keep it short and user-facing. */
  notes: "Room measurement starts again when nothing is playing: the amplifier’s idle “clock” notice no longer blocks the sweep, the startup sound or Bluetooth volume. Real amplifier faults still stop them. Needs “sudo bash /opt/daw-one/deploy/update-appliance.sh --apply” once on the Pi.",
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
