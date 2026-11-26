/** Bump this release ID for every user-visible release; it is compiled into the UI. */
export const release = Object.freeze({
  id: "2026.11.25-flow.1",
  label: "GUI 3.17.0 · FLOW",
  /** Shown on TuneBox when this update is offered. Keep it short and user-facing. */
  notes: "Transparent, roomier header. Larger floating widgets and song text, a header clock, recommended smooth graphics and a smoother seek bar. Visualizer sensitivity and response, lighter meter analysis, song radio and named phones in Party mode. Read-only audio diagnostics and clearer playback recovery. Successful updates show a restart countdown. Higher DAC sample rates remain a separate driver update.",
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
