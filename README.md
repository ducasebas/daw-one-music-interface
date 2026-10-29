# DAW ONE — Intelligent Streaming Amplifier

A runnable React virtual device designed for a 1280 × 400 display, with a shared Node service, hardware simulator, fail-safe state model and Raspberry Pi 4 deployment scaffold. **Hardware is always simulated; audio defaults to simulation.** No GPIO is written and no amplifier is physically enabled. Simulation is the default; the optional Music Assistant mode connects the interface to a real external player. See [live connection setup](docs/music-assistant.md).

## Start in GitHub Codespaces

Create a Codespace from this repository. The devcontainer installs locked dependencies and starts the application automatically. Open the forwarded **5173** port in your browser. Keep its visibility **Private**.

In a terminal (Node.js 22+), one command starts everything:

```sh
npm ci && npm run dev
```

For an already installed checkout: `npm run dev`. React/Vite listens on 5173 and proxies the backend on loopback 3001. Production: `npm ci && npm run build && npm start`; open `http://127.0.0.1:3001`. Stop with Ctrl+C. No server account, NUC or hardware required.

## Demonstrate the virtual product

1. Now playing: play/pause, next/previous, seek and simulated volume. Toggle cover/video artwork; the mock video clock shows End-Sync and waiting/fallback states.
2. Settings: brightness preview, artwork and manual video offset persist in browser local storage. With backend unavailable settings still work; commands are rejected with an offline notice.
3. Test bench → Controls: select **Playback → Run scenario** to establish a safe simulated active system. Try each scenario, sensors and buttons. All pages use the same backend state. `simulation-verified` cannot bypass a fault, bad power, thermal limit or stale heartbeat.
4. Toggle presence, light, temperature, power-good, Wi-Fi, Music Assistant disconnect/reconnect, heartbeat and amplifier fault. Disable heartbeat and wait for the watchdog. Open the separate Events tab for transitions, enable/mute requests, watchdog and errors.
5. Acknowledge a fault then wake: verification remains false. Start Playback scenario for a fresh verified simulation. Display-timeout preserves playback; standby stops it; shutdown inhibits enable. Boot and boot-complete model the two boot stages.

No real sound is emitted. Idle display state is shown in telemetry rather than hiding the simulator. UI brightness is a preview dim layer. Backend outage freezes the last preview snapshot; that snapshot must never be interpreted as live hardware status.

## iPhone / iPad Safari

Open the Codespace on a computer or tablet, copy the **private forwarded 5173 HTTPS URL** from Ports, and open it in Safari while logged into the same GitHub account. Use landscape orientation for the panel layout; narrow screens reflow with vertical scrolling. Touch play, navigate to settings, reload to check persistence, then run all simulator scenarios. Settings and simulator sections use swipe pages with arrows and a page picker rather than vertical scrolling. Use the timeline and video timer to inspect safety and End-Sync. Safari browser shutdown/sleep does not simulate OS power-off. Test without hardware. Safari device validation is still required; Chromium automation is not Safari certification.

## Verify

```sh
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:ui
```

Node tests cover safety invariants, all fault classes, boot/reboot, standby, presence, display sleep, shutdown, conflicting events, protocol validation, playback/queue/metadata/drift/reconnection, End-Sync edge cases, settings and all virtual-device scenarios. Browser tests cover 1280 × 400 geometry, touch, navigation, controls, persistence and offline/fault UI. See [validation](docs/validation.md) for actual run results; do not equate test existence with a successful run.

## Repository structure

```text
src/                 React product UI, settings and simulator dashboard
shared/              Device/runtime, safety protocol, playback, settings, End-Sync
server/              Simulation API and live Music Assistant transport/service
tests/               Node domain/integration/scenario tests and browser tests
deploy/              Pi installer, systemd units, health probe, inert hardware config
docs/                API, hardware verification, Pi operations, validation
.devcontainer/       Codespaces startup and private-port preview
.github/workflows/   Automated build, domain tests and Chromium UI checks
```

## Delivery status and continuation

Phase 1: implemented virtual product foundation. Phase 2: simulated safety/controller foundation; physical firmware/transport unimplemented. Phase 3: End-Sync, mock video and Music Assistant WebSocket transport/service implemented with protocol-fixture tests; the owner’s real MA server, Squeezelite audio and video integrations remain unverified. Phase 4: documented Pi installation scaffold, untested on device. **Phase 5: not complete; requires real hardware.** Prompt sections 1–15 were not supplied, so no missing electrical/API requirements have been invented.

Read [hardware blockers](docs/hardware.md), [Pi deployment](docs/raspberry-pi.md), and [API/protocol](docs/protocol-and-api.md). Next: validate this release in Safari/Codespaces; obtain exact component documentation; pin a Music Assistant server/client version and implement its transport; validate real Pi kiosk/audio resources; design and bench-test RP2040 fail-safe hardware before adding any physical enable driver.

## Theme engine

Settings → **Skins** includes Reference Dark, Minimal Dark, Warm Bronze, Champagne Gold, Cinematic and Nerd Mode. Use the **Palette**, **Accents**, **Typography** and **Finish** pages to change colors, typography, panel opacity, spacing, corner radius, border width, glow and meter style. Name and save up to 20 custom skins locally. No theme can enable hardware. Nerd Mode adds controller/temperature/power/enable diagnostics to Now Playing.

Automatic switching supports browser-local day/night hours (including schedules across midnight) or state mapping. State priority: fault → offline → standby/shutdown → playback → manual fallback. Each mapping and both schedule skins are configurable. Equal day/night hours choose night all day. Color customization can reduce contrast; inspect text readability on the target display before adopting a custom palette. Built-in colors do not claim formal accessibility certification. Theme data is versioned and validated; arbitrary CSS is not accepted. See `shared/themes.js` for the reusable schema/resolver and `src/Themes.jsx` for controls.

Offline cold reload is supported by the production build after one successful visit; development Vite does not register the static-shell service worker. API responses are never cached as live hardware state.

## Product and separate test workbench

The six uploaded JPGs guide actual React/CSS layouts, never a screenshot pasted over fake controls. Reference Dark and Warm Bronze use stereo VU framing; Minimal Dark uses a queue sidebar; Champagne Gold exposes output/brightness cards; Cinematic puts video artwork in the centre; Nerd Mode includes labelled diagnostics. Audio meters without real signal telemetry remain unavailable, and volume stays in the actual reported percent scale rather than fabricated dB.

The browser opens **Test bench** by default at **`/`**; **`/?lab=1`** also works. The case has the illuminated physical button **on its top surface**. The actual product application renders directly inside the case; there is no separate demo implementation. The kiosk uses the screen-only mode described under HDMI development / DSI production below. The independent test panel contains **Controls**, **Modules**, **States** and **Events**. Select a module to inspect or inject a fault; the latest timestamped events remain outside and beside/below the device preview. The physical top button performs standby/wake through the same backend state machine. Speaker animation requires safe simulated enable, playback and nonzero/unmuted shared preview volume; display sleep preserves audio. Offline telemetry becomes unknown. Case dimensions, wiring, actual LED driver and physical audio remain unverified.

The workbench is responsive: case and tools sit beside each other on desktop and above/below on a phone. Its display renders and scales the same React product directly at 1280 × 400, without a nested iframe or second Codespaces authentication, while **Product only** opens the normal touch interface in a separate tab and keeps the bench visible. Settings and simulator controls retain swipe, arrow and page-picker navigation. The timeline is paginated. There is no hardware-fault injection or state/event panel inside the product display itself.

Settings pages: General, Skins, Palette, Accents, Typography, Finish, Automation, Schedule, State mapping, Save theme and Connection. Controls pages in the workbench: Scenarios, Sensors, Connections, Safety and Timeline. These use bounded pages rather than vertical scrolling at the tested desktop/phone sizes. The product can reflow on narrow screens.

## Startup animation

Your supplied MP4 and PNG are in `public/media/`. The startup layer plays the 1280 × 400, 30 fps H.264 clip muted/inline for 2.8 seconds and uses the PNG as fallback. If the application is still booting, it holds the still; fault/shutdown take priority. It never treats animation completion as hardware readiness. **Replay startup** in the workbench previews the branding without rebooting or changing amplifier state. Physical OS/firmware boot visuals and Safari/Pi decode still require target testing.

## Optional live Music Assistant mode

See [setup and first real test](docs/music-assistant.md). Server-only `.env` configuration selects simulation or live music. The Connection settings page lists available players; control defaults to read-only, with an explicit player choice and a configurable volume ceiling. The reference-style horizontal volume control shows actual server-reported volume in live mode; it supports horizontal touch drag, plus/minus, mute and keyboard controls. SSE pushes metadata/volume changes to the browser. Connecting never auto-starts playback or changes the player volume. The live server and audible output are not yet validated.

The uploaded `01_reference_hifi.jpg` shows horizontal volume next to VU meters. The control now follows that direction; percentage is reported honestly instead of inventing a dB calibration. L/R meters show unavailable until a real audio-level source exists. The six references now guide distinct shared-component layouts; exact artwork content and unmeasured audio readouts are not fabricated.

Typography now follows the canonical brand guide: self-hosted Manrope variable font (SIL OFL, license in `public/fonts/`), shared starter palette from `design/brand-tokens.css`, and a compatible saved-token schema. Nerd Mode can inherit the selected palette. Startup is reduced-motion aware; a ready screen responds immediately to input, dismissing branding rather than waiting for the clip.

### A blank or white display

Use the forwarded **5173** browser preview when running `npm run dev`. Stop an existing server with Ctrl+C, run `git pull --ff-only`, restart `npm run dev`, and reload the preview. The test toolbar must show **display-r3**; if it does not, the latest frontend is not loaded. The 3001 port is the backend and can serve an older production build from `dist`.

The startup shell now reports module/network failures, and a React error boundary provides a reload action for rendering failures. Settings are retained. Display brightness uses a non-interactive dim layer instead of a CSS filter around the scaled video surface. A white screen on a physical iPhone/iPad remains unconfirmed locally; report whether the entire page or only the case display is blank, the visible version, and a screenshot.

For a second browser engine: `npx playwright install --with-deps webkit`, then `npm run test:webkit`. WebKit tests run in Linux and do not replace physical Safari testing. Chromium exercises native touch injection; WebKit exercises the same swipe handlers with synthetic touch events because Playwright has no equivalent CDP touch injection there.

### Node 22.16 startup

The development backend runs without Node watch mode: Node 22.16 can crash when `--watch` is combined with a missing `--env-file-if-exists=.env`. A `.env` file is optional for simulation. Vite still hot-reloads frontend changes; restart `npm run dev` after backend or environment changes. If the backend exits, concurrently stops Vite too, so a blank/unavailable preview can mean the development processes have stopped.

### Always-visible test bench and amplifier faults

The browser root `/` now opens the test bench by default. Settings, Queue and Now playing navigate within its display while the external hardware panel stays visible. **Product only** opens `/?screen=1` in a separate tab and leaves the bench in place. `/?lab=1` remains supported; `/?product=1` is a standalone browser preview with navigation back to the bench. Use `/?screen=1` for the Pi kiosk.

Injected amplifier faults latch in the shared backend runtime, so refreshing the browser does not clear them. **Acknowledge faults** clears the latch and enters standby with the amplifier off and verification still revoked. Restore faulty sensor inputs, then use the simulation Playback scenario to start a new verified mock run. This scenario resets simulated conditions; it does not repair or verify physical hardware. Sensor failures or a stopped heartbeat can fault again. All real GPIO remains disabled.

## HDMI development / DSI production

The same production UI supports a centered, letterboxed 1280 × 400 preview on an ordinary HDMI monitor and a native 1280 × 400 DSI screen. No DSI hardware is required in HDMI development mode. Open `/?screen=1&display=hdmi-development` or `/?screen=1&display=dsi-production` on the app's browser URL. All six skins, keyboard/mouse controls, settings and playback use the same components and backend.

On an installed Pi, switch with `sudo /opt/daw-one/set-display-mode.sh hdmi-development` or `sudo /opt/daw-one/set-display-mode.sh dsi-production`. Only the kiosk restarts; the backend keeps running. See [display modes and minimal Pi OS Lite kiosk setup](docs/display-modes.md) for installation, pixel sizing, recovery and DSI hardware blockers.

## First Raspberry Pi installation

Read [the first-run Pi and Music Assistant guide](docs/pi-first-run.md) before installing. The private GitHub link requires a logged-in authorized account; after installation the same guide is available through `/docs/` on the local app, or at `/opt/daw-one/docs/pi-first-run.md`. Run `npm run doctor` in `/opt/daw-one` to check app assets and backend health; add `-- --require-ma` to require a live MA transport connection. These checks do not certify display, audio or electrical hardware.

## Apple Silicon VM rehearsal

For a MacBook M5, use [the UTM ARM64 VM guide](docs/mac-vm.md). A guest can run the same installer with `sudo bash deploy/install.sh --target vm`; the default remains Pi 4 and rejects non-Pi hardware. The VM rehearses Linux/systemd/kiosk/application behavior, not physical Pi firmware, GPU, DSI or audio. On a 16 GB host, proposed guest settings are 2 GB RAM, 4 vCPUs and 32 GB disk. No Mac VM has been created or physically validated by this repository.

Startup compatibility: the supplied animation is also bundled as VP8/WebM for Linux Chromium, with MP4 as an alternate source. The decoded first frame is painted before playback starts from zero; completion follows the media clock. Unavailable/slow media falls back to a CSS fade of the supplied logo instead of silently staying static; reduced-motion intentionally remains static.
