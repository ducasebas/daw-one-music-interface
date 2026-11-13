# GUI 3.1 · TOUCH — physical-screen update

Release: **2026.11.11-touch.1**. Target: the owner's Pi 4 and Waveshare 7inch DSI LCD (E), 1280 × 800. The owner reported the GUI running on the physical screen before this update. This release still needs a physical acceptance run for brightness, cold boot and the new controls.

## What changes

- A 164 px playback bar, 104 px play/pause target, 72 px previous/next targets, larger volume controls and 2 px SVG/control outlines at native resolution.
- A full-screen 236 px clock, larger date and sensor widgets. The rest view does not show a “Screen rest” heading. One touch wakes it, with immediate pending feedback, without triggering a playback command.
- Settings use a large category sidebar: Playback, Display, Appearance, Audio, Video, Connections, Sensors, Updates, System and Language. The detail pane can scroll independently. Done returns to Now Playing.
- English is the default; Dutch is selectable under Language and persists locally. [Translation contributions](translations.md) use JSON catalogs in GitHub.
- The display timeout is saved on the backend, with Never, 30 seconds and 1–30 minute choices. Default: two minutes. Playback and amplifier state are independent.
- Display controls the real DSI backlight through a separate installed service. Automatic brightness uses fresh TSL2591 readings, a bounded logarithmic curve and smoothing. A stale/missing sensor uses the saved manual brightness; it never invents a lux value.
- PCT2075 and TSL2591 have a dedicated Sensors page, plus screen-rest widgets. Temperature is filtered and displayed to one decimal; lux is rounded to a whole number. The header temperature shortcut opens Sensors.
- The cursor is hidden in the DSI kiosk. Desktop simulation keeps its pointer.
- A separate **Power off** control in the header and System settings asks for confirmation, then stops this device's local audio endpoint, darkens the panel and requests a normal systemd shutdown. It does not stop a Music Assistant group or cut mains/PD power. Software updates block shutdown while running. Simulation only previews the dark state and never shuts down the development host.
- Pi startup prefers the existing H.264 MP4, with WebM and a bounded still/fade fallback. Startup choices and Replay startup are in Playback settings. Reduced motion and the Pi3 profile still have a static option. The last renderer choice is recorded in browser storage as `tunebox-startup-status` for diagnosis.

## Update the Pi

Use a newly built release bundle. From a trusted source checkout on your development machine:

```sh
npm ci
npm run package:pi
scp tunebox-release.tar.gz YOUR_PI_USER@YOUR_PI_IP:~/tunebox-touch-update.tar.gz
```

Then, over SSH on the Pi:

```sh
tunebox_update_dir=$(mktemp -d "$HOME/tunebox-update.XXXXXX") &&
tar -xzf "$HOME/tunebox-touch-update.tar.gz" -C "$tunebox_update_dir" &&
cd "$tunebox_update_dir" &&
sudo systemctl stop daw-one-kiosk.service &&
sudo bash deploy/install.sh --target auto --prebuilt --music-assistant skip --updates skip --quiet-boot --audio-analysis &&
sudo /opt/daw-one/set-panel-profile.sh wall-16-10 &&
sudo /opt/daw-one/set-display-mode.sh dsi-production &&
sudo systemctl enable --now daw-one-kiosk.service &&
curl -fsS http://127.0.0.1:3001/api/health
```

Expect `GUI 3.1 · TOUCH`. The normal installer refuses to overwrite an OTA-slot symlink; use the OTA recovery/migration instructions in that case. Existing Music Assistant credentials, player service and sensor service are retained. PCM export configuration can restart the player once when `-v` is added.

## Cold boot and physical brightness

On the verified Pi4 backlight `10-0045`, installation adds `daw-one-display.service`. It starts with brightness zero, then reveals the display after the browser has drawn the decoded first splash frame or fallback. A 90-second fail-open prevents a broken app from leaving the display dark indefinitely. Stopping the controller restores 80% brightness.

`--quiet-boot` backs up `config.txt` and `cmdline.txt`, retains the local `console=ttyN` console target (restoring `console=tty1` if absent), preserves serial/root/network arguments, and adds quiet/status/cursor flags plus `disable_splash=1`. This hides firmware/kernel text before the later backlight service can run. It does not rewrite the selected DSI overlay, root partition or networking. A **reboot is required** to assess the early-boot change; a kiosk restart cannot test it. Physical panel/firmware behaviour is still a hardware acceptance item.

Recovery over SSH:

```sh
sudo systemctl stop daw-one-display.service
sudo systemctl restart daw-one-kiosk.service
sudo journalctl -u daw-one-display.service -b --no-pager -n 60
```

Stopping the display service restores brightness. To undo quiet boot, restore the timestamped `.tunebox-backup-*` boot files you created and reboot. Keep SSH enabled.

## Real visualizer

The visualizer reads the existing local Squeezelite PCM export; it is not derived from song metadata. The installer’s `--audio-analysis` option detects the running service's existing explicit `-m` identity, verifies that its binary supports visualizer export, installs the native reader and adds only `-v` when required. It preserves the audio output, server address and player identity. Unsupported builds or a missing explicit player ID leave the app installed and produce an actionable message rather than guessing an audio route.

In **Audio**, enable audio analysis and choose spectrum or stereo dBFS meters. In Now Playing, selecting the visualizer also enables an already-configured reader. Missing configuration opens Audio settings. Actual PCM processing is suspended when the display sleeps or no visible consumer requests it.

The owner confirmed on 11 November that the installed player advertises `-v Visualizer support` and `VISEXPORT` in its build options. This satisfies the export-build prerequisite; the installed reader, actual export and measured levels still require the Pi acceptance run. A silent, unavailable or stale stream is reported explicitly; there is no fake waveform. [Installation and measurement limits](audio-analysis.md).

## Real Video Artwork

The previous mock panel is replaced by muted local-video playback. In **Video**, link an MP4 or WebM to the current track. Files stream to persistent device storage without loading the whole video into Node memory. Limits: 96 MB/file, 256 MB total, 64 linked tracks. Playback supports HTTP range requests, actual media duration, pause, seek and end alignment with the Music Assistant clock. A correction value can align alternate edits. Video pauses during screen rest.

Only opaque generated filenames are served. Upload/delete actions require the existing same-origin control token. No arbitrary remote video URL is fetched. A new upload is bound to the track selected when it starts; it does not silently bind to the next song if playback changes during transfer.

Automatic matching of Spotify/Tidal tracks to a YouTube/music-video provider is **not connected**. Music Assistant track metadata alone does not supply an unrestricted video stream. Local linking is the implemented path in this release. H.264 MP4 is recommended for Pi decoding; codec support remains a hardware test.

## OTA status

The signed updater, idle deferral, progress and rollback implementation already exists. This manual package does not configure a signing key or claim a successful Pi OTA transaction. The repository currently has no published release assets, the previous Pi install used `--updates skip`, and the owner confirmed the real `daw-one-update.timer` is inactive.

Use the [one-time project signing setup](ota-updates.md), publish the first signed preview and install its matching public key on the Pi. The actual timer is **`daw-one-update.timer`**. A key is per project, not per device. Root display/manager programs and boot-file changes in this release require the manual installer; future application-only releases can use the established OTA channel.

## Physical acceptance

Check cold boot, complete animation, pointer hiding, all touch corners, volume, screen-rest modes and one-touch wake while music plays. Check automatic/manual brightness in a dark and bright room; disconnect/stale the lux feed and confirm manual fallback. Verify PCT/TSL readouts, actual PCM levels, two track changes and video pause/seek. Finally confirm **Power off**: local audio stops, backlight stays dark during shutdown, and another Music Assistant space keeps playing. After shutdown, start again by reconnecting power or using a supported hardware button. The Pi's supply LED and powered electronics may remain on; fully removing power requires an external hardware switch/controller. No HAT power-cut, deep-sleep or GPIO behaviour is claimed by this software function. Test signed OTA and an intentional rollback separately after configuring the project key. Automated browser tests do not replace these Pi checks.
