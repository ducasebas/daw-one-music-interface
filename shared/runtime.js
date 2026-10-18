import { initialDevice, transition, faultNames } from "./device.js";
import { initialPlayback, playbackEvent, positionAt } from "./playback.js";
import { AmplifierSafetyManager } from "./controller.js";
export const policy = {
  heartbeatTimeoutMs: 3000,
  displayTimeoutMs: 30000,
  thermalLimitC: 75,
}; // Simulation policy only; not electrical specifications.
export const eventTypes = [
  "volume",
  "mute",
  "play",
  "pause",
  "next",
  "previous",
  "seek",
  "disconnect",
  "reconnect",
  "boot",
  "boot-complete",
  "standby",
  "presence",
  "display-timeout",
  "shutdown",
  "acknowledge",
  "simulation-verified",
  "ambient",
  "temperature",
  "power-good",
  "wifi",
  "heartbeat",
  "heartbeat-enabled",
  "button",
  "tick",
  ...faultNames,
];
export class DeviceRuntime {
  constructor(now = Date.now()) {
    this.safety = new AmplifierSafetyManager();
    this.device = initialDevice();
    this.playback = initialPlayback();
    this.playback.observedAt = now;
    this.sensors = {
      presence: false,
      ambient: 60,
      temperature: 35,
      powerGood: false,
      wifi: true,
      heartbeatEnabled: true,
      lastHeartbeat: now,
    };
    this.audio = { volume: 32, muted: false };
    this.lastActivity = now;
    this.log = [];
    this.sequence = 0;
    this.record(now, "boot", "booting", "Cold boot; all output inhibited");
    this.safety.reconcile(this.device);
    this.record(
      now,
      "amplifier-request",
      "booting",
      "MUTE/DISABLE simulated cold-boot request",
    );
  }
  record(now, type, state, reason) {
    this.log.push({
      id: ++this.sequence,
      at: new Date(now).toISOString(),
      type,
      state,
      reason,
      simulated: true,
    });
    this.log = this.log.slice(-500);
  }
  dispatch(e, now = Date.now()) {
    if (!e || !eventTypes.includes(e.type)) throw Error("Unsupported event");
    if (
      ["ambient", "temperature"].includes(e.type) &&
      !Number.isFinite(e.value)
    )
      throw Error("Finite sensor value required");
    if (
      ["wifi", "power-good", "heartbeat-enabled"].includes(e.type) &&
      typeof e.value !== "boolean"
    )
      throw Error("Boolean sensor value required");
    if (e.type === "seek" && !Number.isFinite(e.position))
      throw Error("Finite seek position required");
    if (e.type === "volume") {
      if (!Number.isFinite(e.value)) throw Error("Finite volume required");
      this.audio = {
        ...this.audio,
        volume: Math.max(0, Math.min(100, Math.round(e.value))),
      };
    }
    if (e.type === "mute") {
      if (typeof e.value !== "boolean") throw Error("Boolean mute required");
      this.audio = { ...this.audio, muted: e.value };
    }
    const before = this.device;
    let events = [e];
    if (e.type === "boot") {
      this.sensors = { ...this.sensors, powerGood: false, lastHeartbeat: now };
      this.playback = initialPlayback();
      this.playback.observedAt = now;
      this.lastActivity = now;
    }
    if (e.type === "presence") {
      this.sensors.presence = e.value !== false;
      if (e.value === false) events = [];
      else this.lastActivity = now;
    }
    if (e.type === "ambient")
      this.sensors.ambient = Math.max(0, Math.min(100, e.value));
    if (e.type === "temperature") {
      this.sensors.temperature = e.value;
      if (e.value >= policy.thermalLimitC) events = [{ type: "thermal-alarm" }];
    }
    if (e.type === "power-good") {
      this.sensors.powerGood = e.value;
      this.device = { ...this.device, powerGood: e.value };
      if (!e.value) events = [{ type: "power-good-failure" }];
    }
    if (e.type === "wifi") {
      this.sensors.wifi = e.value;
      events = e.value ? [] : [{ type: "disconnect" }];
    }
    if (e.type === "heartbeat-enabled") this.sensors.heartbeatEnabled = e.value;
    if (e.type === "heartbeat") this.sensors.lastHeartbeat = now;
    if (
      e.type === "simulation-verified" &&
      (!this.sensors.powerGood ||
        now - this.sensors.lastHeartbeat > policy.heartbeatTimeoutMs ||
        this.sensors.temperature >= policy.thermalLimitC)
    ) {
      events = [];
      this.record(
        now,
        "error",
        this.device.mode,
        "Simulated verification rejected: power, heartbeat or thermal condition unsafe",
      );
    }
    if (e.type === "reconnect" && !this.sensors.wifi) {
      events = [];
      this.record(
        now,
        "error",
        this.device.mode,
        "Cannot reconnect Music Assistant while Wi-Fi is unavailable",
      );
    }
    if (e.type === "button") {
      if (!["play-pause", "standby", "wake"].includes(e.button))
        throw Error("Unknown button");
      events = [
        {
          type:
            e.button === "play-pause"
              ? this.playback.playing
                ? "pause"
                : "play"
              : e.button === "wake"
                ? "presence"
                : "standby",
        },
      ];
    }
    if (e.type === "tick") {
      events = [];
      if (
        now - this.sensors.lastHeartbeat > policy.heartbeatTimeoutMs &&
        !this.device.faults.includes("uart-timeout")
      ) {
        events.push({ type: "uart-timeout" });
        this.record(
          now,
          "watchdog",
          this.device.mode,
          "RP2040 heartbeat expired; inhibit amplifier",
        );
      }
      if (
        now - this.lastActivity > policy.displayTimeoutMs &&
        this.device.displayAwake
      )
        events.push({ type: "display-timeout" });
      if (
        positionAt(this.playback, now) >=
        this.playback.queue[this.playback.index].duration
      ) {
        this.playback = playbackEvent(this.playback, { type: "next" }, now);
        this.record(
          now,
          "queue",
          this.device.mode,
          "Track ended; advanced queue",
        );
      }
    }
    for (const action of events) {
      if (
        [
          "play",
          "pause",
          "next",
          "previous",
          "seek",
          "disconnect",
          "reconnect",
        ].includes(action.type)
      )
        this.playback = playbackEvent(this.playback, action, now);
      this.device = transition(this.device, action);
      if (
        ["play", "pause", "seek", "next", "previous", "presence"].includes(
          action.type,
        )
      )
        this.lastActivity = now;
      if (action.type === "disconnect")
        this.device = transition(this.device, { type: "pause" });
      this.record(
        now,
        action.type,
        this.device.mode,
        action.type === "volume"
          ? `Preview volume ${this.audio.volume}%`
          : action.type === "mute"
            ? `Preview mute ${this.audio.muted}`
            : `${before.mode} → ${this.device.mode}; ${action.type}`,
      );
    }
    if (!this.device.playing || !this.playback.connected)
      this.playback = playbackEvent(this.playback, { type: "pause" }, now);
    if (!this.playback.connected)
      this.device = transition(this.device, { type: "pause" });
    if (
      e.type !== "tick" ||
      before.amplifierEnabled !== this.device.amplifierEnabled
    ) {
      const command = this.safety.reconcile(this.device);
      this.record(
        now,
        "amplifier-request",
        this.device.mode,
        `${command.enabled ? "ENABLE" : "MUTE/DISABLE"} simulated request; ${this.device.faults.join(", ") || (!this.device.verified ? "hardware unverified" : this.device.mode)}`,
      );
    }
    return this.snapshot(now);
  }
  snapshot(now = Date.now()) {
    return {
      audio: this.audio,
      device: this.device,
      playback: {
        ...this.playback,
        position: positionAt(this.playback, now),
        observedAt: now,
      },
      sensors: this.sensors,
      log: this.log,
      mode: "simulation",
    };
  }
}
const active = [
  { type: "boot" },
  { type: "boot-complete" },
  { type: "temperature", value: 35 },
  { type: "wifi", value: true },
  { type: "reconnect" },
  { type: "heartbeat-enabled", value: true },
  { type: "power-good", value: true },
  { type: "heartbeat" },
  { type: "simulation-verified" },
  { type: "play" },
];
export const scenarios = {
  "Cold boot": [{ type: "boot" }, { type: "boot-complete" }],
  Playback: active,
  Standby: [...active, { type: "standby" }],
  "Wake on presence": [
    ...active,
    { type: "standby" },
    { type: "presence", value: true },
  ],
  "Safe shutdown": [...active, { type: "shutdown" }],
  "Network loss": [...active, { type: "wifi", value: false }],
  "Low voltage": [...active, { type: "power-good", value: false }],
  "Thermal fault": [...active, { type: "temperature", value: 90 }],
  "Controller disconnect": [
    ...active,
    { type: "heartbeat-enabled", value: false },
    { type: "tick", advance: 4000 },
  ],
};
export function runScenario(runtime, name, now = Date.now()) {
  if (!scenarios[name]) throw Error("Unknown scenario");
  runtime.record(now, "scenario", runtime.device.mode, `Start ${name}`);
  let at = now;
  for (const { advance = 0, ...e } of scenarios[name]) {
    at += advance;
    runtime.dispatch(e, at);
  }
  return runtime.snapshot(at);
}
