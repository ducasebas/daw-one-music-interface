/** Bump this release ID for every user-visible release; it is compiled into the UI. */
export const release = Object.freeze({
  id: "2026.11.23-safe.1",
  label: "GUI 3.16.3 · SAFE UPDATE",
  /** Shown on TuneBox when this update is offered. Keep it short and user-facing. */
  notes: "Repairs stalled updates and checks system modules before installation. A screen-wide menu keeps the song and visualizer in place. Choose widgets in a scrollable popup. Local PCM analysis runs separately, with a live meter feed and less work during startup. Failed updates return to the previous version. The system helpers need “sudo bash /opt/daw-one/deploy/update-appliance.sh --apply” once if automatic appliance maintenance is not enabled.",
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
