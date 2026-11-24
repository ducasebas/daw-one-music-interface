const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Rebase edits made during Save onto the server's acknowledgement; arrays are one edit. */
function rebase(sent, current, saved) {
  if (same(sent, current)) return copy(saved);
  if (!record(sent) || !record(current) || !record(saved)) return copy(current);
  const keys = new Set([...Object.keys(saved), ...Object.keys(sent), ...Object.keys(current)]);
  return Object.fromEntries([...keys].flatMap(key => {
    const changed = Object.hasOwn(sent, key) !== Object.hasOwn(current, key) || !same(sent[key], current[key]);
    if (changed) return Object.hasOwn(current, key) ? [[key, rebase(sent[key], current[key], saved[key])]] : [];
    return Object.hasOwn(saved, key) ? [[key, copy(saved[key])]] : [];
  }));
}

export function draftAfterSave(sent, current, saved) {
  return {...rebase(sent, current, saved), revision: saved.revision};
}
