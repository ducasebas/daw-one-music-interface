# First Pi installation and Music Assistant test

**Pi 3 B+ update:** use the explicit [experimental Pi 3 guide](pi3-experimental.md). It preserves the Pi 4 default and requires a prebuilt bundle. Hardware performance is still unverified. Do not run this Pi4 source-install procedure on a Pi3.

Start with the latest repository revision, a Raspberry Pi 4 (2 GB supported as a target, not yet benchmarked), 64-bit Raspberry Pi OS Lite, SSH access and an ordinary HDMI monitor. The HDMI development mode does not need Waveshare hardware. Physical GPIO/amplifier control remains disabled.

## 1. Prerequisites

Use Raspberry Pi Imager to enable SSH and configure your own account/network before booting. Keep SSH available while testing the local graphical kiosk. Install a system-wide Node.js runtime >=22.12 plus npm from a trusted source for your OS/architecture. A user-only nvm installation may not be available to sudo/systemd. Node 22.12 is the minimum for this project's Vite build; the native WebSocket implementation is needed for Music Assistant.

```sh
sudo apt update
sudo apt install -y git curl
node --version
npm --version
sudo /usr/bin/env node --version
```

Do not continue if sudo cannot find the supported Node runtime. For concrete runtime installation steps, see [system-wide Node.js](node-runtime.md). The TuneBox installer does not automatically install Node or change boot firmware settings.

## 2. Get the private repository and install

Clone using your configured GitHub credentials or SSH key. A private repo can show GitHub 404 when the browser is not signed in to an authorized account; the docs also exist in your checkout.

```sh
git clone https://github.com/ducasebas/daw-one-music-interface.git
cd daw-one-music-interface
git pull --ff-only
sudo bash deploy/install.sh
```

If already cloned, only change into that directory, pull and run the installer. It installs Cage/Chromium and input/session dependencies, builds the app, copies runtime/docs into `/opt/daw-one`, ensures a writable dedicated Chromium profile, installs the systemd units and restarts the backend. Existing `/etc/daw-one.env` is retained, not imported from the development `.env`. The read-only doctor checks HTTP, built assets, startup media and the local guide; it fails if those app checks fail. No boot files, DSI overlays or physical amplifier settings are changed.

```sh
cd /opt/daw-one
npm run doctor
sudo /opt/daw-one/set-display-mode.sh hdmi-development
sudo systemctl enable --now daw-one-kiosk.service
sudo journalctl -u daw-one.service -u daw-one-kiosk.service -b --no-pager -n 100
```

Expect GUI 2.8 · PI3 EXP in the current release, with a centered 1280 × 400 UI on an ordinary Full HD monitor. The kiosk uses a dedicated local tty/seat, with a private D-Bus session and normal Chromium sandbox. The HTTP doctor cannot certify that Cage obtained a seat or that visible pixels/touch/audio work; this is the first actual Pi validation. If the kiosk fails, leave the backend up, inspect the journal and test from a browser using an SSH tunnel. Do not run Chromium as root or add `--no-sandbox`.

From a separate computer that has SSH access:

```sh
ssh -N -L 3001:127.0.0.1:3001 YOUR_PI_USER@YOUR_PI_ADDRESS
```

Then open `http://localhost:3001/?gui=2&lab=1` for Test bench or `http://localhost:3001/?gui=2&screen=1&display=hdmi-development` for the product. The backend remains loopback-only; no LAN/public HTTP exposure is needed. Installation/help is available locally at `http://localhost:3001/docs/` or in `/opt/daw-one/docs/`. Markdown guides display as readable text; no GitHub session is needed.

## 3. What works before Music Assistant exists

The UI, six skins, local settings, startup branding, mock playback, Video Artwork timing and simulated safety scenarios are available. Run Playback in the Test bench to demonstrate simulated enable. No real sound is emitted by the mock source. A physical amplifier is never enabled by these browser controls.

Music Assistant itself is NOT installed by this installer, and neither is a real Pi audio player. For live testing you need an already-running MA server reachable from the Pi and a player registered in that server. The DAW ONE browser is a controller, not an audio output. An existing network speaker/player is sufficient for a first test. Playing through the Pi/HAT requires separately configuring a supported player/audio path; the Squeezelite and HAT steps remain hardware validation tasks.

## 4. Configure the installed Music Assistant adapter

The installed systemd service reads `/etc/daw-one.env`, not your repository `.env`.

```sh
sudo touch /etc/daw-one.env
sudo chmod 600 /etc/daw-one.env
sudo nano /etc/daw-one.env
```

Initially use read-only mode, with your actual server address:

```dotenv
DAW_PLAYBACK_MODE=music-assistant
MA_URL=http://YOUR_MA_HOST:8095/ws
MA_PLAYER_ID=
MA_ALLOW_CONTROL=false
MA_VOLUME_LIMIT=40
# Only when your server requires a token:
# MA_TOKEN_FILE=/etc/daw-one/music-assistant.token
```

Create the token through your installed MA version's supported access-token settings. MA error 20 means authentication is required; a successful HTTP/WebSocket connection alone does not establish authenticated access. If needed, create `/etc/daw-one` root-owned with group `dawone` and mode 0750. Create/edit `music-assistant.token` privately on the Pi; make it root:dawone with mode 0640 so the backend can read it. Do not put it under a protected user home, in Git, into browser settings, or in chat. Do not paste token values into shell commands that are retained in history. Do not enable the MA_TOKEN_FILE setting before a readable nonempty token file exists. Keep TLS validation enabled for HTTPS/WSS.

For a token-authenticated server, create the file without putting its value in shell history:

```sh
sudo install -d -m 750 -o root -g dawone /etc/daw-one &&
sudo touch /etc/daw-one/music-assistant.token &&
sudo chown root:dawone /etc/daw-one/music-assistant.token &&
sudo chmod 640 /etc/daw-one/music-assistant.token &&
sudo nano /etc/daw-one/music-assistant.token
```

Paste only the token in the editor, save, then add `MA_TOKEN_FILE=/etc/daw-one/music-assistant.token` to `/etc/daw-one.env`. Do not show the token with `cat` or attach it to a public report. This preserves an existing token file; it does not truncate it.

```sh
sudo systemctl restart daw-one.service
cd /opt/daw-one
npm run doctor -- --require-ma
```

A reconnect can take time; if disconnected, inspect `journalctl -u daw-one.service -b` and Settings → Connection. In DAW ONE, choose the correct player explicitly in Settings → Connection. First start a known track in MA itself and confirm the title, playing state, position and volume agree. `MA_PLAYER_ID` can pin that player across restarts. The doctor's MA check means connected transport only; it does not prove player selection or audio output.

After confirming the right player, edit `/etc/daw-one.env` to set `MA_ALLOW_CONTROL=true`, restart the backend, and test pause/resume, track changes, seek where supported, volume and mute where supported. No automatic play/volume/unmute is sent on connect. The 40% request ceiling is a software limit, not an electrical loudness limiter. Start with the external player's volume low. Simulation controls stay disabled in live music mode.

If there is no MA server yet, keep simulation and install/configure MA separately first. Protocol fixtures and an owner-reported MA 2.10.9/jack-audio experiment exist; compatibility with other setups and full stability are not established. See [music-assistant.md](music-assistant.md) for protocol details and limitations.

## 5. Recovery and honest acceptance

```sh
sudo systemctl stop daw-one-kiosk.service
sudo systemctl restart daw-one.service
curl --fail http://127.0.0.1:3001/api/health
sudo systemctl start daw-one-kiosk.service
```

If you need a local terminal again after stopping the kiosk: `sudo systemctl start getty@tty1.service`. Keep your existing SSH connection open. This is a separate console recovery action; the installer does not change console/autologin/boot splash configuration.

Still requires real hardware validation: Pi 4 memory/thermal and MP4 decode load, Cage/logind session, physical HDMI/DSI and touch rotation, early boot visibility/backlight, audio/HAT routing, RP2040, electrical amplifier safety and power sequencing. The first Pi run is a prototype acceptance run, not a claim that everything is already certified working.

## Kiosk exits with HUP

The owner’s Pi3 kiosk exited immediately with `signal=HUP`. This console override allowed it to start; it is a field workaround, not a universal display fix. Apply over SSH only when the journal matches that symptom:

```sh
sudo mkdir -p /etc/systemd/system/daw-one-kiosk.service.d
sudo tee /etc/systemd/system/daw-one-kiosk.service.d/console.conf >/dev/null <<'CONF'
[Service]
StandardInput=tty-force
TTYVHangup=no
CONF
sudo systemctl daemon-reload &&
sudo systemctl restart daw-one-kiosk.service
```

To undo this specific override, remove only `/etc/systemd/system/daw-one-kiosk.service.d/console.conf`, reload systemd and restart the kiosk. No boot configuration is changed. Keep SSH available; closing Chromium is not the preferred administration method.

Installer update: Pi3 B+/Pi4 detection is automatic (`--target auto`); VM remains explicit. See [optional local Music Assistant](local-music-assistant.md) for the default-no co-hosting choice.
