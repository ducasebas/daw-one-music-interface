# DAW TuneBox v1 — Raspberry Pi streaming amplifier prototype

DAW TuneBox v1 aims to turn a Raspberry Pi 4 into a dedicated streaming-amplifier controller with a premium **1280 × 400 touchscreen interface**, Music Assistant playback integration and clearly modelled standby, display and safety states.

**Current release: a runnable software prototype with simulated hardware.** The interface, simulator and automated software tests are implemented. Live Music Assistant playback, the Sonocotta Louder HAT and electrical protection still require real-system validation. No physical amplifier is enabled by this application.

## Project name

**DAW TuneBox v1** is the current product name. **DAW ONE** is the earlier name still present in the interface, startup artwork, repository name, package, installation paths and systemd services. They refer to this same project. Existing names such as `/opt/daw-one` and `daw-one.service` remain valid; this documentation update does not migrate installed systems or replace branding assets.

## Product goals

- A focused Now Playing experience with touch, mouse and keyboard controls.
- Music Assistant integration for an external player, metadata and queue.
- Six skins, shared design tokens, saved custom themes and automatic switching.
- Display sleep independent of audio activity, with standby and presence behaviour.
- One shared application state model for the product, simulator and future hardware adapters.
- A Raspberry Pi OS Lite kiosk deployment with health checks, logs and recovery instructions.
- Physical amplifier control only after revision-specific electrical and fail-safe validation.

The intended prototype combines a Pi 4 with 2 GB RAM, a Waveshare 7.9-inch DSI display and a **Sonocotta Louder Raspberry Pi HAT**. The exact Louder variant and board revision must be confirmed; older notes mentioning “Louder HAT Plus” do not establish the selected model.

## What Music Assistant does

Music Assistant provides the music library and controls supported audio players. TuneBox supplies the product interface and device behaviour through a React frontend and Node backend; it does not embed the Music Assistant interface as an overlay.

```text
TuneBox browser UI ↔ TuneBox Node backend ↔ Music Assistant server ↔ audio player
                              ↕
                    shared device/safety model
                              ↕
                  simulated hardware (current)
```

Music Assistant needs a separately configured server and a working player. The browser itself is not the audio player. Connecting a server does not automatically validate every button, player capability, video source or physical amplifier.

## Current status

| Area | Implemented | Remaining validation |
| --- | --- | --- |
| Product UI | Now Playing, queue, settings, horizontal volume and six skins | Final target display, accessibility and physical touch checks |
| Themes | Shared tokens, local custom themes, day/night and state switching | Readability on the final screen |
| Virtual device | Shared state machines, scenarios, sensors, physical-button/LED preview, modules and timestamped events | Actual button, LED driver and sensors |
| Safety | Simulated fault latching, watchdog and denied enable for unverified/faulted hardware | Independent physical disable, controller firmware and electrical tests |
| Music | Mock playback and Music Assistant adapter with protocol-fixture tests | Real server/player compatibility and audible output |
| Video Artwork | Mock video clock, End-Sync arithmetic and fallback states | Real video matching, embed availability and end-to-end synchronisation |
| Startup | MP4/WebM branding, decoded-first-frame playback and fallback | Owner confirmation of the latest fix in UTM; Pi decoding |
| Deployment | Pi/ARM64 VM installer, systemd kiosk, local guides and doctor | Real Pi display/audio/resources and cold boot |
| Owner's VM | Owner reports the ARM64 Debian UTM kiosk runs | Latest startup fix, persistent resolution and remaining interaction checks |

Software simulation does not certify physical safety, sound quality, latency or output power. Phase 5 hardware validation is **not complete**. See [recorded test evidence](docs/validation.md) and [hardware verification blockers](docs/hardware.md).

## Start in Codespaces or locally

Use **Node.js 22.12 or newer** and npm.

```sh
npm ci && npm run dev
```

Open **http://localhost:5173** locally, or the private forwarded **5173** port in Codespaces. The devcontainer can install dependencies and start the app automatically. Vite proxies backend requests to loopback port 3001. A `.env` file, Music Assistant server and hardware are unnecessary for simulation.

For subsequent starts use `npm run dev`; stop it with **Ctrl+C**. Frontend changes hot-reload. Restart after backend or environment changes.

Production preview:

```sh
npm ci
npm run build
npm start
```

Open **http://127.0.0.1:3001**. Production serves the built frontend; rebuild after changing it.

| Browser path | View |
| --- | --- |
| `/` or `/?lab=1` | Product case with separate test bench |
| `/?product=1` | Standalone responsive product |
| `/?screen=1&display=hdmi-development` | Fixed logical 1280 × 400, centred and letterboxed |
| `/?screen=1&display=dsi-production` | Native 1280 × 400 production layout |

HDMI development requires no DSI display. Both display modes use the same components, themes, APIs and playback state.

## Try the complete virtual device

1. Open the test bench. In **Controls**, select the **Playback** scenario and run it to establish a verified *simulation*.
2. Test play/pause, next/previous, seek, volume and mute. Simulation emits no real audio. Toggle Video Artwork and inspect its mock timing/manual offset.
3. Change skins or save a custom theme in Settings, then reload to check persistence.
4. Exercise standby, presence wake and display timeout. Display sleep preserves simulated audio; standby stops playback.
5. Inject temperature, power-good, amplifier or heartbeat failures. Inspect **Modules**, **States** and **Events** for transitions, enable/mute requests and reasons.
6. Restore sensor inputs and acknowledge faults. Acknowledgement leaves the amplifier off and verification revoked; run Playback again for a fresh verified simulation.

The top-of-case button and LED ring are simulated. Speaker indication requires safe simulated enable, active playback and nonzero/unmuted preview volume. L/R meters remain unavailable without actual signal telemetry.

The bench and product share the same backend state; this is not a separate demo. **Product only** opens a separate tab while the bench remains available. Settings and simulator controls use swipe pages, arrows and page pickers; narrow screens may reflow.

Settings remain editable during backend outages, but device commands require a connection. Offline telemetry is unknown, not proof of a safe live device. Production supports offline shell reload after a successful visit; development does not install that service worker.

## Safari on Mac, iPhone and iPad

Use the private Codespaces 5173 HTTPS URL while signed into the authorized GitHub account. Landscape gives more room for the product layout. Test navigation, playback, settings persistence and simulator scenarios.

For a local VM, follow the [Mac/UTM guide](docs/mac-vm.md) to access its loopback service through SSH. A host browser can provide a sharper preview than a scaled UTM window. Physical Safari, Pi graphics and touchscreen behaviour require their own checks; Linux Chromium/WebKit automation is not equivalent.

## Test and continue development

```sh
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:ui
npm run test:offline
```

Optional second browser engine:

```sh
npx playwright install --with-deps webkit
npm run test:webkit
```

Recorded runs include **64 Node tests**, a prior full **20-case Chromium UI run**, **4 production-browser tests**, and **6 targeted startup regressions** after the latest startup change. These were separate runs, not a claim that every current browser suite was rerun together. Dates, environment and limitations are in [validation.md](docs/validation.md).

Node coverage includes playback transitions/reconnection, protocol fixtures, End-Sync edge cases, themes, deployment policies and safety scenarios. Browser coverage includes layout, controls, persistence, offline behaviour and startup recovery.

```text
src/                 React product, themes, startup and test workbench
shared/              Shared contracts, device/safety logic, playback and End-Sync
server/              Simulation API, Music Assistant adapter and diagnostics
tests/               Domain, integration, scenario and browser tests
deploy/              Installer, kiosk, systemd units and inert hardware examples
docs/                Setup, API, verification, operations and evaluation plan
.devcontainer/       Codespaces setup and private browser preview
.github/workflows/   Automated checks
```

Keep new hardware adapters behind the shared model and deny physical enable until verification is recorded. Do not build a second disconnected simulation.

## Raspberry Pi and VM installation

Follow the [Pi first-run guide](docs/pi-first-run.md) or [ARM64 UTM guide](docs/mac-vm.md). Raspberry Pi OS Lite uses a minimal Cage/Wayland/Chromium kiosk. VM installation explicitly uses `--target vm`; the default Pi target rejects other machines.

On an installed system:

```sh
sudo /opt/daw-one/set-display-mode.sh hdmi-development
sudo systemctl enable --now daw-one-kiosk.service
cd /opt/daw-one
npm run doctor
```

Switch to `dsi-production` only when preparing the corresponding screen. The switch changes kiosk configuration, not boot wiring or hardware verification.

Doctor checks HTTP/assets and installation prerequisites; it does not prove visible pixels, audible output or electrical safety. Use `npm run doctor -- --require-ma` to require a live Music Assistant transport connection. Local guides are available at `/docs/` and `/opt/daw-one/docs/`.

See [display modes](docs/display-modes.md) and [Pi operations/recovery](docs/raspberry-pi.md). Early Linux boot concealment, physical backlight gating and persistent VM resolution are not certified by the application splash.

## Live Music Assistant setup

Follow [Music Assistant setup](docs/music-assistant.md). Configure the server on the backend, select a player explicitly and enable controls only when ready; live control defaults to read-only. Connecting does not automatically start playback or change volume. Installed systemd configuration uses the documented system paths, not merely a repository `.env`.

Verify real metadata, queue updates, volume/mute, play/pause, reconnect and seek where the selected player supports it. A successful connection alone is not an audio or complete-interface acceptance test.

## Sonocotta development sample

We would like to evaluate a Louder HAT and produce a reproducible integration guide, honest test results, issue reports and a short demonstration. A development sample would allow the physical audio work that simulation cannot validate.

Read the [evaluation plan and draft sample request](docs/sonocotta-evaluation.md) for manufacturer questions, staged acceptance evidence and proposed deliverables. No request has been sent, sample promised or sponsorship established. A demonstration video is optional for initial outreach; screenshots and a clear explanation are also suitable. The repository remains private.

## Next concrete tasks

1. Confirm full startup playback and stable display settings in the owner's VM.
2. Run the complete interaction/scenario checks and record remaining failures.
3. Connect a real Music Assistant server/player and validate actual controls and audio.
4. Confirm the Louder SKU/revision with Sonocotta and obtain matching documentation.
5. Validate Pi kiosk, DSI/touch and supported audio setup on real hardware.
6. Implement and measure controller, power and mute protection before permitting physical amplifier enable.

Additional references: [API/protocol](docs/protocol-and-api.md), [hardware release gate](docs/hardware.md), [validation history](docs/validation.md).

## Troubleshooting

- **Blank/unavailable page:** start `npm run dev` and use port **5173**. Port 3001 may serve an older production build. The loading shell and React error boundary expose startup failures.
- **Latched amplifier fault:** restore simulated inputs, acknowledge, then run a fresh Playback scenario. Refreshing the browser does not clear backend faults.
- **No startup animation:** reduced-motion intentionally uses a still. Otherwise WebM/MP4 playback falls back to a logo fade if unavailable; **Replay startup** does not reboot or enable hardware.
- **Private guide inaccessible on GitHub:** use the installed app's `/docs/` page or local files.
- **No sound in simulation:** expected. Real sound requires a configured Music Assistant player and validated audio hardware.
