# Initial GUI 3.8.3 PD QUERY validation

**Historical PD-only snapshot, superseded for release acceptance by [the expanded usability validation](usability-validation.md).** These results do not cover later usability/cursor changes.

Local-only candidate based on published `2cdb40149c52a3fcb7301ee229cf22d9aaf6ca9b`. No live I2C device was opened, no Pi request was made and no source/OTA was pushed for this candidate. Checks below ran on 18 November 2026 in the Linux execution environment, not the Pi.

The regression scope covers the actual HUSB238 byte decoder, the three fixed allowed writes, explicit source discovery, maximum/exact/strict-100 W policies, cable authorization, actual contract readback, durable query/request interruption handling, same-boot player proof, fresh job nonces, audio/update serialization, compatibility, sensor-wiring separation and owned dialog behavior at 1280×800 and the 1280×400 development preview.

Synthetic 100 W source/contract results are labeled test fixtures. They are not observations of the owner's disconnected hardware. The original bytes still mean 25 W active and 60 W offered.

Physical acceptance remains unobserved: source-capability reply/5 A offer, actual verified 60/100 W transition, warm restart/boot behavior, sustained supply stability and INA228 VBUS wiring.

## Completed local checks

| Check | Result |
| --- | --- |
| Complete Node unit suite | 363 passed. |
| Complete Python suite | 105 passed, including the new query/maximum-policy fixtures. The expanded installer cases also passed a final focused rerun. |
| Chromium journeys | All 188 collected cases covered: 72 passed initially, the one failing startup-video case passed on the same source in isolation, then the remaining 115 passed. This was not one uninterrupted green run. |
| Native WebKit on the compiled production build | All 22 power journeys plus 10 wall journeys covered successfully, with the harness corrections described below. |
| Standard production/offline suite | 13 passed, including real service-worker reloads, deferred settings, media ranges and offline recovery. |
| Build, SSR, shell/module syntax | Passed, including a final production build and power-card render check. |
| Production dependency audit | 0 vulnerabilities reported. No dependency changes. |

The first Chromium attempt hit the existing startup-video test's five-second wait for dismissal after playback resumed. The same unchanged test passed on a focused rerun; no startup media or playback code was changed. The other 115 cases were then run to completion rather than treating the stopped suite as passed. Runtime sources stayed frozen throughout these acceptance runs.

WebKit used the actual installed WebKit 2370 engine and existing official Debian shared libraries in a local library path. Its host-library inventory check needed an explicit skip; the native browser did run. A separate port, simulator state and output directory prevented shared-state interference with Chromium. Production service workers were blocked only in this API-mocking harness so `page.route` could own the device fixtures; real service-worker behavior was checked separately in the standard offline suite. A relative test-media path initially pointed at the notes directory; linking the unchanged project public-media directory resolved it. After these harness corrections, 27 cases passed and the remaining five wall cases passed. No application source was changed for these corrections.

The query regressions cover a deliberately synthetic 60→100 W source refresh, unchanged 60 W, no response, rejection, changed voltage/offer, two stable readings, forbidden reset/voltage writes, interrupted-query startup backoff, single-use jobs, cable-dependent maximum startup transitions, legacy exact/100 W behavior and preservation of unconfirmed INA228 wiring. Browser checks cover pending/disallow-duplicate states, cancellation, cached versus newer source data, main Save semantics and reachable dialog actions at both tested sizes.

The local bundle comparison against 3.8.2 shows approximately 0.88% main JavaScript growth and 0.70% growth using the same gzip method. Settings-chunk size is unchanged. These are build-size comparisons, not Pi CPU, latency or power measurements.

## Review packaging

The isolated review tree is assembled from the exact published base plus the scoped patch. The owner's unrelated `docs/design/wall-mount-centres.csv` edit stays in the workspace and is excluded from this release. Missing local reference JPGs are retained in the expected Git tree, not deleted. The local review receipt separately records exact patch replay, complete archive hashes/inventory, source/frontend matching, unchanged startup media and continuity of the existing public signing key. The review archive is unsigned; this does not replace the approved Verify/signing publication pipeline.
