# Pi 3 Model B+ — experimental lightweight mode

This opt-in target uses the production UI, backend and safety logic. It is **not hardware-certified**. Pi 4 remains the default. Only an actual Pi 3 B+ running 64-bit Raspberry Pi OS Lite is accepted; 32-bit OS and a regular Pi 3 B are rejected. There is no flashable TuneBox OS image.

## Prepare and build on your Mac

Install Raspberry Pi OS Lite **64-bit** using Raspberry Pi Imager. Configure SSH, your own username and network. Use a reliable power supply. On the Pi, install a system-wide ARM64 Node.js 24 LTS runtime with npm from [Node.js](https://nodejs.org/en/download) (verify its published checksum). Node must be at least 22.12 and available to sudo:

```sh
node --version
npm --version
sudo /usr/bin/env node --version
sudo /usr/bin/env npm --version
```

In your existing Mac checkout:

```sh
git pull --ff-only
npm ci
npm run package:pi
scp tunebox-release.tar.gz YOUR_USER@PI_ADDRESS:~/
```

This runs automated logic tests, builds the frontend and packages application files. Development dependencies, your `.env` and Git credentials are excluded. The manifest detects corrupted or inconsistent files; it is not a cryptographic signature. Only install your own trusted build.

## Install on the Pi

SSH into the Pi, then extract into a fresh directory:

```sh
mkdir ~/tunebox-pi3-release
tar -xzf ~/tunebox-release.tar.gz -C ~/tunebox-pi3-release
cd ~/tunebox-pi3-release
sudo bash deploy/install.sh --target pi3-experimental --prebuilt
cd /opt/daw-one
npm run doctor
sudo /opt/daw-one/set-display-mode.sh hdmi-development
sudo systemctl enable --now daw-one-kiosk.service
```

Replace YOUR_USER and PI_ADDRESS. If the extraction directory exists, use a new empty directory for each release. The installer checks model, architecture and release integrity before installing system packages. It installs Cage/Wayland, Chromium and production npm dependencies; it **does not compile the frontend on the Pi**. No boot configuration changes or real GPIO/amp control are enabled.

The kiosk automatically adds `profile=pi3`. To inspect the same lightweight UI on your Mac, open `http://localhost:5173/?gui=2&profile=pi3` after `npm run dev`.

## What changes

- Same 1280 × 400 UI, all skins, controls and backend APIs.
- Static startup branding and cover artwork; video disabled.
- Glow, transitions, animation and backdrop blur disabled.
- Presentation clock updates once per second; safety processing remains in the backend.
- Saved artwork/theme preferences survive switching back to the standard profile.

The Video Artwork control says **Video uit · Pi 3 modus**. The release marker is **GUI 2.8 · PI3 EXP**. This profile is a presentation constraint, not a hardware verification or amplifier permission.

## Verify, measure and recover

From the extracted bundle, run `bash deploy/pi-audit.sh` for a read-only inventory. Check `npm run doctor` and:

```sh
free -h
sudo journalctl -u daw-one.service -u daw-one-kiosk.service -b --no-pager -n 80
systemctl status daw-one.service daw-one-kiosk.service --no-pager
```

Measure memory, responsiveness, temperature, video/display drivers and long-running stability on the real board before deciding it is usable. Mac/browser tests do not establish Pi frame rate or RAM use. A 1 GB Pi may still struggle with Chromium. To stop the UI: `sudo systemctl stop daw-one-kiosk.service`. For safe shutdown: `sudo shutdown -h now`; wait until the OS has halted before removing power.

Music Assistant belongs on the NUC/server. This install starts the simulated TuneBox backend locally on the Pi. Actual MA server/player setup and audio output still require separate configuration and verification. DSI panel revision, touch, HAT, mute path, power sequencing and controller hardware remain unverified. Phase 5 is incomplete.
