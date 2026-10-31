/** Backpressure is not disconnection. Keep only the latest waiting snapshot. */
export function snapshotWriter() {
  const pending = new Map();
  const write = (client, body) => {
    if (client.destroyed || client.writableEnded) return;
    if (pending.has(client)) {
      pending.set(client, body);
      return;
    }
    if (!client.write(body)) {
      pending.set(client, null);
      client.once("drain", () => {
        const latest = pending.get(client);
        pending.delete(client);
        if (latest) write(client, latest);
      });
    }
  };
  return {
    write,
    blocked: (client) => pending.has(client),
    remove: (client) => pending.delete(client),
  };
}
