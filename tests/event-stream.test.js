import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { snapshotWriter } from "../server/event-stream.js";
class Client extends EventEmitter {
  messages = [];
  busy = true;
  destroyed = false;
  write(body) {
    this.messages.push(body);
    return !this.busy;
  }
}
test("stream backpressure keeps client open and coalesces to latest snapshot", () => {
  const w = snapshotWriter(),
    c = new Client();
  w.write(c, "initial");
  w.write(c, "old");
  w.write(c, "latest");
  assert.deepEqual(c.messages, ["initial"]);
  assert.equal(c.destroyed, false);
  c.busy = false;
  c.emit("drain");
  assert.deepEqual(c.messages, ["initial", "latest"]);
  assert.equal(w.blocked(c), false);
});
test("disconnect removes pending snapshot and ignores subsequent writes", () => {
  const w = snapshotWriter(),
    c = new Client();
  w.write(c, "first");
  w.write(c, "pending");
  c.destroyed = true;
  w.remove(c);
  c.emit("drain");
  w.write(c, "after-close");
  assert.deepEqual(c.messages, ["first"]);
});
