/** Bump this release ID for every user-visible release; it is compiled into the UI. */
export const release = Object.freeze({
  id: "2026.11.19-update-flow.2",
  label: "GUI 3.9.2 · HOTFIX",
  /** Shown on TuneBox when this update is offered. Keep it short and user-facing. */
  notes: "Room measurement hotfix: real sweeps in reverberant rooms are detected, a microphone start-up click no longer causes a false noise error, results say how many dB are missing, and you can measure again 6 dB louder (up to -24 dBFS) after confirming.",
});
export function buildAlignment(frontend, backend, offline = false) {
  if (offline) return "offline";
  if (!backend?.id) return "unknown";
  return frontend.id === backend.id ? "matched" : "mismatch";
}
