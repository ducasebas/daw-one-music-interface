/** @typedef {'booting'|'ready'|'standby'|'fault'|'shutting-down'} DeviceMode */
export const faultNames = [
  "uart-timeout",
  "controller-reboot",
  "amplifier-fault",
  "thermal-alarm",
  "power-good-failure",
  "service-crash",
];
export function initialDevice() {
  return {
    mode: "booting",
    verified: false,
    controllerReady: false,
    powerGood: false,
    faults: [],
    playing: false,
    displayAwake: true,
    amplifierEnabled: false,
  };
}
export function amplifierAllowed(s) {
  return (
    s.mode === "ready" &&
    s.verified &&
    s.controllerReady &&
    s.powerGood &&
    s.faults.length === 0 &&
    s.playing
  );
}
/** Pure transition function: faults latch; acknowledgement never restores verification. */
export function transition(state, event) {
  let s = { ...state, faults: [...state.faults] };
  if (faultNames.includes(event.type)) {
    s.faults = [...new Set([...s.faults, event.type])];
    s.mode = "fault";
    s.playing = false;
    s.verified = false;
    s.controllerReady = false;
  } else
    switch (event.type) {
      case "boot":
        s = initialDevice();
        break;
      case "boot-complete":
        if (s.mode === "booting") s.mode = "ready";
        break;
      case "play":
        if (s.mode === "ready") s.playing = true;
        break;
      case "pause":
        s.playing = false;
        break;
      case "standby":
        if (s.mode === "ready") {
          s.mode = "standby";
          s.playing = false;
          s.displayAwake = false;
        }
        break;
      case "presence":
        if (s.mode === "standby") s.mode = "ready";
        s.displayAwake = true;
        break;
      case "display-timeout":
        s.displayAwake = false;
        break;
      case "shutdown":
        s.mode = "shutting-down";
        s.playing = false;
        break;
      case "acknowledge":
        if (s.mode === "fault") {
          s.mode = "standby";
          s.faults = [];
          s.playing = false;
        }
        break;
      // Simulation only. Production controller must never accept browser verification.
      case "simulation-verified":
        if (s.mode === "ready") {
          s.verified = true;
          s.controllerReady = true;
          s.powerGood = true;
        }
        break;
    }
  s.amplifierEnabled = amplifierAllowed(s);
  return s;
}
export function reduceEvents(s, events) {
  return events.reduce(transition, s);
}
