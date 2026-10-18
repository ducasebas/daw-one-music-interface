/** Music Assistant JSON WebSocket protocol, reviewed against official frontend
 * a54001f4913b4ccce8574311fde79fe0f8683aef, src/plugins/api/index.ts.
 * Compatibility with the operator's server must still be validated. */
export function websocketUrl(address) {
  const u = new URL(address);
  if (
    !["http:", "https:", "ws:", "wss:"].includes(u.protocol) ||
    u.username ||
    u.password ||
    u.search ||
    u.hash
  )
    throw Error(
      "MA_URL must be an http(s)/ws(s) base URL without credentials/query",
    );
  u.protocol = ["https:", "wss:"].includes(u.protocol) ? "wss:" : "ws:";
  u.pathname = u.pathname.replace(/\/$/, "");
  if (!u.pathname.endsWith("/ws")) u.pathname += "/ws";
  return u.toString();
}
export class MusicAssistantTransport {
  constructor({
    url,
    token = "",
    WebSocketImpl = globalThis.WebSocket,
    timeoutMs = 8000,
  }) {
    this.url = websocketUrl(url);
    this.token = token;
    this.WebSocketImpl = WebSocketImpl;
    this.timeoutMs = timeoutMs;
    this.pending = new Map();
    this.listeners = new Set();
    this.sequence = 0;
    this.socket = null;
    this.info = null;
    this.ready = false;
  }
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit(event) {
    for (const fn of this.listeners) fn(event);
  }
  async connect() {
    if (this.socket) this.close();
    this.info = null;
    this.ready = false;
    const socket = new this.WebSocketImpl(this.url);
    this.socket = socket;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(Error("Music Assistant handshake timed out"));
        socket.close();
      }, this.timeoutMs);
      const fail = () => {
        clearTimeout(timer);
        reject(Error("Music Assistant connection unavailable"));
      };
      socket.addEventListener("error", fail, { once: true });
      socket.addEventListener("close", () => {
        fail();
        if (this.socket === socket) {
          this.ready = false;
          this.rejectPending();
          this.emit({ event: "disconnected" });
        }
      });
      socket.addEventListener("message", (event) => {
        if (this.socket !== socket) return;
        let m;
        try {
          m = JSON.parse(event.data);
        } catch {
          socket.close();
          return;
        }
        if (m.server_id && m.server_version) {
          this.info = m;
          clearTimeout(timer);
          resolve();
        } else if (m.message_id !== undefined) {
          const id = String(m.message_id),
            p = this.pending.get(id);
          if (!p) return;
          if (m.error_code !== undefined) {
            clearTimeout(p.timer);
            this.pending.delete(id);
            p.reject(
              Error(
                `Music Assistant command rejected (${String(m.error_code).slice(0, 30)})`,
              ),
            );
            return;
          }
          if (m.partial) {
            if (!Array.isArray(m.result)) {
              p.reject(Error("Invalid partial response"));
              this.pending.delete(id);
              clearTimeout(p.timer);
              return;
            }
            p.parts.push(...m.result);
            return;
          }
          clearTimeout(p.timer);
          this.pending.delete(id);
          p.resolve(
            p.parts.length
              ? [...p.parts, ...(Array.isArray(m.result) ? m.result : [])]
              : m.result,
          );
        } else if (m.event) this.emit(m);
      });
    });
    if (this.token)
      await this.command("auth", { token: this.token, device_name: "DAW ONE" });
    this.ready = true;
    return this.info;
  }
  command(command, args = {}) {
    if (!this.socket || this.socket.readyState !== 1)
      return Promise.reject(Error("Music Assistant disconnected"));
    const id = String(++this.sequence);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(Error("Music Assistant command timed out"));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer, parts: [] });
      try {
        this.socket.send(JSON.stringify({ message_id: id, command, args }));
      } catch {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(Error("Music Assistant send failed"));
      }
    });
  }
  rejectPending() {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(Error("Music Assistant disconnected"));
    }
    this.pending.clear();
  }
  close() {
    this.ready = false;
    const s = this.socket;
    this.socket = null;
    this.rejectPending();
    s?.close();
  }
  async snapshot(playerId) {
    const player = await this.command("players/get", {
      player_id: playerId,
      raise_unavailable: true,
    });
    const queues = await this.command("player_queues/all");
    const queue = Array.isArray(queues)
      ? queues.find(
          (q) =>
            q.queue_id ===
            (player.active_source || player.synced_to || player.player_id),
        )
      : null;
    let items = [];
    if (queue)
      items = await this.command("player_queues/items", {
        queue_id: queue.queue_id,
        limit: 25,
        offset: Math.max(0, queue.current_index || 0),
      });
    return { player, queue, items: Array.isArray(items) ? items : [] };
  }
  async control(playerId, action, value) {
    const commands = {
      play: "play",
      pause: "pause",
      next: "next",
      previous: "previous",
      seek: "seek",
      volume: "volume_set",
      mute: "volume_mute",
    };
    if (!commands[action]) throw Error("Unsupported action");
    const args = { player_id: playerId };
    if (action === "seek") args.position = value;
    if (action === "volume") args.volume_level = value;
    if (action === "mute") args.muted = value;
    return this.command(`players/cmd/${commands[action]}`, args);
  }
}
