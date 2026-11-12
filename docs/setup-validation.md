# GUI 3.2 validation record

11 November 2026. These are software results in the development environment. No Pi installation, USB microphone, HAT, GPIO button, physical screen or power supply was accessed by this task.

- Domain/integration/native PCM suite: **155 passed**. The final six measurement/domain tests also passed, including the additional measurement/OTA exclusion test: 156 distinct tests covered. The combined npm package check was blocked by execution permissions; no second full-suite pass is claimed.
- Python tests: 14 passed, including UART frame fragmentation, debounce/long-press single action and transparent Xcursor binary structure.
- Full Chromium suite: 71 of 73 passed initially. Two expectations used the previous release label and expected Discover widgets on the Now Playing page. The corrected two cases passed on rerun: all 73 journeys have passed. Coverage includes legacy and 1280×800 layouts, native touch controls, all skins, central Save/Cancel/defaults/conflicts, PIN backend guards, Wi-Fi keyboard/QR setup, repeated onboarding, diagnostic download, room-profile/target selection, simulation hardware blocking, uploaded video decode, splash decode/replay and confirmed shutdown without host shutdown.
- Built production/offline suite: 7 passed. Cached visual preferences remain accessible without granting offline device authority.
- New measurement DSP target calculations preserve baseline data, offer genre-based suggestions, bound cuts/boosts and reject invalid input. Known synthetic PCM fixtures verify a flat recorded response and noise/clipping rejection. No acoustic or physical frequency-response pass is inferred.
- Shell syntax checked for all 18 deployment shell scripts. Root operations are restricted to installed commands and fixed helpers; network credentials do not enter process argv or debug capture.
- WebKit was not run locally: its required system libraries are absent. The GitHub Verify workflow retains its separate WebKit check.

## Hardware acceptance still open

Install the release on the Pi, then verify DSI cursor suppression, cold boot/first decoded splash frame, physical brightness and screen-off/wake, real sensor freshness, Wi-Fi reconnect/AP timeout, signed OTA setup, actual USB capture/output routing and post-DSP sweep, player group behavior, and shutdown/wake. The shared GPIO3 sensor clock needs a concrete single-button wiring design. INA228/PD controller telemetry, fan tachometer and presence UART are conditional on verified connected hardware.

The project signing key/GitHub secret and Pi update timer were not provisioned by this task. Source publication and a downloadable release bundle do not mean the Pi is automatically updated. New trusted root/helper changes require a reviewed installer refresh; app OTA does not execute candidate application code as root.

The final archive was assembled from the tested production frontend and current deployment sources using the release manifest format. Its inventory, every file hash and credential exclusions were independently verified. It is an unsigned manual-install bundle; this is separate from an activated OTA release.
