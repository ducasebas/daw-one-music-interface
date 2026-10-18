import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialDevice,
  transition,
  reduceEvents,
  faultNames,
  amplifierAllowed,
} from "../shared/device.js";
import {
  initialPlayback,
  playbackEvent,
  positionAt,
  tracks,
} from "../shared/playback.js";
import { endSync } from "../shared/video.js";
import {
  SimulatedController,
  AmplifierSafetyManager,
  decodeFrame,
} from "../shared/controller.js";
import { settings } from "../shared/settings.js";
const ready = () => transition(initialDevice(), { type: "boot-complete" }),
  run = (s, ...types) =>
    reduceEvents(
      s,
      types.map((type) => ({ type })),
    );
test("cold boot is inhibited; boot without NUC can enter ready safely", () => {
  const s = initialDevice();
  assert.equal(s.amplifierEnabled, false);
  assert.equal(ready().mode, "ready");
  assert.equal(amplifierAllowed(ready()), false);
});
test("unverified hardware cannot enable even during playback", () => {
  const s = run(ready(), "play");
  assert.equal(s.playing, true);
  assert.equal(s.amplifierEnabled, false);
  const c = new SimulatedController();
  assert.equal(c.command({ v: 1, seq: 1, type: "enable" }, s).enabled, false);
});
test("verified simulation can enable; standby, presence wake and display sleep are independent", () => {
  let s = run(ready(), "simulation-verified", "play");
  assert.equal(s.amplifierEnabled, true);
  s = run(s, "display-timeout");
  assert.equal(s.amplifierEnabled, true);
  assert.equal(s.displayAwake, false);
  s = run(s, "standby");
  assert.equal(s.amplifierEnabled, false);
  s = run(s, "presence");
  assert.equal(s.mode, "ready");
  assert.equal(s.playing, false);
});
for (const fault of faultNames)
  test(`latched ${fault} disables amplifier and blocks enable commands`, () => {
    const s = run(
      ready(),
      "simulation-verified",
      "play",
      fault,
      "presence",
      "play",
      "simulation-verified",
    );
    assert.equal(s.mode, "fault");
    assert.equal(s.amplifierEnabled, false);
    assert.equal(new AmplifierSafetyManager().reconcile(s).enabled, false);
    const recovered = run(s, "acknowledge", "presence", "play");
    assert.equal(recovered.verified, false);
    assert.equal(recovered.amplifierEnabled, false);
  });
test("shutdown and Pi reboot during playback disable output", () => {
  const s = run(ready(), "simulation-verified", "play");
  assert.equal(run(s, "shutdown", "play").amplifierEnabled, false);
  assert.equal(run(s, "boot").amplifierEnabled, false);
});
test("conflicting events cannot override a fault, in either order", () => {
  for (const events of [
    ["play", "thermal-alarm"],
    ["thermal-alarm", "play"],
    ["simulation-verified", "power-good-failure"],
    ["power-good-failure", "simulation-verified"],
  ])
    assert.equal(run(ready(), ...events).amplifierEnabled, false);
});
test("controller rejects replay, malformed and oversized frames", () => {
  assert.throws(() => decodeFrame("x"));
  assert.throws(() => decodeFrame(" ".repeat(1025)));
  assert.throws(() => decodeFrame('{"v":2,"seq":1,"type":"hello"}'));
  const c = new SimulatedController(),
    f = { v: 1, seq: 0, type: "disable" };
  c.command(f, ready());
  assert.throws(() => c.command(f, ready()));
});
test("play/pause, server unavailable and reconnect transitions", () => {
  let s = playbackEvent(initialPlayback(), { type: "play" }, 1000);
  assert.equal(s.playing, true);
  s = playbackEvent(s, { type: "disconnect" }, 2000);
  assert.equal(s.playing, false);
  assert.equal(playbackEvent(s, { type: "play" }, 3000).playing, false);
  s = playbackEvent(s, { type: "reconnect" }, 4000);
  assert.equal(playbackEvent(s, { type: "play" }, 4000).playing, true);
});
test("position uses authoritative timestamp and clamps drift", () => {
  const s = {
    ...initialPlayback(),
    playing: true,
    position: 10,
    observedAt: 1000,
  };
  assert.equal(positionAt(s, 6000), 15);
  assert.equal(positionAt(s, 1e9), tracks[0].duration);
  assert.equal(
    playbackEvent(s, { type: "seek", position: -10 }, 6000).position,
    0,
  );
});
test("metadata changes and queue events", () => {
  let s = playbackEvent(initialPlayback(), {
    type: "metadata",
    metadata: { title: "Updated" },
  });
  assert.equal(s.queue[0].title, "Updated");
  s = playbackEvent(s, { type: "queue", queue: [tracks[1]] });
  assert.equal(s.queue[0].id, "horizon");
  assert.equal(s.index, 0);
});
const sync = (o) =>
  endSync({
    audioPosition: 50,
    audioDuration: 200,
    videoDuration: 300,
    playing: true,
    ...o,
  });
test("end sync offset and manual correction", () => {
  assert.equal(sync({}).position, 150);
  assert.equal(sync({ correction: -20 }).position, 130);
});
test("negative offset, shorter video and long intro wait", () => {
  const s = sync({ videoDuration: 100 });
  assert.equal(s.offset, -100);
  assert.equal(s.position, 0);
  assert.equal(s.status, "waiting");
  assert.equal(sync({ intro: 200 }).status, "waiting");
});
test("missing and invalid durations fall back", () => {
  for (const duration of [undefined, null, 0, -1, NaN, Infinity])
    assert.equal(sync({ videoDuration: duration }).status, "fallback");
});
test("pause/resume and seek use audio clock", () => {
  assert.equal(sync({ playing: false }).playing, false);
  assert.equal(sync({ playing: true }).playing, true);
  assert.equal(sync({ audioPosition: 100 }).position, 200);
  assert.equal(sync({ audioPosition: 200 }).status, "ended");
});
test("incorrect match and unavailable embeds fall back", () => {
  assert.equal(sync({ matched: false }).status, "fallback");
  assert.equal(sync({ available: false }).status, "fallback");
});
test("settings whitelist, clamp and safe defaults", () => {
  assert.deepEqual(
    settings({
      volume: 120,
      brightness: -1,
      artwork: "bad",
      correction: Infinity,
      enable: true,
    }),
    { volume: 100, brightness: 10, artwork: "cover", correction: 0 },
  );
});
test("corrupt settings recover from null", () =>
  assert.equal(settings(null).volume, 32));
