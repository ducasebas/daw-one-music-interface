# GUI 3.2.1 · SPLASH

Release `2026.11.12-splash.1`, 12 November 2026. Includes the owner's new TuneBox / DUTCHAUDIOWORKS cold-start design with the warm amber glow along the lower edge. Existing playback, Music Assistant credentials, sensor configuration and saved settings are retained.

## Media

| File | Format | Purpose |
| --- | --- | --- |
| `public/media/startup.mp4` | H.264 Main / level 3.2, yuv420p, 1280 × 800, 30 fps, 4 seconds, no audio | Primary Pi playback; 150399 bytes |
| `public/media/startup.webm` | VP8, yuv420p, 1280 × 800, 30 fps, 4 seconds, no audio | Codec fallback; 292484 bytes |
| `public/media/startup-still.png` | Final settled video frame, 1280 × 800 | Still/reduced-motion/Pi3 and failed-video fallback |
| `design/brand/tunebox-cold-start-master.mp4` | Owner's original Canva export, 3642 × 2276, H.264, 30 fps, 4 seconds | Retained master export for future sizes; 464093 bytes |

The original export is almost exactly 16:10. The Pi derivatives use square pixels and the screen's exact native geometry. The editable Canva project remains the design source; an exported video does not retain vector text/shape editing. A future 16:9 display needs a separately composed export.

## Playback and cache

MP4 is preferred for the Pi. On a decode/playback error, or a bounded source timeout, the component explicitly retries WebM. If both sources fail, the existing still/fade fallback appears. This addresses the previous GitHub browser run, where three animation checks reached the still fallback before playing video.

The decoded first frame is primed at media time zero before playback starts. The actual video `ended` event completes the four-second animation; a slow load does not consume the animation's playback time. Pi3 and reduced-motion modes retain a still option. Existing settings also offer Off and Replay startup. The service-worker cache is bumped so the previous still image is replaced.

This changes application media and codec recovery, not DSI timing, early Linux boot messages or the physical backlight configuration. Cold boot and decode performance still need the owner's Pi test.

## Install

Use the new prebuilt application bundle with the same reviewed installer as the GUI 3.2 update. From the extracted bundle on the Pi:

```sh
sudo bash deploy/install.sh --target auto --prebuilt --music-assistant skip --updates skip
sudo /opt/daw-one/set-panel-profile.sh wall-16-10
sudo /opt/daw-one/set-display-mode.sh dsi-production
sudo systemctl restart daw-one-kiosk.service
cd /opt/daw-one
npm run doctor
```

An existing OTA-slot installation must use its OTA update path rather than the plain reinstall. See [setup and installation](setup-update.md) and [signed OTA prerequisites](ota-updates.md).

Check the visible software identifier `GUI 3.2.1 · SPLASH`. In **Settings → Playback**, select Animation and tap **Replay startup**. Check the complete typing/fade/glow sequence, the still option, Off, and a real cold boot.

## Publication and OTA status

The GitHub Verify workflow must pass before its signed-preview workflow can publish. A signing secret and pinned project public key are additionally required. A source commit or local tarball does not activate the Pi update timer or establish that a signed OTA release is available. No key, Pi timer or remote device is changed by this media update.

## Verification

Both derivatives were inspected with ffprobe and completely decoded with ffmpeg without errors. Browser checks cover actual playback, fallback after deliberately invalid MP4 data, the four-second 1280 × 800 WebM result, both-source failure, reduced motion, first-frame priming and completion on the media clock. Seven targeted Chromium startup/replay/recovery checks passed, including the invalid-MP4 → WebM path; the production/offline wall-screen check also passed. The production build passed. No physical Pi playback or signed OTA pass is inferred.
