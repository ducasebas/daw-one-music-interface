# Shared device API and controller proposal

Backend defaults to loopback and simulation. Vite proxies `/api`. There is no authentication: keep Codespaces port **private**; never expose device mutation APIs directly to the Internet. Every browser in the same Codespace shares one virtual device, while UI settings belong to each browser.

- `GET /api/health`: HTTP liveness, mode, device state; never proves hardware availability.
- `GET /api/state`: `{device, playback, sensors, log, mode: "simulation"}`. Times in log are ISO UTC, playback observation in Unix milliseconds.
- `POST /api/event`: JSON `{type, ...}`. Supported type list is `eventTypes` in `shared/runtime.js`; malformed values yield 400. Seek uses `position` seconds; sensors use `value`; button uses `button` (`play-pause`, `standby`, `wake`).
- `GET /api/scenarios`: available scenario names.
- `POST /api/scenario`: `{name: "Cold boot"}`. Runs deterministic transitions and logs each step. Controller-disconnect advances a virtual clock 4 seconds; it does not block the request. All values/actions are explicitly simulated.

The runtime holds central device, safety, sensor, playback, timestamp and log contracts. Browser doesn't maintain a second safety engine. `shared/device.js` pure reducer and `AmplifierSafetyManager` are the intended reuse points for a future Pi hardware service. Physical transports do not exist yet; real driver integration must preserve the safety gate and add fresh verified telemetry plus independent controller protection.

## Proposed RP2040 protocol v1 — not deployed firmware

UTF-8 JSON lines, maximum 1024 characters per frame. Fields `v:1`, monotonically increasing `seq` integer, `type`. Proposed types: `hello`, `heartbeat`, `fault`, `ack`, `disable`, `enable`. Simulated ACK includes `enabled` and `simulated:true`. Replay/malformed frames rejected. `SimulatedController` is an in-memory model, not serial emulation. Baud rate, pins, framing integrity, CRC, handshake identity, heartbeat negotiation, sequence reset and real telemetry schema remain firmware design blockers. No electrical timings are asserted. A real enable request must be independently validated by the controller; a stale/absent ACK must inhibit output. That physical path is not implemented.

## Music and video

Transport-injected MA adapter supports connect, snapshot, event subscription, controls, explicit reconnect and close. Live client, automatic retry/backoff, token handling and supported-version validation remain unimplemented. Tests use a fake transport; mock library is not a real streaming service.

End-Sync: `offset = videoDuration - audioDuration + manualCorrection`; `videoPosition = audioPosition + offset`. Negative offset waits for audio to catch up. Clamp to valid video range; missing durations, wrong match or unavailable embed fall back. Intro is a verified minimum useful video time. Pause/seek recompute from audio clock. UI's local animated artwork is a mock video with duration 360 s and intro 10 s. There is no external video search, embed or guaranteed content matching. Duration/intro values are labelled demonstration inputs, not track metadata. Safari autoplay restrictions must be handled by a later real media adapter using an explicit user gesture.
