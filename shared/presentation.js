import { amplifierAllowed } from "./device.js";
import { policy } from "./runtime.js";
/** Logical simulation projection, never a claim about measured electrical rails. */
export function devicePresentation(
  snapshot,
  { offline = false, volume = 32, now = Date.now() } = {},
) {
  const { device: d, playback: p, sensors: s = {} } = snapshot;
  const heartbeat =
    s.heartbeatEnabled === true &&
    Number.isFinite(s.lastHeartbeat) &&
    now - s.lastHeartbeat <= policy.heartbeatTimeoutMs;
  const running = d.mode !== "shutting-down";
  const enabled =
    !offline && amplifierAllowed(d) && s.powerGood === true && heartbeat;
  const driven = enabled && p.connected && p.playing && volume > 0;
  const led = offline
    ? "unknown"
    : d.mode === "fault"
      ? "fault"
      : d.mode === "standby"
        ? "standby"
        : d.mode === "booting"
          ? "booting"
          : d.mode === "shutting-down"
            ? "off"
            : driven
              ? "playing"
              : "ready";
  const module = (id, label, status, detail) => ({
    id,
    label,
    status: offline ? "unknown" : status,
    detail: offline
      ? "Backend unavailable; last state is not live telemetry."
      : detail,
  });
  return {
    led,
    enabled,
    driven,
    displayAwake: !offline && d.displayAwake && running,
    modules: [
      module(
        "pi",
        "Raspberry Pi",
        running ? "on" : "off",
        "Virtual application host. Physical Pi power is not measured.",
      ),
      module(
        "controller",
        "RP2040",
        heartbeat && running ? "on" : "off",
        heartbeat
          ? "Simulated heartbeat is fresh."
          : "Simulated heartbeat missing or controller stopped.",
      ),
      module(
        "power",
        "PD power",
        s.powerGood ? "on" : "off",
        "Simulated power-good input; no measured rail voltage.",
      ),
      module(
        "wifi",
        "Wi-Fi",
        s.wifi ? "on" : "off",
        "Simulated network availability; no actual RF or signal-strength measurement.",
      ),
      module(
        "music",
        "Music Assistant",
        p.connected && s.wifi ? "on" : "off",
        "Mock source connectivity, not a live Music Assistant integration.",
      ),
      module(
        "amplifier",
        "Amplifier",
        d.mode === "fault" ? "fault" : enabled ? "on" : "inhibited",
        enabled
          ? "Simulated enable permitted by shared safety logic."
          : "Muted/inhibited: verification, power-good, heartbeat and playback gates apply.",
      ),
      module(
        "display",
        "Display",
        d.displayAwake && running ? "on" : "sleep",
        "Display sleep is independent from safe simulated audio playback.",
      ),
      module(
        "speakers",
        "Speakers",
        driven ? "on" : "off",
        driven
          ? "Simulated signal requested on both channels. No real sound or measured speaker power."
          : "No simulated speaker drive; no real audio is emitted.",
      ),
    ],
  };
}
