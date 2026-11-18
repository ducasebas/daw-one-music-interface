# GUI 3.8.2 PD60 validation

Local candidate `2026.11.18-pd60.1`, cache 46; base published `fa5707c6130ffb2c38a4d5378a4305c9f28af867`. Implementation/testing authorized by “Ja Lets go” on 18 November 2026. The software checks below passed on the final runtime. The owner subsequently approved the review branch, CI, merge and signed preview publication with “Ja push maar” on 18 November 2026. Live writes remain separately confirmed on the device.

Coverage includes the observed 25 W active / 60 W offered register vector, exact 60–100 W targets, retained strict-100 W behavior, offer changes before/after the request, failed/partial readback, interruption recovery and same-boot matching player proof. Manager cases cover typed arguments, cable confirmation above 3 A, nonce/time matching, startup-policy persistence/rollback, legacy four/five-key client saves and existing serialized update/audio gates. Browser cases cover distinct readings, 60 W setup without a 100 W offer, owned pending/cancel behavior, optional warning-threshold Save, the native 1280×800 display and a 400px-high development preview, stale/changed profiles and previous-helper compatibility.

The first whole-suite pass attempt identified a missing default React import in the rewritten panel's classic-JSX SSR path. The import was restored; the targeted SSR check then passed. The first Python pass identified a legacy-file expectation that omitted the new false-by-default policy; the check now explicitly expects normalized defaults, preserving its old-file input. Initial logs are retained with subsequent final reruns. Neither is represented as an initial clean full run.

Hardware evidence supplied by the owner belongs to GUI 3.8.1. No test here issues a live I2C request. The upcoming 60 W request, boot repetition, actual amplifier draw and VBUS continuity remain physical acceptance checks.

The first browser run passed the ten retained cases and the new native 60 W case, then the added 400px viewport case timed out because it asked a fixed native 1280×800 DSI surface to fit a 400px-high viewport. DSI presentation deliberately does not scale. This extra small-preview check now uses the existing HDMI-development fit mode with the same 1280×800 wall profile; bounds, request, Save and readback assertions remain. It is not described as native legacy-panel coverage.

Visual review then found the primary dialog actions below the initial scroll position. The final layout keeps the target/header and action footer fixed while the explanation scrolls. Both the native 1280×800 view and the 400px-high development preview assert action height, screen bounds and hit targets; screenshots were inspected. The full 354 JavaScript checks/build and all 17 focused Chromium journeys were repeated successfully after this final runtime change. App code was then frozen for the broader browser runs.

## Completed local checks

| Check | Result |
| --- | --- |
| JavaScript unit/integration tests (`npm run check`) | 354 passed; production build passed |
| Python hardware-reader/worker/installer tests | 90 passed, including isolated installer and systemd unit checks |
| Focused Chromium power flows | 17 passed on the final runtime |
| Full Chromium regression journeys | 183 passed (18.7 minutes) |
| Production/offline journeys | 13 passed (1.7 minutes), including first-visit lazy screens, settings/wizards and cached startup media |
| Native WebKit power flows and wall regression | 27 passed (2.6 minutes): 17 power flows plus 10 wall journeys |
| Production dependency audit | 0 vulnerabilities (`npm audit --omit=dev`) |

All configured Chromium journeys were run; the WebKit run covered the affected power panel and shared wall journeys rather than claiming the entire Chromium suite was repeated in WebKit. WebKit 2370 executed with its official Debian runtime libraries already available in the workspace. `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1` skipped the host package-inventory probe, not browser execution or assertions. Native and small-preview screenshots were retained for both browsers. The application was not edited during these acceptance runs.

The unsigned review archive is assembled separately from approved baseline blobs plus the scoped patch, with an exact zero-fuzz patch replay. Unrelated local enclosure CSV work is preserved and excluded. Archive inventory, every packaged source hash, the exact tested production assets, unchanged startup media and the pinned public-key fingerprint are checked independently. This local artifact is neither a signed OTA nor a published release; the configured Verify/signing pipeline still has to pass after the owner's publication approval.

## Performance and security scope

The main production JavaScript bundle is approximately 731 kB versus 717 kB in the signed baseline (about +2%; same-tool gzip comparison about +1.3%). No dependency was added. Vite's pre-existing large-chunk warning remains; this size comparison does not measure Pi latency, CPU, memory, rail stability or output wattage.

New command validation accepts only the documented numeric current targets at a fixed 20 V. Existing mutation serialization, audio/update gates, bounded confirmation nonce, durable interrupted-request record and the two literal register writes remain in force. An offered profile change invalidates the confirmed target instead of silently requesting a different current. Legacy 100 W qualification remains strict. No private key, network credential, output route, group control, DSP setting or INA228 wiring confirmation changes. The production dependency audit is clean; the previously documented development-only dependency advisory was not represented as resolved by this power patch.

## Physical acceptance remains open

After separate publication approval and installation, the owner must initiate setup and confirm the real contract changes from 25 W to the offered 60 W. Optional startup repetition must then be observed on a normal restart; it is not enabled by installing the update. A changed offer or interrupted request requires manual recovery and never queues a retry loop. The already unresolved Pi/display power interruption was not provoked or declared fixed.

INA228 consumption remains unavailable until its VBUS sense connection is physically corrected and confirmed. Near-zero VBUS samples from the owner are not used to infer or invent a rail voltage. No live I2C request, real amplifier-load test or physical continuity test was performed here.
