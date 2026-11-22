/** Bump this release ID for every user-visible release; it is compiled into the UI. */
export const release = Object.freeze({
  id: "2026.11.22-hotfix.1",
  label: "GUI 3.16.1 · HOTFIX",
  /** Shown on TuneBox when this update is offered. Keep it short and user-facing. */
  notes: "Screen rest no longer switches itself back on right after you start it, and the power widget keeps the last reading. Stability for Raspberry Pi 4 + Louder HAT: Squeezelite keeps the audio device open, 44.1–96 kHz rate protection, calmer automatic DSP changes, faster visualizer capture, steadier Chromium and Wi-Fi without power saving. Needs “sudo bash /opt/daw-one/deploy/update-appliance.sh --apply” once.",
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
