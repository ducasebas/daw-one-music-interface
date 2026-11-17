# GUI 3.8.0 POWER candidate validation

Local candidate based on published GUI 3.7.1 DSP commit `99a60d9139cdda2ddefe54ac8054ea3344202706`. The owner approved the reviewed update on 17 November 2026 with “Zodra je klaar bent mag je de Ota pushen”: this includes the review branch, CI fixes in scope and conditional signed OTA publication after checks pass. Keep fixture, CI and physical observations distinct.

## Coverage

`tests/power_reader_test.py`: literal INA228 vectors, both ADC ranges, signed/zero current, identity, conversion/memory/saturation/configuration faults, unconfirmed wiring, all PD voltage/current codes, autonomous startup, active versus offered profiles, detached/reserved/changing status, independent board/close failures, bounded settings and atomic JSON permissions. The native call fixture checks the single pointer byte and read transfer, and rejects GO/calibration/other-device access. No physical device is accessed.

`tests/power-telemetry.test.js`: recomputed powers, stale/future/invalid data, independent failures, profiles, reversed current, voltage mismatch, legacy compatibility, host sampler, notification routes, bounded regular-file reads and fixed command/service handling with rollback.

`tests/power-render.test.js`: actual React rendering of consumption, contract and profiles; zero versus unavailable; expiry/offline state; English/Dutch labels. This is not a screenshot or touch test.

Five Playwright journeys in `tests/browser/power-monitoring.spec.js` cover staged edits, Save/Cancel/defaults, failed activation, hardware-notification navigation, 1280×800 layout, expiry and optional home metrics. The existing sensor-count assertion includes the three new metrics.

## Local results and limits

| Check | Result |
| --- | --- |
| Complete Python suite | 54 tests passed, including 17 power-reader tests. |
| New backend/manager tests | 15 cases passed. |
| New React rendering fixture | Passed, including English/Dutch, offline/expiry, legacy source labels and initial connection state. |
| Related JS run | All six selected test files passed: power backend/render, interface, wall, settings and touch/translation. |
| Complete local Node run | 46 files passed; 12 did not complete successfully (11 EPERM restrictions and one local-server fixture timeout). Not an all-green suite. |
| Production build | Passed; main JS 702.11 kB / gzip 214.84 kB, +2.7% / +2.4% against the accepted baseline. |
| Browser journeys | Could not start in this sandbox; pending GitHub CI. |
| Fresh dependency audit | Blocked by network EPERM; no new dependencies or lockfile changes. |

The final browser fixtures also reject an unnecessary clock-setting command when saving only sensor settings. This regression remains part of the blocked interactive checks.

The complete Node suite encounters sandbox `EPERM` for child compilation and HTTP/Unix-socket tests. Playwright cannot connect/start its server (`connect EPERM 127.0.0.1:5173`); a separate Chromium smoke attempt also fails native socket setup with `Operation not permitted`. Interactive journeys, production/offline browser checks and screenshots are therefore **not passed locally**. On the approved review branch, existing CI runs Node 22/24, Python, production build, audit, Chromium and offline checks. Publication must wait for these checks.

The accepted main-JS baseline is 683.85 kB / gzip 209.87 kB; the final increase remains within the development workflow’s 10% investigation threshold. No pip/npm dependency, animation loop or frontend power-polling interval is added. This does not measure physical Pi CPU, memory or touch latency.

## Remaining device checks

- Confirm high-side VBUS wiring; the owner does not know whether the default-open jumper is bridged.
- Install an approved signed complete-device candidate; check account/bus permissions, enable/disable and persistence after a normal reboot.
- Read both real boards and compare plausible voltage/current during normal listening, without a stress test.
- Check the negotiated contract separately from offered profiles and printed supply wattage.
- Check Save/Cancel/defaults, home widgets, notifications and continuing music/existing sensors on the actual touchscreen.
- Test disconnect recovery only during a planned, powered-off wiring change when appropriate. No live-supply removal or renegotiation test is included.

The whole-device interruption remains unresolved. No new fan/thermal protection, automatic power limiter or independent power-good circuit is implemented.
