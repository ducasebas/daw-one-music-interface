import { test } from "node:test";
import assert from "node:assert/strict";
import { MusicAssistantAdapter } from "../server/music-assistant.js";
test("MA adapter propagates metadata/queue, failure and snapshot on reconnect", async () => {
  let online = true,
    listener,
    subscriptions = 0;
  const transport = {
    async connect() {
      if (!online) throw Error("unavailable");
    },
    subscribe(fn) {
      listener = fn;
      subscriptions++;
      return () => subscriptions--;
    },
    async snapshot() {
      return { position: 42 };
    },
    async control(id, action) {
      if (!online) throw Error("disconnected");
      return { id, action };
    },
    async close() {},
  };
  const a = new MusicAssistantAdapter(transport, "test-player"),
    events = [];
  await a.connect((e) => events.push(e));
  listener({ type: "metadata", title: "changed" });
  listener({ type: "queue", queue: [] });
  assert.equal(events.length, 2);
  assert.equal((await a.command("play")).id, "test-player");
  online = false;
  await assert.rejects(a.command("pause"));
  assert.equal(a.connected, false);
  await assert.rejects(a.reconnect(() => {}));
  online = true;
  assert.equal((await a.reconnect(() => {})).position, 42);
  assert.equal(subscriptions, 1);
  await a.close();
  assert.equal(subscriptions, 0);
});
