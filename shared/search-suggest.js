/** Search suggestions: start at 3 characters, wait ~250 ms after typing, reuse recent prefixes. */
export const searchMinimum = 3;
export const searchDebounceMs = 250;

/** The query that is actually sent: trimmed, or empty below the minimum length. */
export function searchTerm(q) {
  const text = String(q ?? "").trim();
  return text.length >= searchMinimum ? text : "";
}

/** True while someone has typed something that is still too short to search. */
export function searchTooShort(q) {
  const text = String(q ?? "").trim();
  return text.length > 0 && text.length < searchMinimum;
}

/** Small bounded LRU cache with expiry, so going back to an earlier prefix answers instantly. */
export function createSearchCache({ limit = 40, ttl = 20000, now = () => Date.now() } = {}) {
  const entries = new Map();
  return {
    get(key) {
      const hit = entries.get(key);
      if (!hit) return undefined;
      if (now() - hit.at > ttl) {
        entries.delete(key);
        return undefined;
      }
      entries.delete(key);
      entries.set(key, hit);
      return hit.value;
    },
    set(key, value) {
      entries.delete(key);
      entries.set(key, { value, at: now() });
      while (entries.size > limit) entries.delete(entries.keys().next().value);
    },
    get size() {
      return entries.size;
    },
    clear() {
      entries.clear();
    },
  };
}

export function searchCacheKey({ term, kind, offset = 0, source = "all", favorite = false }) {
  return JSON.stringify([term ? "search" : kind, term.toLocaleLowerCase(), offset, source, !!favorite]);
}
