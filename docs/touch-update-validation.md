# GUI 3.1 validation record

This record distinguishes automated software checks from the remaining physical Pi acceptance. The target is a Raspberry Pi 4 with the Waveshare 7inch DSI LCD (E), 1280 × 800.

The owner confirmed that the previous GUI3.0 release rendered on the real panel on 11 November 2026. Pi4 detection, `daw-one-sensors.service`, `daw-one-manager.service` and the sysfs backlight `10-0045` were reported. The owner also confirmed Squeezelite `VISEXPORT` support and the inactive `daw-one-update.timer`. Brightness control, quiet cold boot and this release's ergonomics have not yet been tested on that hardware.

Tests cover independent display policy persistence, no playback/amp changes on sleep/wake, monotonic bounded lux mapping and stale fallback, preservation of boot/root/serial parameters, upload streaming/container checks/cleanup, track-specific local video links, locale key parity and live language switching. Browser checks include actual uploaded-video decode/sync, physical-size hit targets, all rest modes and large settings categories. Fixture sensor/audio tests are explicitly software tests, not measured device values.

## Software checks, 11 November 2026

- Node domain, integration, packaging and protocol suite: **145 passed**. Shutdown tests use injected command runners and never execute host shutdown.
- Python sensor/export/archive/display checks: **11 passed**.
- Chromium native touch and startup suite: **13 passed** in the final combined run, including all ten wall-screen flows and three legacy startup checks. Power off cancellation, confirmation, simulated dark state and rejection during updates are covered.
- Separate decoded-startup/replay/wake regression run: **8 passed**.
- Final language, setup-credential and filtered-sensor follow-up: **3 passed**.
- The earlier full 62-journey Chromium run finished with 59 passes, two transient navigation/element-stability timeouts and one remaining Dutch expectation. The expectation was corrected; the three selected cases passed twice (6 passes). The final wall flows additionally cover the new startup choice and shutdown controls.
- Production/offline suite: **7 passed**, covering cached UI, volume authority, settings, screen rest and wake. Screenshots are explicitly software simulation.

Checks used the installed system Chromium with `TUNEBOX_CHROMIUM_PATH=/usr/bin/chromium`. WebKit could not run locally because its system libraries are missing and the environment has no root installation access. The GitHub Verify workflow retains its separate WebKit check; no local WebKit pass is claimed.

`npm run package:pi` runs the Node suite and production build again before creating the bundle. `release-manifest.json` records a SHA-256 for each packaged file; verification checks the extracted inventory and built release ID. The archive checksum is provided beside the downloadable package rather than embedded in a document that would change its own hash.

No successful physical shutdown, OTA/rollback, quiet cold boot, backlight control, thermal, HAT or electrical validation is claimed. Physical power removal requires additional hardware; the new power-off control requests an orderly OS shutdown and dark panel only.
