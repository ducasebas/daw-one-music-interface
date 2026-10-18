import { amplifierAllowed } from "./device.js";
// Proposed JSON-lines protocol v1. No physical transport or GPIO writes exist.
export function decodeFrame(line) {
  if (line.length > 1024) throw Error("oversize");
  const f = JSON.parse(line);
  if (
    f.v !== 1 ||
    !Number.isSafeInteger(f.seq) ||
    f.seq < 0 ||
    !["hello", "heartbeat", "fault", "ack", "disable", "enable"].includes(
      f.type,
    )
  )
    throw Error("invalid frame");
  return f;
}
export class SimulatedController {
  constructor() {
    this.lastSeq = -1;
    this.enabled = false;
  }
  command(frame, state) {
    const f = decodeFrame(JSON.stringify(frame));
    if (f.seq <= this.lastSeq) throw Error("replayed frame");
    this.lastSeq = f.seq;
    this.enabled = f.type === "enable" && amplifierAllowed(state);
    return {
      v: 1,
      seq: f.seq,
      type: "ack",
      enabled: this.enabled,
      simulated: true,
    };
  }
}
export class AmplifierSafetyManager {
  constructor() {
    this.controller = new SimulatedController();
    this.seq = 0;
  }
  reconcile(state) {
    return this.controller.command(
      {
        v: 1,
        seq: this.seq++,
        type: amplifierAllowed(state) ? "enable" : "disable",
      },
      state,
    );
  }
}
