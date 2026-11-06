import { websocketUrl } from "./ma-transport.js";
/** MA canonical opaque image IDs only: no arbitrary URL proxy or browser credentials. */
export function artworkUrl(base, id) {
  if (!/^[a-f0-9]{64}$/i.test(id)) throw Error("Invalid image ID");
  const url = new URL(websocketUrl(base));
  url.protocol = ["https:", "wss:"].includes(url.protocol) ? "https:" : "http:";
  url.pathname =
    url.pathname.replace(/\/ws\/?$/, "").replace(/\/$/, "") +
    `/imageproxy/${id.toLowerCase()}`;
  url.search = "";
  url.searchParams.set("size", "256");
  url.searchParams.set("fmt", "webp");
  return url;
}
export class ArtworkCache {
  constructor(config, fetcher = fetch) {
    this.config = config;
    this.fetcher = fetcher;
    this.cache = new Map();
    this.inflight = new Map();
  }
  async get(id) {
    const url = artworkUrl(this.config.url, id);
    const existing = this.cache.get(id);
    if (existing && Date.now() - existing.at < 300000) return existing;
    if (this.inflight.has(id)) return this.inflight.get(id);
    if (this.inflight.size >= 4) throw Error("Artwork busy");
    const task = this.download(url)
      .then((result) => {
        this.cache.delete(id);
        this.cache.set(id, result);
        while (this.cache.size > 16)
          this.cache.delete(this.cache.keys().next().value);
        return result;
      })
      .finally(() => this.inflight.delete(id));
    this.inflight.set(id, task);
    return task;
  }
  async download(url) {
    const r = await this.fetcher(url, {
      redirect: "error",
      signal: AbortSignal.timeout(5000),
      headers: this.config.token
        ? { Authorization: `Bearer ${this.config.token}` }
        : {},
    });
    const type = (r.headers.get("content-type") || "").split(";")[0];
    if (!r.ok || !["image/webp", "image/jpeg", "image/png"].includes(type)) {
      await r.body?.cancel();
      throw Error("Artwork unavailable");
    }
    if (Number(r.headers.get("content-length")) > 2097152) {
      await r.body?.cancel();
      throw Error("Artwork too large");
    }
    const reader = r.body.getReader();
    const parts = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 2097152) throw Error("Artwork too large");
        parts.push(Buffer.from(value));
      }
    } catch (e) {
      await reader.cancel();
      throw e;
    } finally {
      reader.releaseLock();
    }
    return { body: Buffer.concat(parts), type, at: Date.now() };
  }
}
