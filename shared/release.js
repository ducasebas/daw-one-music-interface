/** Bump this release ID for every user-visible release; it is compiled into the UI. */
export const release = Object.freeze({
  id: "2026.11.19-remote.1",
  label: "GUI 3.9.0 · REMOTE",
  /** Shown on TuneBox when this update is offered. Keep it short and user-facing. */
  notes: "Phone remote control by QR code. Room measurement: clearer start, time remaining and a large stop button. Clearer update names. Volume rail on Now Playing.",
});
export function buildAlignment(frontend, backend, offline = false) {
  if (offline) return "offline";
  if (!backend?.id) return "unknown";
  return frontend.id === backend.id ? "matched" : "mismatch";
}
