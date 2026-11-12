# GUI 3.2 · SETUP

Release `2026.11.11-setup.1`. For the Waveshare 7inch DSI LCD (E), 1280 × 800. The old 1280 × 400 profile remains available. Software tests and simulated browser flows do not certify the physical display, audio output or amplifier.

## Everyday operation

Settings opens with fifteen visible topics. Select a topic, edit, then **Save**. **Saved** appears after the backend acknowledges it. **Cancel** discards the draft; **Restore defaults** previews that topic's defaults until saved. Leaving an edited topic asks **Save / Discard / Stay**. Volume, mute and transport remain immediate. Real network, PIN, video upload, update and measurement operations have their own explicit action/confirmation.

Preferences are revisioned and saved on the device. A concurrent edit from another screen is rejected rather than overwritten. English is the default; Dutch can be selected under Language. Offline visual preferences can be previewed; saving device settings requires reconnection.

| Topic | How to use it | Installation or verification still needed |
| --- | --- | --- |
| Playback | Splash Off/Automatic/Animation/Still, touch slider/dial, maximum volume | Physical video decoding and first-frame reveal; MA's independent volume cap also applies |
| Display | Timeout, manual/lux automatic brightness, full-screen rest view, date/hint and meter colors | Installed backlight service and fresh TSL2591 data for automatic brightness |
| Appearance | Six skin tiles, custom colors; shared menu layout | Community skins use the existing token contract |
| Audio & DSP | Enable real PCM analysis, select visualizer, inspect actual Louder ALSA controls | Squeezelite VISEXPORT reader; HAT/driver must expose supported controls |
| Video | Link a local MP4/WebM to the current known-duration track; set sync correction | No automatic Spotify/Tidal video matching; uploaded files play muted |
| Connections | Wi-Fi scan, touch keyboard, phone setup QR; open the Music Assistant setup flow | NetworkManager and supported Wi-Fi hardware |
| Sensors | Complete readout; select up to four home-menu widgets and required-power warning threshold | Unknown/missing physical values remain unavailable |
| Presence | Enable detection, distance, software sensitivity, absence delay and night schedule | Explicit UART installer and verified HSP24/LD2410 wiring |
| Date & time | Time zone, 12/24-hour clock, NTP or explicit manual UTC time | System clock changes use the installed manager |
| Security | Six-digit PIN, lock now, disable with confirmation | Backend hash/session protection; SSH recovery if PIN is lost |
| Updates | Check/install, auto/notify/pause policy, time window and confirmed rollback | Project signing key, GitHub secret, pinned public key and active timer |
| System | Reopen first-start wizard, short-button action (screen rest or detected local ALSA mute), power off, reset preferences or setup | Button wiring and halted-state wake require a hardware check |
| Language | English or Nederlands | Contributions: [translations](translations.md) |
| Developer | Status, bounded history, hardware summary, updates/rollback, debug capture/download | No arbitrary root shell, GPIO writes or I²C register console |
| Room measurement | Save room/speaker/mic details, measure, select listening target, review/apply/undo | Optional USB microphone worker and verified local output |

## Music Assistant setup

Open **System → Open setup wizard**, or **Connections → Music Assistant → Open setup wizard**. The same wizard appears on a fresh kiosk install. Its steps remain directly accessible: language, network, server, player, display, finish.

Enter a local MA base address and access token, test it, then select an available player. Saving replaces the TuneBox client connection and restarts the backend. The token is stored in the root-managed credential file, never browser storage. Existing connection tokens can be reused when the token field is left empty.

**Run Music Assistant on this Pi** checks hardware capacity and Docker/Compose availability. It requires Pi 4, ARM64, at least 3500 MiB measured RAM, 1800 MiB available RAM, 10 GiB free storage, temperature below 70 °C, known healthy firmware flags and one-minute load no greater than half the core count. These are TuneBox co-hosting policy thresholds, not a performance guarantee. A Pi reporting 2.7 GiB RAM will not pass this policy. Keep using the NUC in that case.

Explicit installation creates the official container with host networking and persistent storage, through a separate systemd job. The UI polls its phase and shows indeterminate progress during installation. Docker itself must already be installed from its official source. Existing container/configuration is left for manual inspection. Local MA needs separate onboarding, providers and player setup. Installing it does not migrate or replace the NUC connection.

## Wi-Fi setup

**Connections → Wi-Fi → Scan networks**, choose SSID and enter a WPA password using the touch keyboard. A failed connection attempts to restore the previous profile. WPA passwords are written to private NetworkManager keyfiles, never process arguments or debug logs. Open and enterprise networks, WPS and a captive-portal redirect are not implemented.

**Set up with phone** asks before switching Wi-Fi into AP mode. One QR joins the private setup Wi-Fi; the other opens the setup address with a single-use pairing token. The phone endpoint permits network setup only, not general device administration. AP support depends on the adapter and NetworkManager; playback must be stopped. A ten-minute timer ends the AP, and successful setup stops it. The browser simulator labels its QR flow as simulated and does not create a network.

## Sensor and system readouts

Sensors shows CPU usage from `/proc/stat` deltas, one-minute load, CPU temperature, filtered case temperature, fan tachometer when present, lux, actual display-service brightness, Wi-Fi signal/link bitrate, RAM pressure, power use/PD contract, and output volume. Additional details include source audio format when MA supplies it, build, Pi model/kernel/architecture, Chromium version and backend/MA health.

Memory pressure uses Linux available memory and ten-second memory PSI: high below 8% available or PSI ≥10%; moderate below 20% available or PSI ≥1%; otherwise low. Missing memory data is unknown. This is inspired by the usefulness of a pressure indicator and does not reproduce Apple's algorithm.

**Show on the main menu** selects up to four widgets. **Required power** is a warning threshold, not a power limit or PD negotiation command. Measured consumption and negotiated PD power are separate. Optional external power telemetry must write schema-1 readings to `/run/daw-one-power/readings.json`, with a fresh millisecond `observedAt` and independently known `watts`, `volts`, `amps`, `contractWatts`. This release does not install or calibrate an INA228 reader or PD controller. Missing fields remain unavailable.

The physical output format cannot be certified from source codec metadata. DSP controls appear only when the Louder ALSA driver exposes the supported names. The application does not invent chip features, fan RPM, amplifier faults or sensor values.

## Microphone measurement and listening targets

See [the complete room-measurement procedure](room-measurement.md). The measurement is the baseline; the chosen target is the desired sound. Neutral is one option. Balanced, Warm, Extra bass, Vocal and detail, Quiet listening and Custom are selectable. Genre metadata from up to fifty MA favorite tracks can suggest a preset. The suggestion is never applied on a track change without consent.

## PIN, reset and debug

PINs are salted scrypt hashes. Five incorrect attempts lock PIN entry for five minutes, persisted across restart. Administration uses a separate HttpOnly/SameSite session with five-minute inactivity expiry. The PIN protects backend settings and device changes as well as the menu. Normal playback stays available. A local administrator can run:

```sh
sudo bash /opt/daw-one/deploy/security-recovery.sh --clear-pin
```

**Restore all preferences** restores TuneBox visual/device preferences without removing the MA credential or PIN. **Factory settings** additionally resets TuneBox onboarding, MA client credentials and PIN after consent. It is not an OS reflash and does not erase NetworkManager profiles, MA library/accounts, a local MA container, or USB files. It refuses while playback/measurement prevents safe reset.

**Developer → Debug → Start debug capture** records bounded, explicitly selected metrics and action results. Capture stops after thirty minutes or backend restart. Up to 1 MiB of private rotating logs is retained. **Download debug report** exports JSON containing software/host/sensor status and bounded history, with no request bodies, passwords, tokens, Wi-Fi names, music titles or audio recordings. **Clear debug log** removes captured events. An enabled PIN also guards the download.

## Installing this release on an existing Pi

Build the archive on the development machine with `npm ci` and `npm run package:pi`. Copy `tunebox-release.tar.gz` to the Pi. Existing credentials and sensor services are retained by the standard install. On the Pi:

```sh
tunebox_update_dir=$(mktemp -d "$HOME/tunebox-update.XXXXXX")
tar -xzf ~/tunebox-release.tar.gz -C "$tunebox_update_dir"
cd "$tunebox_update_dir"
sudo bash deploy/install.sh --target auto --prebuilt --music-assistant skip --updates skip
sudo /opt/daw-one/set-panel-profile.sh wall-16-10
sudo /opt/daw-one/set-display-mode.sh dsi-production
sudo systemctl restart daw-one-kiosk.service
cd /opt/daw-one
npm run doctor
```

If `/opt/daw-one` is already an OTA slot symlink, use [the signed OTA workflow](ota-updates.md), not the plain installer. Trusted manager/measurement/root helper upgrades still require a reviewed manual installer refresh; ordinary app OTA cannot replace root programs.

Add `--quiet-boot` to the standard install only when ready for the backed-up boot-presentation changes and a reboot test. The display service keeps the panel dark until the kiosk's first-frame handshake, with a ninety-second fail-open. A transparent Xcursor theme complements the CSS cursor suppression in DSI mode. Confirm physically that no pointer or Linux text remains.

OTA is not enabled by this release without a project key. Follow [OTA setup](ota-updates.md). The correct timer is **daw-one-update.timer**. No automatic update is claimed until that timer is active and a signed channel release exists.

## Physical power button and cold/dark state

With its supply connected, a Pi 4 can be cleanly halted and awakened by briefly connecting GPIO3/SCL, physical pin 5, to GND, for example pin 6, when its EEPROM wake configuration permits it. No RP2040 is inherently required. This retains standby electrical consumption; it does not disconnect PD power.

The local-audio standby option attenuates detected Louder channel gains and restores them; it does not claim DAC deep sleep while I²S continues. The optional running-state button installer supports a verified free GPIO, debouncing, short press and a single three-second long-press shutdown request. A free GPIO by itself cannot wake the halted Pi. GPIO3 also clocks the existing sensors and HAT I²C; a long button hold must not ground that bus. A single-button wake/short/long wiring solution remains a hardware design and validation task. No pins or EEPROM wake settings are changed automatically. Do not wire the current sensor bus straight through a long-press button.

## Acceptance before calling the hardware complete

Verify cold boot/animation, invisible cursor, brightness and one-touch wake, thermal/lux readings, Wi-Fi reconnect/AP rollback, PIN recovery, actual microphone capture, left/right routing, DSP headroom/readback/undo, group playback stability and shutdown/wake. Fan, INA228/PD measurements, presence wiring and the physical button remain conditional on installed hardware. A measured result must be repeated after DSP changes; a prediction is not a second physical measurement.
