/** Update notification lifecycle. A notice exists only while it means something: an offer, an
 * install in progress, or the outcome of an install ("Update installed" / "Update failed").
 * The outcome stays until it is dismissed or expires; a resolved condition removes the notice. */
export const updateBusy = ["preparing", "downloading", "verifying", "waiting-idle", "installing", "restarting", "checking-health", "rolling-back"];
export const outcomeLifetimeMs = 24 * 60 * 60 * 1000;

const name = (v) => v?.label || v?.release || null;

/** Remembers what was being installed, and turns the end of it into an outcome. Pure. */
export function trackUpdate(memory = {}, info, now = Date.now()) {
  const next = { pending: memory.pending || null, outcome: memory.outcome || null };
  if (next.outcome && now - next.outcome.at > outcomeLifetimeMs) next.outcome = null;
  if (!info || info.offline) return next;
  const status = info.status;
  const currentRelease = info.current?.release || null;
  if (info.available && (status === "available" || updateBusy.includes(status))) {
    next.pending = { release: info.available.release || null, label: name(info.available), from: currentRelease };
    // A new offer or install replaces an older outcome.
    if (updateBusy.includes(status)) next.outcome = null;
  } else if (updateBusy.includes(status) && !next.pending) {
    next.pending = { release: null, label: null, from: currentRelease };
    next.outcome = null;
  }
  const reached = next.pending && next.pending.release && currentRelease === next.pending.release && next.pending.from !== currentRelease;
  if (status === "installed" || (reached && !updateBusy.includes(status))) {
    if (next.pending || status === "installed") {
      next.outcome = { kind: "installed", label: next.pending?.label || name(info.current), at: now };
      next.pending = null;
    }
  } else if ((status === "error" || status === "rolled-back") && next.pending) {
    next.outcome = { kind: "failed", label: next.pending.label, detail: status === "rolled-back" ? "rolled-back" : "error", at: now };
    next.pending = null;
  } else if (["up-to-date", "no-release"].includes(status) && next.pending && !reached && !info.available) {
    // The offer disappeared without an install (e.g. withdrawn): nothing left to tell.
    next.pending = null;
  }
  return next;
}

/** The single update row for the notification centre, or null when there is nothing to say. */
export function updateNotification(memory = {}, info, offline = false) {
  const base = { id: "update", icon: "update", action: "updates" };
  if (!offline && info && !info.offline) {
    if (updateBusy.includes(info.status)) return { ...base, title: "Installing update", detail: name(info.available) || "Update in progress", attention: false, busy: true };
    if (info.status === "error" && !memory.outcome) return { ...base, title: "Update needs attention", detail: info.error || "Open Updates to retry.", attention: true };
  }
  if (memory.outcome?.kind === "installed") return { ...base, title: "Update installed", detail: memory.outcome.label || "", attention: false, outcome: true, dismissible: true };
  if (memory.outcome?.kind === "failed") return { ...base, title: "Update failed", detail: memory.outcome.detail === "rolled-back" ? "The previous version was restored. Your settings are unchanged." : "The update could not be installed. Open Updates to retry.", label: memory.outcome.label, attention: true, outcome: true, dismissible: true };
  if (!offline && info?.available && !info.offline) return { ...base, title: "Update available", detail: name(info.available), attention: true };
  return null;
}

const key = "tunebox-update-notice";
export function loadUpdateMemory(storage = globalThis.localStorage) {
  try {
    const v = JSON.parse(storage?.getItem(key) || "{}");
    return v && typeof v === "object" ? { pending: v.pending || null, outcome: v.outcome || null } : {};
  } catch {
    return {};
  }
}
export function saveUpdateMemory(memory, storage = globalThis.localStorage) {
  try {
    storage?.setItem(key, JSON.stringify({ pending: memory.pending || null, outcome: memory.outcome || null }));
  } catch {}
}
