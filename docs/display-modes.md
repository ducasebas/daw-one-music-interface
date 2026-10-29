# HDMI development and DSI production

Both modes render the production React product, theme engine and settings against the same backend APIs, SSE playback state and safety logic. Neither selects real GPIO or verifies hardware. The default browser root remains the always-visible test bench.

| Mode | URL | Rendering |
| --- | --- | --- |
| HDMI development | `/?screen=1&display=hdmi-development` | Black full-screen surround; centered 1280 × 400 product, no upscaling |
| DSI production | `/?screen=1&display=dsi-production` | Fixed 1280 × 400 product at native scale |

On a 1920 × 1080 browser viewport, the HDMI product is exactly 1280 × 400 CSS pixels at x=320, y=340. Larger displays retain native-size product pixels. Smaller windows scale the product down uniformly without reflowing its logical 1280 × 400 layout. DSI mode never scales: configure a landscape 1280 × 400 output first; an incorrectly sized output may clip the product. CSS pixels correspond to physical pixels only at browser zoom 100% and output scale 1; the kiosk launcher requests a Chromium device scale factor of 1. Do not use desktop fractional scaling for pixel-level validation.

All six built-in skins work in both modes, including Nerd diagnostics. Mouse clicks, keyboard Tab/Shift+Tab, Enter/Space and arrow keys on sliders remain native controls. Chromium kiosk removes browser chrome; in a normal desktop browser use its full-screen command (usually F11). No Waveshare device, DSI driver or DSI connection is required for HDMI development. Connect an ordinary HDMI monitor before powering on the Pi and let Raspberry Pi OS select its advertised mode. The application does not force HDMI timings.

## Try in Codespaces or on a desktop

```sh
npm ci
npm run dev
```

Open the forwarded 5173 URL and append one of the mode URLs above. Switch by changing `display`; preferences are retained in local storage and the running backend keeps playback. A browser reload does not restart the device service. For a production build:

```sh
npm run build
npm start
```

Open `http://localhost:3001/?screen=1&display=hdmi-development`. Browser display regressions also run against this built application in `npm run test:offline`.

## Pi 4, Raspberry Pi OS Lite, minimal kiosk

Start with 64-bit Raspberry Pi OS Lite, SSH access, Node.js 22.12+ and npm. Connect the standard HDMI monitor and keyboard/mouse. Start with [the first-run installation checklist](pi-first-run.md), then [Pi prerequisites and installation](raspberry-pi.md); the installer installs distro Cage, Chromium, seat/input tools, builds the production app and installs the systemd units. It neither requires a DSI panel nor edits boot configuration.

```sh
sudo bash deploy/install.sh
sudo /opt/daw-one/set-display-mode.sh hdmi-development
sudo systemctl enable --now daw-one-kiosk.service
journalctl -u daw-one.service -u daw-one-kiosk.service -b
```

Cage is the minimal Wayland compositor; Chromium runs as the dedicated `dawone` user with its sandbox enabled. The kiosk unit uses a PAM/logind seat on tty1 and conflicts with that tty's getty while active. This seat arrangement and distro package paths still require a real Pi check. Keep SSH available. Do not run Chromium as root or add `--no-sandbox` to bypass seat problems. The launcher checks HTTP backend health before starting the browser; health is not proof of video decode, visible pixels or physical hardware safety.

The default installed mode is HDMI development. Switch the running kiosk with:

```sh
sudo /opt/daw-one/set-display-mode.sh dsi-production
sudo /opt/daw-one/set-display-mode.sh hdmi-development
```

This writes only `/etc/daw-one-display.env` and restarts an already-active **kiosk** service. It does not restart the backend, change playback, enable an inactive kiosk, install overlays, choose a connector, or touch `config.txt`/`cmdline.txt`. Persistent configuration is `DAW_DISPLAY_MODE=hdmi-development` or `DAW_DISPLAY_MODE=dsi-production` in that file. For a manual launcher invocation inside a suitable seat, `/opt/daw-one/kiosk.sh --mode hdmi-development` overrides the environment for that launch; do not run it alongside the system kiosk.

DSI production targets the chosen Waveshare 7.9inch DSI LCD, SKU 22293, rotated to landscape. Its exact revision, OS driver, screen/touch rotation and native output mode must be verified separately using the matching manufacturer instructions. Review and explicitly approve any required boot-file changes before applying them. Selecting the application mode alone cannot configure an unconnected or uninitialized DSI panel. Backlight timing, hidden Linux boot and a flash-free startup are not implemented by this mode switch.

## Verification and recovery

- HDMI-only cold boot: DSI unplugged, confirm the ordinary monitor displays the centered UI.
- Confirm output mode/scale from a terminal inside the Wayland session using `wlr-randr`. Changing modes is a separate, explicit operation; the launcher does not guess connector names.
- Test all skins, keyboard focus, volume arrows, playback/queue and settings persistence. Compare another browser/test bench to confirm shared playback state.
- Switch application modes and confirm the backend uptime/playback remains intact.
- On real DSI hardware, check native 1280 × 400 layout, touch corners and rotation. Measure Chromium memory, MP4 decode load and thermal behavior on the Pi 4 with 2 GB.
- Recovery over SSH: `sudo systemctl stop daw-one-kiosk.service`, inspect its journal, select HDMI development and start it again. The backend can remain running. See the Pi guide for restoring the tty/getty if needed and safe OS shutdown.

Automated browser tests verify application geometry and interaction. Physical HDMI/DSI, Cage/logind permissions, touchscreen and Pi resource measurements remain unvalidated without target hardware.
