import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MusicAssistantTransport,
  websocketUrl,
} from "../server/ma-transport.js";
import { LiveMusicService, normalizeMusic } from "../server/ma-service.js";
import { musicConfig } from "../server/ma-config.js";
const player = {
  player_id: "pi",
  name: "Living room",
  available: true,
  playback_state: "playing",
  elapsed_time: 10,
  elapsed_time_last_updated: 10,
  current_media: { title: "Live radio", artist: "Radio", duration: null },
  volume_level: 22,
  volume_muted: false,
  supported_features: ["volume_set", "volume_mute", "seek"],
  active_source: "pi",
};
const queue = {
  queue_id: "pi",
  active: true,
  state: "playing",
  elapsed_time: 12,
  elapsed_time_last_updated: 10,
  current_item: {
    queue_item_id: "q1",
    name: "Track",
    duration: 200,
    media_item: {
      name: "Song",
      artists: [{ name: "Artist" }],
      album: { name: "Album" },
    },
  },
  current_index: 0,
};
class FixtureSocket extends EventTarget {
  static calls = [];
  static partial = false;
  constructor() {
    super();
    this.readyState = 1;
    queueMicrotask(() =>
      this.dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({
            server_id: "fixture",
            server_version: "fixture-version",
            schema_version: 999,
          }),
        }),
      ),
    );
  }
  send(raw) {
    const frame = JSON.parse(raw);
    FixtureSocket.calls.push(frame);
    const results = {
      auth: { user: { name: "fixture" } },
      "players/all": [player],
      "players/get": player,
      "player_queues/all": [queue],
      "player_queues/items": [queue.current_item],
    };
    if (FixtureSocket.partial && frame.command === "players/all") {
      this.reply({
        message_id: frame.message_id,
        partial: true,
        result: [player],
      });
      this.reply({ message_id: frame.message_id, partial: false, result: [] });
    } else
      this.reply({
        message_id: frame.message_id,
        result: results[frame.command] ?? null,
      });
  }
  reply(frame) {
    queueMicrotask(() =>
      this.dispatchEvent(
        new MessageEvent("message", { data: JSON.stringify(frame) }),
      ),
    );
  }
  close() {
    this.readyState = 3;
    this.dispatchEvent(new Event("close"));
  }
}
const configuration = {
  url: "http://localhost:8095",
  token: "fixture-not-real",
  playerId: "pi",
  controlEnabled: true,
  volumeLimit: 40,
};
function transport() {
  return new MusicAssistantTransport({
    ...configuration,
    WebSocketImpl: FixtureSocket,
    timeoutMs: 100,
  });
}
function service(config = {}) {
  return new LiveMusicService(
    { ...configuration, ...config },
    { transport: transport(), retryMs: 5 },
  );
}
test("MA URL validates protocols and never embeds credentials", () => {
  assert.equal(
    websocketUrl("https://example.test/ma/"),
    "wss://example.test/ma/ws",
  );
  assert.equal(
    websocketUrl("ws://localhost:8095/ws"),
    "ws://localhost:8095/ws",
  );
  for (const s of [
    "file:///x",
    "https://u:p@example.test",
    "https://example.test?token=x",
  ])
    assert.throws(() => websocketUrl(s));
});
test("real transport protocol: server-info, token auth, selected player/queue and volume/mute/seek commands", async () => {
  FixtureSocket.calls = [];
  const t = transport();
  await t.connect();
  assert.equal(FixtureSocket.calls[0].command, "auth");
  const snap = await t.snapshot("pi");
  assert.equal(snap.queue.queue_id, "pi");
  await t.control("pi", "volume", 30);
  await t.control("pi", "seek", 50);
  await t.control("pi", "mute", true);
  assert.deepEqual(
    FixtureSocket.calls.slice(-3).map((f) => [f.command, f.args]),
    [
      ["players/cmd/volume_set", { player_id: "pi", volume_level: 30 }],
      ["players/cmd/seek", { player_id: "pi", position: 50 }],
      ["players/cmd/volume_mute", { player_id: "pi", muted: true }],
    ],
  );
  t.close();
});
test("partial responses merge; disconnect rejects pending and clears callbacks", async () => {
  FixtureSocket.partial = true;
  const t = transport();
  await t.connect();
  assert.equal((await t.command("players/all")).length, 1);
  FixtureSocket.partial = false;
  const socket = t.socket;
  socket.send = () => {};
  const p = t.command("unanswered");
  socket.close();
  await assert.rejects(p, /disconnected/);
  assert.equal(t.pending.size, 0);
  t.close();
});
test("command errors and timeouts reject without leaking server details", async () => {
  const t = transport();
  await t.connect();
  t.socket.send = (raw) =>
    t.socket.reply({
      message_id: JSON.parse(raw).message_id,
      error_code: 401,
      details: "secret server error",
    });
  await assert.rejects(t.command("test"), (e) => !e.message.includes("secret"));
  t.socket.send = () => {};
  await assert.rejects(t.command("test"), /timed out/);
  t.close();
});
test("metadata, queue, timing, actual volume and unknown radio duration normalize", () => {
  const p = normalizeMusic(
    { player, queue, items: [queue.current_item] },
    12000,
  );
  assert.equal(p.queue[0].title, "Song");
  assert.equal(p.queue[0].artist, "Artist");
  assert.equal(p.volume, 22);
  assert.equal(p.observedAt, 10000);
  assert.equal(p.position, 12);
  assert.equal(normalizeMusic({ player }, 12000).queue[0].duration, null);
});
test("live volume ceiling, read-only mode and no automatic play or volume on connect", async () => {
  FixtureSocket.calls = [];
  const s = service();
  await s.start();
  assert.equal(s.status, "connected");
  assert.ok(
    !FixtureSocket.calls.some((f) => f.command.startsWith("players/cmd")),
  );
  await s.control({ type: "volume", value: 99 });
  assert.equal(
    FixtureSocket.calls.find((f) => f.command === "players/cmd/volume_set").args
      .volume_level,
    40,
  );
  assert.equal(
    JSON.stringify(s.publicStatus()).includes("fixture-not-real"),
    false,
  );
  await assert.rejects(s.control({ type: "simulation-verified" }));
  s.stop();
  const read = service({ controlEnabled: false });
  await read.start();
  await assert.rejects(read.control({ type: "play" }), /read-only/);
  read.stop();
});
test("player must be selected explicitly; events and reconnect resynchronize without replaying controls", async () => {
  const s = service({ playerId: "" });
  await s.start();
  assert.equal(s.playback.connected, false);
  await assert.rejects(s.control({ type: "play" }));
  await s.selectPlayer("pi");
  assert.equal(s.playback.queue[0].title, "Song");
  await assert.rejects(s.selectPlayer("unknown"));
  s.transport.emit({ event: "queue_updated", object_id: "pi" });
  assert.ok(s.timer);
  s.failed("fixture disconnect");
  assert.equal(s.playback.connected, false);
  assert.ok(s.retryTimer);
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(s.status, "connected");
  assert.equal(s.playback.volume, 22);
  s.stop();
});
test("invalid config fails closed and simulation needs no credentials", () => {
  assert.deepEqual(musicConfig({}), { mode: "simulation" });
  assert.throws(() => musicConfig({ DAW_PLAYBACK_MODE: "music-assistant" }));
  assert.throws(() =>
    musicConfig({
      DAW_PLAYBACK_MODE: "music-assistant",
      MA_URL: "http://localhost",
      MA_VOLUME_LIMIT: "200",
    }),
  );
  assert.equal(
    musicConfig({
      DAW_PLAYBACK_MODE: "music-assistant",
      MA_URL: "http://localhost",
    }).controlEnabled,
    false,
  );
});
test("inactive queues do not mask external-source metadata", () => {
  const p = normalizeMusic(
    { player, queue: { ...queue, active: false }, items: [queue.current_item] },
    12000,
  );
  assert.equal(p.queue[0].title, "Live radio");
  assert.equal(p.queue.length, 1);
  assert.equal(p.position, 10);
});
test("unknown-duration radio position advances without a fabricated duration", async () => {
  const { positionAt } = await import("../shared/playback.js");
  const p = normalizeMusic({ player }, 12000);
  assert.equal(positionAt(p, 15000), 15);
});
