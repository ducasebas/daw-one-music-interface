# Validation evidence — 2026-10-29

Executed in the implementation cloud environment (Node.js 24.19.0, Linux):

| Check | Observed result |
| --- | --- |
| `npm test` | 64 domain, VM-target, deployment-diagnostic, display-mode, safety, MA protocol/service, scenario, enclosure and theme tests passed |
| `npm run build` | Passed; Vite production assets generated |
| `npm run test:ui` | 20 Chromium tests passed: 1280 × 400 geometry/touch/navigation, offline settings, workbench and shared React/backend state, 390 px phone layout/keyboard navigation, theme customization/persistence/Nerd widgets/state switching, swipe navigation, all settings/simulator pages without scrolling, case power/display/module actions and safety-linked speaker indication, reference volume/Connection page and live read-only metadata fixture |
| `npm run test:offline` | 4 Chromium production tests passed: offline reload/settings plus HDMI/DSI exact geometry, all six skins, mouse playback, keyboard volume, small-window scaling and playback preserved across mode changes, plus local help and deployment doctor |
| `bash -n deploy/install.sh deploy/health.sh deploy/kiosk.sh deploy/set-display-mode.sh` | Passed; syntax only, not a real Pi install |

Production JS bundle is approximately 269 kB uncompressed / 84 kB gzip, CSS approximately 61 kB / 11 kB gzip. These are build sizes, not measured Pi CPU/memory. Backend keeps at most 500 timeline entries. No hardware control module or driver is enabled.

Browser tests use Chromium with touch emulation, not an iPhone/iPad. Earlier WebKit runs covered 17 UI cases (including a corrected geometry case rerun), followed by two targeted phone/navigation/recovery cases. The current HDMI/DSI production checks ran in Chromium. Linux WebKit is not physical Safari validation. Codespaces config is supplied, but a real GitHub Codespace session was not created from this environment. The same npm startup and private-port proxy flow was tested locally by Playwright. Pi package installation, kiosk seat/display/touch, Squeezelite playback, actual MA server compatibility/audio, physical thermal/power/controller protection and phase 5 require target access.

Safety coverage explicitly tests denied amplifier enable for unverified hardware and every simulated latched fault. These tests certify software simulation behaviour only; they cannot establish electrical safety or firmware operation.

Music Assistant protocol tests use injected WebSocket fixtures: handshake/auth, partial results, timeouts, disconnect cleanup, commands/volume ceiling, read-only mode, explicit player selection, queue events and reconnect. No real MA endpoint or access token was supplied during implementation; no actual audio test is claimed.


The default root is the workbench; `/?lab=1` remains supported. `/?screen=1` renders the fixed native product. Tests verify top-surface button geometry, shared React/backend controls, modules outside the case, state/event pages, speaker mute/volume gating, all six layouts and user-supplied startup fallback/replay. Startup file metadata was inspected with ffprobe: H.264, 1280 × 400, 30 fps, 2.800 seconds, no audio. Hardware boot, actual LED wiring/driver and target Safari decoding remain unverified.

White-display regression: the virtual display now mounts the actual product in the same React tree, without a nested document request, iframe or postMessage bridge. Browser tests deny framing with CSP and X-Frame-Options and verify rendering, playback controls and fixed 1280 × 400 logical dimensions on a phone viewport. This removes an iframe/authentication failure path; the original Safari symptom has not been reproduced on a physical Apple device.

Display-r3 adds a readable pre-React loading/error shell, a React rendering error boundary, and a visible build marker in the workbench. It removes filtered ancestors around the scaled display/video. The WebKit suite also checks module-load and rendering failure messages; its swipe test uses synthetic touch events, while Chromium retains native CDP touch injection. Physical Safari white-screen reproduction remains open.

HDMI development at 1920 × 1080 rendered the product at x=320, y=340 with width=1280 and height=400. DSI production at 1280 × 400 rendered at x=0, y=0. At 1024 × 768, HDMI uniformly scaled the product while retaining its logical 1280 × 400 dimensions. These are browser geometry measurements, not physical monitor measurements. Kiosk switch scripts passed syntax and invalid-mode rejection checks; no system services or boot settings were changed in this environment.

Pi first-run patch: installer now requires Node >=22.12/native WebSocket, ensures the service group and writable Chromium profile, installs D-Bus/PAM session dependencies, copies local guides and restarts/probes the backend after updating. Kiosk diagnostics remain read-only. Automated HTTP checks cover compiled frontend assets, startup media, local help and rejection of invalid/HTML asset responses. No Pi installation, seat session, actual MA endpoint, audio or physical amplifier was validated here.

ARM64 VM preparation: shared installer now has explicit `--target vm` with ARM64, real VM detection and systemd checks; default Pi-target rejection remains. Unit tests cover target acceptance/rejection without running privileged installation. This cloud environment has not created UTM on the user's Mac and does not establish VM graphical-session or Pi hardware success.

Startup-animation correction: a VP8/WebM transcode of the original MP4 is bundled for Linux Chromium. Video duration timing now begins on the playing event, with a bounded media-loading deadline and an animated PNG/CSS fallback; reduced-motion intentionally uses the static image. Browser coverage checks actual decoded video dimensions and advancing currentTime, fallback animation and fault priority. This addresses a possible slow-VM startup failure path; the exact original guest failure was not remotely reproduced.
