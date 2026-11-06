/** Bump this release ID for every user-visible release; it is compiled into the UI. */
export const release = Object.freeze({
  id: "2026.11.06-sensors.1",
  label: "GUI 2.10 · SENSORS",
});
export function buildAlignment(frontend, backend, offline = false) {
  if (offline) return "offline";
  if (!backend?.id) return "unknown";
  return frontend.id === backend.id ? "matched" : "mismatch";
}
