# Pi 3 Model B+ — experimental lightweight installation

Use a **Pi 3 B+ with 64-bit Raspberry Pi OS Lite**. This is an experimental application installer, not a flashable TuneBox image. The installer now auto-detects Pi3 B+ or Pi4; the Pi3 target rejects 32-bit OS and a regular Pi 3 B. Basic HDMI/jack playback was owner-reported, with unresolved power, graphics and playback-recovery issues; see [the field report](field-test-2026-11-01.md).

## 1. Prepare the Pi

Use Raspberry Pi Imager to write Raspberry Pi OS Lite **64-bit** to the microSD. Configure your own username, network and SSH before writing. Etcher can write the OS too, but does not provide Imager's account/network setup. This erases the selected card. Do not flash the application `.tar.gz` with Etcher.

Connect an ordinary HDMI monitor, mouse/keyboard and a suitable stable Pi 3 micro-USB supply. No Waveshare display is required. Keep SSH available. On the Pi, install a **system-wide Node.js 24 LTS plus npm** using [the runtime guide](node-runtime.md), then verify:

```sh
node --version
npm --version
sudo /usr/bin/env node --version
sudo /usr/bin/env npm --version
```

Do not proceed if Node/npm are missing or the version is below 22.12. An installation failure means `/opt/daw-one` and its services may not exist yet.

## 2. Build on your Mac

In Terminal, first enter your actual repository directory. For an existing clone directly in your home directory:

```sh
cd ~/daw-one-music-interface &&
git pull --ff-only &&
npm ci &&
npm run package:pi
```

If your checkout is elsewhere, replace the `cd` path. If you have no clone, use the README's clone steps first. `pwd` and `ls package.json` must show you are inside the project, not your home directory. Stop at the first error; do not run `npm install` in your home directory to fix a missing package.json.

This runs automated logic tests, builds the frontend and creates **tunebox-release.tar.gz** in the project directory, including licence notices. It excludes development dependencies, `.env` and Git credentials. The manifest detects inconsistent files, not the identity of an untrusted publisher.

Copy the successful bundle to the Pi, replacing both placeholders:

```sh
scp tunebox-release.tar.gz YOUR_PI_USER@YOUR_PI_ADDRESS:~/
```

This command runs on the **Mac**, not the Pi. Your Pi login is the user you created in Imager.

## 3. Install on the Pi over SSH

On the Mac, connect:

```sh
ssh YOUR_PI_USER@YOUR_PI_ADDRESS
```

In that SSH session, use a fresh extraction directory for every release. The following creates one automatically and stops on errors:

```sh
tunebox_release_dir=$(mktemp -d "$HOME/tunebox-release.XXXXXX") &&
tar -xzf "$HOME/tunebox-release.tar.gz" -C "$tunebox_release_dir" &&
cd "$tunebox_release_dir" &&
sudo bash deploy/install.sh --target auto --prebuilt
```

Do not continue if the installer fails. It checks the actual model/ARM64 runtime and release manifest before system package installation, installs Cage/Wayland/Chromium and production npm dependencies, then starts the backend. It does **not build the frontend on the Pi** or install Music Assistant/Squeezelite. No boot configuration or real GPIO/amp control is enabled.

Only after installation succeeds:

```sh
cd /opt/daw-one &&
npm run doctor &&
sudo /opt/daw-one/set-display-mode.sh hdmi-development &&
sudo systemctl enable --now daw-one-kiosk.service
```

Doctor passing proves HTTP/assets, not visible pixels, working audio or electrical safety.

## 4. Check the display and lightweight profile

The kiosk automatically adds `profile=pi3`: same 1280 × 400 UI, skins, backend APIs and controls, but static startup/cover artwork, no video/glow/transitions/backdrop blur and a 1 Hz presentation clock. Safety processing remains in the backend. Stored artwork/theme settings survive switching back to the standard profile. Look for **GUI 2.11 · SENSOR CARDS** and **Video uit · Pi 3 modus**.

To preview this profile on the Mac: `npm run dev`, then `http://localhost:5173/?gui=2&profile=pi3`. This does not measure Pi performance.

If the monitor stays black:

```sh
sudo systemctl status daw-one.service daw-one-kiosk.service --no-pager -l
sudo journalctl -u daw-one-kiosk.service -b --no-pager -n 60
```

If the kiosk immediately exits with `signal=HUP`, see [the console workaround](pi-first-run.md#kiosk-exits-with-hup). Do not change boot display timings or disable Chromium's sandbox as a first response.

## 5. Add actual music and audio separately

Default playback and hardware are simulated. For a real existing player, follow [Music Assistant connection setup](pi-first-run.md#4-configure-the-installed-music-assistant-adapter). Keep Music Assistant on the NUC/server. To make the Pi itself an audio player, follow [the Squeezelite audio bench guide](pi-audio-bench.md). Select its newly discovered exact player ID in the backend; connecting to the NUC does not automatically select the Pi.

## 6. Measure, stop, update and recover

```sh
free -h
vcgencmd get_throttled
sudo journalctl -u daw-one.service -u daw-one-kiosk.service -b --no-pager -n 80
```

`throttled=0x50005` includes **current undervoltage and throttling**. Fix power/cabling before interpreting performance; high-wattage labelling alone does not prove adequate voltage at the Pi. Check CPU/RAM, graphics, temperature and long-running audio on the board. A 1 GB Pi can still struggle with Chromium.

Stop only the display: `sudo systemctl stop daw-one-kiosk.service`. The backend and a separately managed Squeezelite player remain running. Prevent display autostart: `sudo systemctl disable daw-one-kiosk.service`. Restore: `sudo systemctl enable --now daw-one-kiosk.service`.

For updates, back up the current installation/configuration, rebuild on the Mac, transfer and repeat the fresh-directory **pi3-experimental --prebuilt** procedure; do not invoke the default Pi4/source installer on a Pi3. Retain SSH and previous bundle for recovery. This is a manual, non-atomic update process.

Safe shutdown: stop playback, then `sudo shutdown -h now`; wait for the OS to halt before disconnecting power. The UI Shutdown scenario does not halt Linux. DSI/touch, HAT, controller, button/LED/sensors, mute and power sequencing remain unverified. Phase 5 is incomplete.

Installer update: Pi3 B+/Pi4 detection is automatic (`--target auto`); VM remains explicit. See [optional local Music Assistant](local-music-assistant.md) for the default-no co-hosting choice.
