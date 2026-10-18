/** Transport-injected adapter. Verify commands against installed MA server/client
 * version before enabling live transport. No invented wire API or auth scheme. */
export class MusicAssistantAdapter {
  constructor(transport, playerId) {
    this.transport = transport;
    this.playerId = playerId;
    this.connected = false;
    this.unsubscribe = null;
  }
  async connect(onEvent) {
    try {
      await this.transport.connect();
      this.unsubscribe = this.transport.subscribe(onEvent);
      this.connected = true;
      return await this.transport.snapshot(this.playerId);
    } catch (error) {
      this.connected = false;
      throw error;
    }
  }
  async command(action, value) {
    if (!this.connected) throw Error("Music Assistant unavailable");
    if (
      !["play", "pause", "next", "previous", "seek", "volume"].includes(action)
    )
      throw Error("Unsupported action");
    try {
      return await this.transport.control(this.playerId, action, value);
    } catch (error) {
      this.connected = false;
      throw error;
    }
  }
  async reconnect(onEvent) {
    this.unsubscribe?.();
    this.unsubscribe = null;
    return this.connect(onEvent);
  }
  async close() {
    this.unsubscribe?.();
    this.connected = false;
    await this.transport.close();
  }
}
