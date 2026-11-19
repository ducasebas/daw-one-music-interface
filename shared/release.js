/** Bump this release ID for every user-visible release; it is compiled into the UI. */
export const release = Object.freeze({
  id: "2026.11.19-update-flow.1",
  label: "GUI 3.9.1 · UPDATE FLOW",
  /** Shown on TuneBox when this update is offered. Keep it short and user-facing. */
  notes: "Install works even when Music Assistant is offline (if the speaker is silent). The Install button always responds. A clear message when the power setup stops the player. Clearer Music Assistant errors. Room measurement install fix.",
});
export function buildAlignment(frontend, backend, offline = false) {
  if (offline) return "offline";
  if (!backend?.id) return "unknown";
  return frontend.id === backend.id ? "matched" : "mismatch";
}
