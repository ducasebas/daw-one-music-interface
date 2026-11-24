/** Bump this release ID for every user-visible release; it is compiled into the UI. */
export const release = Object.freeze({
  id: "2026.11.24-integrity.1",
  label: "GUI 3.16.4 · INTEGRITY",
  /** Shown on TuneBox when this update is offered. Keep it short and user-facing. */
  notes: "Checks system files before and after installation. Empty or damaged files are refused. The screen controller must keep running before installation can finish. Screen, manager and updater files are also checked when their services start. Includes the 3.16.3 interface and visualizer improvements. If automatic system maintenance is off, run “sudo bash /opt/daw-one/deploy/update-appliance.sh --apply” once.",
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
