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

First-frame correction: remove autoplay and the final-frame poster, prime the decoded frame at time zero, wait two browser paints and a short presentation settle, then play. The media ended event controls video completion; a paused/stalled video is not truncated by a 2.8-second wall timer. The loading deadline is 8 seconds and frozen playback has a 12-second fallback watchdog. Hidden startups pause and replay when visible. Physical UTM window mapping still requires user confirmation.

For the first-frame correction, 64 Node tests and the build passed; six targeted Chromium startup/branding regressions passed, including priming at currentTime=0 without autoplay and a 3-second paused-media test. The previous full UI run covered 20 cases; the newly added priming case was checked in the targeted run.

GUI 2.0 preview (30 October 2026): 66 Node tests and the Vite build passed. Two new Chromium journeys verify shared queue mutations, touchscreen keyboard search, Rivo visual-only grouping, native 1280 × 400 bounds, shared settings and latched amplifier-fault inhibition. GUI 2.0 is opt-in via `gui=2`; existing product routes remain available. SVG icon outlines use a transparent background and skin colours. No real MA library, Rivo endpoint or physical amplifier was connected for this work.

Final GUI 2.0 regression run: **all 23 Chromium browser tests passed together (1.3 minutes)** using system Chromium and a serial Playwright worker. The run includes the two new GUI 2.0 journeys and all 21 existing GUI/startup checks. Test setup now explicitly restores shared preview volume/mute between journeys; module-load fault injection matches Vite query strings. A separate browser check confirmed example-favourite persistence after reload and SVG `viewBox`, `fill=none`, `stroke=currentColor`. Build passed at approximately 286 kB JS / 89 kB gzip. No Pi performance or physical audio result is implied.

GUI 2.0 motion/activity update (31 October 2026): **67 Node tests, all 25 Chromium browser tests (1.3 minutes) and the production build passed**. Coverage includes returning from playback to the same album/search context, reduced-motion disabling animation, delayed command/pending feedback with navigation still usable, and `/demo.html` opening the shared GUI 2.0 workbench. Virtual-time runtime tests confirm repeated activity postpones display sleep, inactivity still permits it, playback continues, display wake does not alter amplifier enable, and activity cannot escape standby/faults. The backend was restarted before browser validation. These are software checks; Pi frame pacing and physical display/backlight behaviour remain unverified.

GUI 2.0 skin refinement (31 October 2026): **67 Node tests, five targeted Chromium GUI 2.0 tests and the production build passed**. The new six-skin journey switches presets, traverses the five music sections at native 1280 × 400 without content overflow, opens Now Playing, inspects unavailable meters and Nerd diagnostics, verifies the SVG contract and checks selected-skin persistence on reload. Screenshots of all six Now Playing variants were inspected. The prior complete 25-test run remains separate; no new full 26-test run, physical Safari/Pi performance or formal accessibility certification is claimed. Production bundle approximately 291 kB JS / 90 kB gzip and 83 kB CSS / 16 kB gzip.

Visible build marker (31 October 2026): **68 Node tests, six targeted Chromium GUI 2.0 journeys and the production build passed**. New checks cover release alignment for matched/mismatched/missing/offline metadata and the actual visible frontend marker plus a deliberately outdated backend fixture. The marker is separate from the legacy display-r3 diagnostics string. Git revision is captured at Vite startup/build; the cloud checkout without Git metadata intentionally displays `source`. The preceding full 25-case run remains separate.

The final version-marker journey also opens Product only from the GUI 2.0 workbench and verifies the popup retains `gui=2` and the visible release marker. This prevents the legacy screen route from being mistaken for an unchanged GUI 2.0 skin.

Transport icon refinement (31 October 2026): **68 Node tests, seven targeted Chromium GUI 2.0 journeys and the production build passed**. The primary button uses grid centring, zero text line-height and a fixed 20 px SVG inside its 44 px button. Play and pause use compact filled silhouettes on transparent SVG backgrounds; pause bars are symmetric about x=12, and both glyphs are symmetric vertically about y=12. The triangle has optical horizontal placement. Browser checks measure button/SVG centre alignment and glyph bounds, and toggle playback in all six skins. This release displays GUI 2.5 · TRANSPORT.

## Touch volume and complete flow review — 31 October 2026

All checks below completed successfully **before publishing this release**:

| Check | Result |
| --- | --- |
| Node domain/integration/scenario suite | 73 passed |
| Complete Chromium UI suite | 37 passed, 1.8 minutes |
| WebKit GUI 2.0 and volume journeys | 16 passed, 1.8 minutes |
| Production/offline suite | 5 passed, 18.7 seconds |
| Production build | Passed |

The volume tests cover real Chromium touch injection, tap/drag geometry, release-only commits, cancellation, keyboard/fine steps, circular centre/arc interaction, mode persistence, live ceiling/read-only/unknown values, rejected requests, serialised rapid changes and scaled workbench coordinates. WebKit exercises the actual mouse/pointer route and a synthetic pointer-cancel event; it is not physical Safari touch certification.

Flow checks also cover all eleven settings pages in both modes, all six skins, navigation/back context, local favourites after reload, empty search and radio states, shared queue/device APIs, simulator states/faults and offline editing. General/Schedule layout overflow found during review was corrected. Production GUI 2.0 retains its chosen volume mode offline while disabling device commands.

The longer run exposed an existing live-update defect: Node writable-stream backpressure was treated as disconnection once the event log grew. The new bounded/coalescing snapshot writer keeps clients connected and retains only the latest waiting snapshot. Unit tests cover drain/disconnect handling; a 140-command browser stress journey verifies that the UI remains usable. An SSE error now triggers the HTTP connectivity fallback instead of falsely declaring a healthy backend offline.

WebKit's Linux dependencies were extracted into the temporary test environment from checksum-verified Debian packages; no project runtime dependency or target hardware setting was added. The browser actually launched and the stated tests ran; host preflight validation was skipped for the non-system library location. The normal developer setup remains Playwright's documented install-with-deps command.

This validates software simulation/fixtures, not actual MA streaming, Rivo synchronisation, acoustic latency or physical amplifier/backlight safety. Release marker: **GUI 2.6 · TOUCH VOLUME**. GUI 1.0 retains its prior reference volume presentation.

## Transport balance, mute and quiet music header — 31 October 2026

Before publication: **73 Node tests, the full 40-test Chromium suite (2.4 minutes), 19 targeted WebKit GUI/volume journeys (2.2 minutes), five production/offline tests (17.7 seconds), and the production build passed**.

New browser checks measure equal 44 px transport hit boxes, equal button-centre spacing, a dominant 16 px primary glyph and matching vertical centres. Play/pause closeups were visually inspected. Previous/next are filled mirrored shapes, so their weight no longer competes with an undersized primary icon.

Both volume modes retain the exact value and indicator position when muted, turn grey, expose muted text and pressed state, and restore the same volume on unmute. Skin selection was removed from the music header and tested through Settings → Skins. A network-summary test checks the simulation disconnect state, expandable information, Escape dismissal and explicit unmeasured signal strength. No OS Wi-Fi/RSSI telemetry or fabricated strength bars were added. Linux WebKit is still not physical Safari/touchscreen certification.

Release: **GUI 2.7 · POLISH**. Source changes were tested before the GitHub update.

Pi readiness review (1 November 2026): 75 Node tests passed, including the current GUI 2 kiosk URL and explicit refusal of the owner's Pi 3 B+ by both Pi 4 and VM target policies. Production build passed; shell syntax checks passed for installer/kiosk/health/mode switch/read-only inventory. Inventory was run only on the cloud host, which correctly reported no Pi model. No actual Pi deployment, Pi RAM/frame-rate benchmark or image build is claimed. The available-board correction and image/footprint findings are in pi-readiness.md.

## Pi 3 experimental profile — 2026-11-01

Executed in the cloud, not on a physical Pi: 78 Node tests passed, including explicit B+ ARM64 target gates, unchanged Pi 4/VM refusal rules, immutable presentation settings and release-archive integrity/exclusion checks. Production build and bundle packaging passed. All 41 Chromium UI tests and all 5 production/offline tests passed, including the new Pi3 profile, video exclusion, six-skin picker and 1280 × 400 geometry. Shell syntax checks passed. This run does not establish Pi 3 memory consumption, frame rate, kiosk hardware compatibility, or electrical safety. No additional WebKit or physical Safari run was performed for this profile.

## Publication maintenance — 3 November 2026

Cloud checks after removing the unnecessary Node-24-only test-isolation flag and updating the compatible body-parser dependency: **78 Node tests passed on Node 24 and 78 on Node 22**, production build passed, **41 Chromium UI tests** and **5 production/offline tests** passed. `npm audit` reported **0 known vulnerabilities** at this time (not a guarantee against unknown defects). No new WebKit, physical Safari, HAT or endurance run was performed. Earlier GitHub Actions failures were inspected directly: Node 22 rejected the old flag before browser tests could run. The updated workflow checks Node 22 and 24; remote CI status must be confirmed separately. Owner-operated real Pi/audio observations are recorded in [the field report](field-test-2026-11-01.md), separately from these cloud checks.

## Automatic Pi target / co-hosting foundation — 4 November 2026

83 tests passed on Node 24 and Node 22; build and prebuilt release packaging passed. Node tests cover exact Pi3 B+/Pi4 detection, explicit VM/architecture gates, low/unknown/faulted/hot/loaded-host rejection and default-no optional-server admission. Shell scripts are syntax-checked; the release bundle includes the new deploy/shared/docs files. No Pi installation, Docker image execution, MA onboarding, physical PD/I²C/GPIO/fan/display test or new skin/boot implementation is claimed. The I/O attachment and boot flow are marked proposals with electrical verification blockers. Capacity thresholds are proposed engineering policy, not measured headroom guarantees.

## GUI 2.9 boot checks — 5 November 2026

Shared startup checks and changed-result logging, persistent simulated autoradio settings, a one-shot cold-boot decision, read-only host inventory and MA auth-error classification were implemented. 93 Node tests passed on Node 24 and Node 22 before the final optional-device classification check; the final run count is recorded below; production build and release packaging passed. Native boot pages were checked in all six skins, including inner page bounds. Full browser regression initially exposed a clipped nested panel, scenario boot-input carryover and compact events hiding an amplifier fault; these were corrected, with the safety-event browser regression rerun successfully. The full Chromium run passed 43 cases; the additional offline boot case was corrected to disconnect both HTTP and SSE rather than just aborting HTTP polling, then passed its rerun (44 browser cases covered). All 6 production/offline checks passed, including cached-shell boot telemetry. A final optional-device classification regression is recorded below. No new WebKit/physical Safari, real Pi smoothness, physical hardware/DSI/backlight control or real radio autoplay validation is claimed. See [boot runtime](boot-runtime.md) for exact feature boundaries.

Final 5 November check: **94 Node tests passed on Node 24 and Node 22**. The additional optional-device classification test confirms an absent optional digital output/fan does not produce a false warning. All **3 boot UI tests** passed again after this final classification, across all six skins and backend-loss states. Together with the existing journeys, **44 Chromium browser cases** were covered successfully; **6 production/offline cases** passed. Build and release-package checks passed; no hardware tests are implied.

## Optional PCT2075 / TSL2591 telemetry — 6 November 2026

96 Node tests and the production build passed. Three hardware-free Python tests cover signed temperature decode, invalid/saturated measurements and independent sensor failures. Four Chromium sensor/boot journeys passed, including distinct actual-readout fixtures, native page bounds and unknown telemetry on backend loss. Sensor commands and bus addresses were previously validated by the owner manually; the new dedicated account, service/device permissions and Python driver environment still need installation verification on the Pi. No sensor fixture grants amplifier verification or drives brightness, fans or GPIO.

## Sensor cards — 6 November 2026

96 Node tests and production build passed. Four targeted boot/sensor browser cases passed; the sensor case was then expanded to check each sensor card and inner page bounds in all six skins, with offline unknown status. Real sensor values remain separate from CPU/simulation checks, and the backend sensor/security policy is unchanged. No new hardware/service installation validation is claimed.

## Live library / artwork and calm temperature display — 6 November 2026

105 Node tests passed on Node 24 and Node 22, the production build passed, all 47 Chromium UI cases passed, and all 6 production/offline cases passed. New fixture journeys cover live album/track browsing, explicit queue actions, retained browse context, all six skins, read-only controls, touch search and obsolete-response protection. Artwork tests cover opaque IDs, backend-only credentials, redirect/SVG rejection and bounded caching. MA 2.10.9 source contracts were inspected directly; the owner's NUC was not accessed, so actual provider results, artwork delivery and audible new-media playback still require a Pi-side check. Temperature display smoothing/rounding is presentation-only; raw telemetry and amplifier permissions remain unchanged.

## 2026-11-06 — GUI 2.13 signed OTA foundation

Executed in the cloud workspace: 111 Node tests passed; six Python sensor/archive tests passed; 48 Chromium browser tests passed at the product viewport, including read-only Updates settings; six production/offline browser tests passed; Vite production build and release packaging succeeded. A real generated release archive passed an ephemeral Ed25519 signature check, archive hash/size validation, safe extraction, and complete inventory/frontend release validation. Production dependencies were also staged with npm scripts disabled, after which the signed file inventory remained unchanged. Shell and updater syntax checks passed.

OTA tests cover wrong signatures/keys/channels, replay, modified archives, playback/fault/unknown-state deferral, health failure rollback, retention of the recovery journal when rollback is unhealthy, successful transaction ordering, safe release retention, archive traversal/link/special-file rejection, and status API redaction. Systemd/service operations in transaction tests are mocked. No signing secret was created in GitHub, no OTA release was published, and no physical Pi update, power interruption or rollback has yet been tested. Normal installs keep real hardware controls disabled.
