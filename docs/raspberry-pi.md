# Raspberry Pi 4 / 2 GB deployment

**Pi 3 B+ update:** use the explicit [experimental Pi 3 guide](pi3-experimental.md). It preserves the Pi 4 default and requires a prebuilt bundle. Hardware performance is still unverified. The readiness review below describes the preceding audit.

This is an **unvalidated installation scaffold**, not a hardware-certified image. No Pi, touchscreen, audio HAT, RP2040 or power board was attached. It installs only the simulated device. Do not connect an enabled power amplifier for initial setup.

Start with [the first Pi run and Music Assistant test](pi-first-run.md). After installation, guides are also available through `/docs/` on the local app and `/opt/daw-one/docs/`, without a GitHub login.

## Prerequisites and verification

Use current 64-bit Raspberry Pi OS Lite (Debian Bookworm or newer), SSH enabled through Raspberry Pi Imager, a configured user, reliable supply and backed-up storage. Node.js 22.12+ and npm must be installed from a trusted source appropriate to your OS/architecture; installer deliberately does not pipe a remote installer to root. Verify `/usr/bin/env node --version` works under the service environment.

```sh
cat /etc/os-release
tr -d '\0' </proc/device-tree/model
free -h
uname -m
lsusb
ls -l /dev/dri /dev/input
aplay -l
vcgencmd get_throttled
```

Compare screen and HAT revision to manufacturer documents. Do not assume a display modeline, overlay, GPIO pin or audio driver from the product name. The UI is designed for 1280 × 400; it does not force a physical timing.

## Install simulation service

```sh
git clone https://github.com/ducasebas/daw-one-music-interface.git
cd daw-one-music-interface
sudo bash deploy/install.sh
curl --fail http://127.0.0.1:3001/api/health
systemctl status daw-one.service
journalctl -u daw-one.service -b
```

Installer uses distro packages `cage`, `chromium`, `curl`, `alsa-utils`, `libinput-tools`, `wlr-randr`, `seatd` plus dependencies. Confirm package names on the chosen OS. npm packages install/build during setup; runtime serves static assets without Vite. Node service has a 256 MB limit; browser memory is not certified for the 2 GB target.

## Kiosk / display / touchscreen

See [HDMI development / DSI production](display-modes.md) for the explicit mode switch. HDMI development is the installed default and needs only a standard HDMI monitor; it does not require a DSI display. The same product is centered at a logical 1280 × 400 on Full HD displays.

Cage is a minimal Wayland compositor; Chromium runs with its normal sandbox. Confirm DRM/KMS and local seat access on your OS first. The kiosk unit uses a PAM login seat on tty1; logind permissions and compositor support **require prototype validation**. It does not modify getty permanently, boot files or autologin. If the supplied unit cannot obtain a seat, diagnose via journal and distro Cage guidance; do not solve it with `--no-sandbox` or running Chromium as root.

```sh
sudo libinput list-devices
sudo libinput debug-events
# Run from an active Wayland session when available:
wlr-randr
sudo systemctl enable --now daw-one-kiosk.service
journalctl -u daw-one-kiosk.service -b
```

USB touch should enumerate as input hardware; identify device and test all four corners. Rotation and coordinate transformation depend on the exact panel/input revision. Determine supported display mode from EDID/vendor documentation. Do not copy speculative modelines. Display sleep and brightness in the app are simulated; no physical backlight driver is active.

## Audio / Squeezelite / Music Assistant

Current audio is simulated metadata and controls; no sound is emitted. Verify vendor-supported HAT overlay and ALSA device while amplifier physically disabled. Only after verification, install distro `squeezelite` if available (`apt-cache policy squeezelite`), inspect `squeezelite -?`, and use `squeezelite -l` / `aplay -l` to identify the exact ALSA device. Configure the distribution's Squeezelite service using its documented config, unique player name and verified Music Assistant server address. Do not assume a mixer, GPIO mute or power control option. Register/enable the Squeezelite player in the installed Music Assistant version. Confirm audio routing and volume limits on a bench before connecting speakers.

`server/ma-transport.js` and `server/ma-service.js` implement the opt-in live WebSocket connection. See [setup](music-assistant.md) for backend-only credentials and read-only first testing. The actual installed server version, Squeezelite audio path and real sound output still require validation.

## GPIO / UART / I²C and permissions

Disabled by default. The backend unit has `PrivateDevices=yes`, no GPIO/UART/I²C/audio group membership, and no physical transport. Do not edit `/boot/firmware/config.txt` or older `/boot/config.txt` automatically. Any enabling change requires explicit operator confirmation after manufacturer verification, boot-file backup and a reviewed diff. Determine UART/console conflict, I²C address/voltage and HAT pin conflicts first. Later assign only necessary device/group access to a dedicated hardware service; never blanket root access. See hardware checklist.

## Logging / health / recovery

```sh
systemctl status daw-one.service daw-one-health.timer
journalctl -u daw-one.service -u daw-one-health.service -u daw-one-kiosk.service -b
bash deploy/health.sh
sudo systemctl restart daw-one.service
```

Backend restarts on failure and cold boots inhibited; it never restores verification. Health timer reports failed probes in journal and deliberately does not reboot hardware automatically. HTTP health only certifies app response, not sound or physical safety. The simulator timeline is a bounded 500-event in-memory ring; journal records startup/errors, not a persistent audit of every UI event.

Recovery: leave amplifier hardware disabled, SSH in, stop kiosk, inspect journal/temperature/storage, restart backend, then kiosk. If display fails, retain SSH and restore backed-up boot config only after reviewing the actual change. No boot files are touched by this repository.

## Safe shutdown

App Shutdown simulates a safe state transition; it does **not** power off Linux. For this simulation deployment, stop kiosk/service then `sudo systemctl poweroff`; wait for OS shutdown before removing power. Real hardware shutdown must first receive a verified amplifier-disable acknowledgement and complete measured rail sequencing using an independent controller; that path is blocked pending bench validation.

## Updates / rollback

Keep previous release and lockfile. On a development clone: `git pull --ff-only`, `npm ci`, `npm run check`, `npm run test:ui`. For deployment stop kiosk/backend, retain `/opt/daw-one` backup, rerun installer, check health, then restart kiosk. Restore previous `/opt/daw-one` and units if checks fail. Do not update while real audio hardware is enabled. Installer is a simple manual update scaffold, not atomic OTA.
