# GUI 3.2.4 · STARTUP

Release `2026.11.12-startup.1`, 12 November 2026. This follows the real Pi's first signed OTA activation to GUI 3.2.3 and the owner's confirmed real PCM spectrum. It retains the existing Music Assistant connection, player identity, audio route and settings.

## Findings and changes

Both video URLs returned HTTP 200 with the correct MIME type on the Pi. The missing animation was not explained by an absent file. A production browser test then reproduced a failed video byte-range request while the actual service worker controlled the page: the worker attempted `cache.put()` with HTTP 206, which CacheStorage rejects, and returned a network error. This can surface as the reported media error 4. Development tests did not register that worker.

The worker now bypasses video and Range requests. Only complete HTTP 200 responses are eligible for caching, and a cache write failure cannot discard a successful network response. Tests exercise HTTP 206 data and an actual VP8 decoder after a controlled production reload.

The default splash is now the owner's animation exported as animated WebP at 1280 × 800, 24 fps and four seconds. It is 438998 bytes. MP4 is 150399 bytes and WebM 292484 bytes: WebP was selected to avoid dependence on the video-player path for this short branding sequence, not because it is universally smaller or lighter. Physical Pi CPU/memory use still needs observation.

Each replay creates a fresh image URL; the worker keeps one canonical offline copy. A WebP loading failure tries MP4, then WebM, then the PNG/CSS fallback. Still and Off remain explicit choices. Auto retains a still on Pi 3 and under reduced motion; explicit Animation overrides that policy. The end image remains visible while a device is still booting. Fault/shutdown and ready-screen dismissal take priority.

Splash diagnostics show `image-animation`, `/media/startup.webp` and elapsed presentation time for WebP. Browser image playback does not expose decoded-frame statistics, so those fields remain unavailable. Video reserves report their real media time and decoded/dropped frames instead. A Mac browser reports its own playback, not the kiosk's.

## Kiosk and quiet boot

The first OTA installed commit `75c388c3e538425104ce8ab739d8c2b4b77a4782`, but the old kiosk unit's `Requires=daw-one.service` stopped Chromium when the backend restarted. The Pi had already finished booting in 27 seconds; the Linux console left visible afterward did not demonstrate a cloud-init hang.

New units use `Wants=daw-one.service`. The trusted OTA installer migrates older units with a backup while retaining other dependencies and kiosk settings. The updater also restarts a kiosk that was active at the start of activation/recovery. Updating application files alone does not replace root-installed helpers.

The owner has already changed the dependency and run `deploy/display/quiet-boot.py` on the current Pi. Its output confirmed backups and successful configuration. The boot text settings take effect at the next reboot. No new signing key, PCM installation or repeat of those repair commands is needed.

## Pi acceptance

1. Wait for the signed preview release for GUI 3.2.4. Pause playback on TuneBox and its group, keep Music Assistant connected, then use **Settings → Updates → Check updates → Install update**. Observe whether the progress page stays visible through the backend restart.
2. Confirm `/api/health` reports `GUI 3.2.4 · STARTUP` / `2026.11.12-startup.1` and the published `deploymentCommit`.
3. In **Settings → Playback**, choose **Animation**, Save and **Replay startup**. Confirm four seconds of visible motion, then repeat. Diagnostics should report `image-animation` and `/media/startup.webp`. Check Still and Off separately.
4. With playback stopped, reboot normally. Confirm boot text is hidden, the display reveals the animation and the interface returns. The first cold-boot result remains a physical acceptance test, not a browser-test claim.
5. Resume music and confirm the existing real spectrum. Exercise moon/wake, one-checkbox Save and Settings → All settings → Now Playing. Rollback remains a separate, explicit acceptance check.

`npm run doctor` now also checks that the primary WebP is served with `image/webp`. Automated verification includes actual changing image pixels, replay and offline playback with the production worker, video byte ranges/decoding, still/fault behavior, Pi 3 policy override, kiosk migration and the existing settings/audio/wake suites. These checks do not certify electrical hardware or physical DSI timing.
