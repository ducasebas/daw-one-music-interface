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
3. Hardware Simulator: select **Playback → Run scenario** to establish a safe simulated active system. Try each scenario, sensors and buttons. All pages use the same backend state. `simulation-verified` cannot bypass a fault, bad power, thermal limit or stale heartbeat.
4. Toggle presence, light, temperature, power-good, Wi-Fi, Music Assistant disconnect/reconnect, heartbeat and amplifier fault. Disable heartbeat and wait for the watchdog. Scroll down to the timestamped timeline for transitions, enable/mute requests, watchdog and errors.
5. Acknowledge a fault then wake: verification remains false. Start Playback scenario for a fresh verified simulation. Display-timeout preserves playback; standby stops it; shutdown inhibits enable. Boot and boot-complete model the two boot stages.

No real sound is emitted. Idle display state is shown in telemetry rather than hiding the simulator. UI brightness is a preview filter. Backend outage freezes the last preview snapshot; that snapshot must never be interpreted as live hardware status.

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

Settings → **Skins** includes Reference Dark, Warm Bronze, Champagne Gold, Cinematic and Nerd Mode. Use the **Palette**, **Accents**, **Typography** and **Finish** pages to change colors, typography, panel opacity, spacing, corner radius, border width, glow and meter style. Name and save up to 20 custom skins locally. No theme can enable hardware. Nerd Mode adds controller/temperature/power/enable diagnostics to Now Playing.

Automatic switching supports browser-local day/night hours (including schedules across midnight) or state mapping. State priority: fault → offline → standby/shutdown → playback → manual fallback. Each mapping and both schedule skins are configurable. Equal day/night hours choose night all day. Color customization can reduce contrast; inspect text readability on the target display before adopting a custom palette. Built-in colors do not claim formal accessibility certification. Theme data is versioned and validated; arbitrary CSS is not accepted. See `shared/themes.js` for the reusable schema/resolver and `src/Themes.jsx` for controls.

Offline cold reload is supported by the production build after one successful visit; development Vite does not register the static-shell service worker. API responses are never cached as live hardware state.

## Interactive enclosure and swipe pages

Open **Device** to see the conceptual case, illuminated power-button ring, status LED, embedded display, both speakers and eight module indicators. Press **Playback demo** to run the shared verified simulation scenario. The power button toggles standby/wake; touch a sleeping case display to wake it and an awake display to open Now Playing. Select a module for its explanation and contextual action (Wi-Fi/source disconnect, heartbeat loss, power-good failure, amplifier fault, display sleep or reboot). Real power rails, dimensions and speaker output remain unverified; indicators are explicitly **logical simulation status**, not measurements.

Speaker movement requires the same verified amplifier gate as the backend, fresh controller heartbeat, power-good, connected source, active playback and nonzero preview volume. Display sleep preserves safe audio. Faults, standby, network loss or stale/offline telemetry stop the speaker-drive indication; offline modules become **unknown** rather than displaying stale green lights. Animation respects reduced-motion settings.

Settings has eleven short pages: General, Skins, Palette, Accents, Typography, Finish, Automation, Schedule, State mapping, Save theme and Connection. The simulator has five: Scenarios, Sensors, Connections, Safety and Timeline. Swipe horizontally on empty page space, use previous/next arrows, or select a page directly. Keyboard users can focus the page region and press left/right. Gestures starting on controls are ignored so sliders, selectors and buttons retain their normal behaviour. Timeline history is also paginated (three events per page). Pages are bounded, without vertical scrolling at the tested 1280 × 400 and 390 × 844 layouts; Now Playing can still reflow on narrow screens.

## Optional live Music Assistant mode

See [setup and first real test](docs/music-assistant.md). Server-only `.env` configuration selects simulation or live music. The Connection settings page lists available players; control defaults to read-only, with an explicit player choice and a configurable volume ceiling. The reference-style horizontal volume control shows actual server-reported volume in live mode; it supports horizontal touch drag, plus/minus, mute and keyboard controls. SSE pushes metadata/volume changes to the browser. Connecting never auto-starts playback or changes the player volume. The live server and audible output are not yet validated.

The uploaded `01_reference_hifi.jpg` shows horizontal volume next to VU meters. The control now follows that direction; percentage is reported honestly instead of inventing a dB calibration. L/R meters show unavailable until a real audio-level source exists. Full visual matching of all six reference layouts remains a separate design task.
