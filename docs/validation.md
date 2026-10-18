# Validation evidence — 2026-10-18

Executed in the implementation cloud environment (Node.js 24.19.0, Linux):

| Check | Observed result |
| --- | --- |
| `npm test` | 56 domain, safety, MA protocol/service, scenario, enclosure and theme tests passed |
| `npm run build` | Passed; Vite production assets generated |
| `npm run test:ui` | 14 Chromium tests passed: 1280 × 400 geometry/touch/navigation, offline settings, workbench and shared iframe state, 390 px phone layout/keyboard navigation, theme customization/persistence/Nerd widgets/state switching, swipe navigation, all settings/simulator pages without scrolling, case power/display/module actions and safety-linked speaker indication, reference volume/Connection page and live read-only metadata fixture |
| `npm run test:offline` | 1 Chromium production test passed: full network outage, cached app reload and persistent editable settings |
| `bash -n deploy/install.sh deploy/health.sh` | Passed; syntax only, not a real Pi install |

Production JS bundle is approximately 267 kB uncompressed / 83 kB gzip, CSS approximately 52 kB / 11 kB gzip. These are build sizes, not measured Pi CPU/memory. Backend keeps at most 500 timeline entries. No hardware control module or driver is enabled.

Browser tests use Chromium with touch emulation, not an iPhone/iPad. WebKit downloaded but runtime dependencies are unavailable; no WebKit/Safari pass is claimed. Codespaces config is supplied, but a real GitHub Codespace session was not created from this environment. The same npm startup and private-port proxy flow was tested locally by Playwright. Pi package installation, kiosk seat/display/touch, Squeezelite playback, actual MA server compatibility/audio, physical thermal/power/controller protection and phase 5 require target access.

Safety coverage explicitly tests denied amplifier enable for unverified hardware and every simulated latched fault. These tests certify software simulation behaviour only; they cannot establish electrical safety or firmware operation.

Music Assistant protocol tests use injected WebSocket fixtures: handshake/auth, partial results, timeouts, disconnect cleanup, commands/volume ceiling, read-only mode, explicit player selection, queue events and reconnect. No real MA endpoint or access token was supplied during implementation; no actual audio test is claimed.


The latest revision separates the product at `/?screen=1` from the browser workbench at `/?lab=1`. Tests verify top-surface button geometry, shared React/backend controls, modules outside the case, state/event pages, speaker mute/volume gating, all six layouts and user-supplied startup fallback/replay. Startup file metadata was inspected with ffprobe: H.264, 1280 × 400, 30 fps, 2.800 seconds, no audio. Hardware boot, actual LED wiring/driver and target Safari decoding remain unverified.

White-display regression: the virtual display now mounts the actual product in the same React tree, without a nested document request, iframe or postMessage bridge. Browser tests deny framing with CSP and X-Frame-Options and verify rendering, playback controls and fixed 1280 × 400 logical dimensions on a phone viewport. This removes an iframe/authentication failure path; the original Safari symptom has not been reproduced on a physical Apple device.
