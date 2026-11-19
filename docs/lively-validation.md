# GUI 3.11.0 · LIVELY (incl. 3.10.1 HOTFIX) — validation

Local candidate; simulator and unit results only. No Pi observations.

## Tests added
- `now-playing.test.js`: widget selection bounds, backdrop source (local artwork only, static in low-power, off), each tile with real values and honest "Not available", power never shows consumption without a confirmed reading or a stale one.
- `remote-control.test.js`: remote style/next/quality, and no telemetry, time zone or theme preferences leak to the phone.
- `integration.test.js` (3.10.1): `queue_seek` capability, `player_queues/seek` command, service routing.
- `lively.spec.js`: backdrop live + cross-fade to the next cover, Pi 3 static and off switch (no artwork layers), widgets chosen in Display with the 4-tile limit and navigation, remote skin variables + Up next + quality + progress.
- `connect.spec.js` (3.10.1): scrubbing a `queue_seek`-only player by touch.

## Results
See the final run recorded below.

## Evidence
Screenshots in [images/lively-3-11](images/lively-3-11): `before-playing-3.10.png`, `lively-playing.png`, `lively-playing-pi3.png`, `lively-remote-*.png`.

## Not observed on the Pi
- Smoothness and CPU/temperature of the blurred backdrop on the real Pi 4 panel.
- Real artwork from Music Assistant; real source format reporting; widget values on hardware.
- 3.10.1: whether the owner's Squeezelite player lacks native `seek` (diagnostic requested, not yet answered) and whether `player_queues/seek` moves playback on the real server.
- Phone remote style on a real phone over the home Wi-Fi.
