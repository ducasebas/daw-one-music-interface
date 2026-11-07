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

The server-side MA WebSocket transport supports token auth, player/queue snapshots, commands, event refresh and automatic reconnect/backoff. Credentials stay on the backend. See [live Music Assistant setup](music-assistant.md) for source references and compatibility limits. Protocol tests use a fake WebSocket; owner-reported MA 2.10.9/Pi-jack playback is recorded in [the field report](field-test-2026-11-01.md), while full compatibility and stability remain unverified.

End-Sync: `offset = videoDuration - audioDuration + manualCorrection`; `videoPosition = audioPosition + offset`. Negative offset waits for audio to catch up. Clamp to valid video range; missing durations, wrong match or unavailable embed fall back. Intro is a verified minimum useful video time. Pause/seek recompute from audio clock. UI's local animated artwork is a mock video with duration 360 s and intro 10 s. There is no external video search, embed or guaranteed content matching. Duration/intro values are labelled demonstration inputs, not track metadata. Safari autoplay restrictions must be handled by a later real media adapter using an explicit user gesture.


Live music additions: `GET /api/events` streams snapshots with SSE; `POST /api/player` accepts `{id}` for an explicitly selected available player. `GET /api/state` includes redacted `musicAssistant` connection/player/control status. Live `/api/event` allows playback commands plus `volume` (numeric `value`) and `mute` (boolean `value`); simulator actions and `/api/scenario` reject with 409 in live mode. Commands rejected by the service show a notice without falsely labelling the entire backend offline.

Simulation audio commands `volume` and `mute` now update shared runtime audio (`snapshot.audio`) and timeline events, keeping the product, case speaker indication and multiple browser clients consistent. The workbench is a browser-only observer/controller; it does not introduce a second device state machine.

## Display activity

`POST /api/activity` returns `{ok:true}` and refreshes the shared display-idle timer in simulation and live-music modes. It does not send a Music Assistant command. Only a ready device's display can wake; standby, shutdown, fault latches, hardware verification and amplifier enable remain unchanged. A wake emits `display-wake` and broadcasts state; ordinary activity does not flood the timeline. The browser throttles real input with a trailing update. Passive hover and playback updates are excluded. GPIO/backlight drivers remain unimplemented.

SSE delivery handles writable-stream backpressure without treating it as a disconnect. Each slow client retains only its latest pending snapshot until drain; heartbeats do not replace waiting snapshots. Closed clients are removed. This prevents a large event log from causing false offline transitions. If the SSE transport errors, the frontend verifies connectivity through the HTTP snapshot fallback rather than declaring a healthy backend offline immediately.

GUI 2.12 adds read-only catalogue/search and guarded play/next/add routes plus a restricted artwork proxy. See [library contract and compatibility limits](music-library.md).

## Device setup and update control (GUI 2.14)

`GET /api/updates` is never cached. It returns sanitised phase/download/current/available release data, device-manager capabilities/policy and a process-bound control nonce. Raw errors, Wi-Fi passwords and MA tokens are excluded. `POST /api/device` requires this nonce as `X-TuneBox-Control`, JSON `{command,args}`, and same-origin validation. Production forwards the bounded command to a protected Unix socket; development simulation uses the same `DeviceManager` protocol and update policy/transactions.

Allowed commands: `status`, `policy`, `check`, `install`, `rollback`, `network`, `wifi`, `probe-music`, `save-music`, `audio-test`, `complete-setup`. Unknown commands/fields, arbitrary paths, non-local MA URLs and unverified audio devices are rejected. `audio-test` accepts only `plughw:CARD=Headphones,DEV=0` and the real adapter additionally checks bcm2835 Headphones identity and safe idle state. There is no GPIO/shell endpoint. The MA/wifi credential fields exist only in their explicit setup request and protected OS storage, not in public status or local storage.

Root status/commands use `/run/daw-one-manager/control.sock` (root:dawone 0660). The independent progress HTTP server at 127.0.0.1:3002 exposes only `GET /` and `GET /status`; it accepts no management commands. Update phases are logged without credentials to the update service journal; simulated update phases also enter the common simulator event timeline. See [OTA](ota-updates.md) and [setup](first-run-wizard.md) for operating boundaries.

## Local PCM measurement (GUI 2.15)

`GET /api/audio` returns `{enabled, configured, status, source, simulated:false, playerId, matchesSelected, precisionBits:16, unit:"dBFS", measurement}`. `measurement` is null outside fresh PCM/silence and contains per-channel RMS/peak/full-scale counts, 32 stereo-power FFT bands (unresolved bands are null), sample rate, window size/duration, source/capture timestamps and analyser processing time. `?watch=1` renews a short capture lease only for a globally enabled reader and awake display. No raw PCM is returned and responses are never cached.

`POST /api/audio/settings` requires the existing same-origin control nonce and exactly `{enabled:boolean}`. It persists a global software measurement switch; it accepts no source path, executable, ALSA device or player identity. The native helper uses the `TBP1` bounded binary frame protocol over its own stdout, reads only the root-configured shared-memory source and never locks or changes the Squeezelite producer. See [native installation, ABI evidence, timing and gain limitations](audio-analysis.md). This telemetry does not alter amplifier safety or playback state.

## Wall presentation / Wi-Fi status

`GET /api/network` is read-only and returns `{supported, connected, signal, simulated?, observedAt, interfaces}` through the existing local device manager. `signal` is NetworkManager quality0–100 or null; it is not throughput, RSSI dBm, an internet ping, or the remote browser's Wi-Fi. Results are cached/coalesced30seconds. No SSIDs/passwords are returned. Missing manager or measurement remains unknown. Simulation may return no signal; never infer a percentage from a successful HTTP connection.

Existing `POST /api/event` with `{type:"display-timeout"}` enters screen rest; `{type:"activity"}` wakes display only. Activity in device standby leaves the mode standby and the amplifier inhibited. Screen preferences are normalized browser-local settings, not hardware commands. `panel=wall-16-10` changes geometry only and cannot change a kernel overlay, physical timing or safety verification.
