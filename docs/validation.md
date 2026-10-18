# Validation evidence — 2026-10-18

Executed in the implementation cloud environment (Node.js 24.19.0, Linux):

| Check | Observed result |
| --- | --- |
| `npm test` | 45 domain, safety, adapter, scenario, enclosure and theme tests passed |
| `npm run build` | Passed; Vite production assets generated |
| `npm run test:ui` | 8 Chromium tests passed: 1280 × 400 geometry/touch/navigation, offline settings, all dashboard scenarios, 390 px phone layout/keyboard navigation, theme customization/persistence/Nerd widgets/state switching, swipe navigation, all settings/simulator pages without scrolling, case power/display/module actions and safety-linked speaker indication |
| `npm run test:offline` | 1 Chromium production test passed: full network outage, cached app reload and persistent editable settings |
| `bash -n deploy/install.sh deploy/health.sh` | Passed; syntax only, not a real Pi install |

Production JS bundle is approximately 255 kB uncompressed / 80 kB gzip, CSS approximately 24 kB / 6 kB gzip. These are build sizes, not measured Pi CPU/memory. Backend keeps at most 500 timeline entries. No hardware control module or driver is enabled.

Browser tests use Chromium with touch emulation, not an iPhone/iPad. WebKit downloaded but runtime dependencies are unavailable; no WebKit/Safari pass is claimed. Codespaces config is supplied, but a real GitHub Codespace session was not created from this environment. The same npm startup and private-port proxy flow was tested locally by Playwright. Pi package installation, kiosk seat/display/touch, Squeezelite playback, actual MA transport, physical thermal/power/controller protection and phase 5 require target access.

Safety coverage explicitly tests denied amplifier enable for unverified hardware and every simulated latched fault. These tests certify software simulation behaviour only; they cannot establish electrical safety or firmware operation.
