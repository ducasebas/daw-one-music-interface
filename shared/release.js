/** Bump this release ID for every user-visible release; it is compiled into the UI. */
export const release = Object.freeze({
  id: "2026.11.11-setup.1",
  label: "GUI 3.2 · SETUP",
});
export function buildAlignment(frontend, backend, offline = false) {
  if (offline) return "offline";
  if (!backend?.id) return "unknown";
  return frontend.id === backend.id ? "matched" : "mismatch";
}
