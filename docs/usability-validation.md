# GUI 3.8.3 expanded candidate validation

This is the current acceptance record for `2026.11.18-pd-query.1` / GUI 3.8.3 PD QUERY, cache 48, based on published `2cdb40149c52a3fcb7301ee229cf22d9aaf6ca9b`. It supersedes the initial [PD-only snapshot](pd-source-query-validation.md). The owner approved the scoped review branch, required checks, merge and signed preview publication on 19 November 2026. Availability still depends on successful Verify and signing.

The final runtime is frozen during acceptance. Tests run in the Linux execution environment, not on the owner's Pi. No live I2C access, PD request, voltage change, sensor-wiring confirmation or speaker measurement was performed. A synthetic 100 W fixture does not establish a 5 A offer on the actual supply. The retained raw bytes still mean 25 W agreed and 60 W offered.

## Current results

| Check | Result |
| --- | --- |
| Complete Node suite and production build | 366 tests passed; build passed. |
| Complete Python suite | 109 tests passed, including native Xcursor loading, private-umask permissions, idempotent kiosk migration and PD interruption/proof guards. |
| Targeted Chromium setup/timing/usability | All 25 power journeys plus four timing and five usability journeys passed after the corrections below. |
| Full Chromium regression | All 196 collected cases covered and passed across the recorded runs below; four existing test preconditions/locations/wording were corrected. This was not one uninterrupted local green run. |
| Native WebKit against the compiled production build | All 40 journeys passed in one run: 25 power, five usability and 10 wall journeys. |
| Standard production/offline suite | All 13 passed at the original production origin with real service workers, including deferred settings/wizards, media ranges, wake and YouTube referrer behavior. |
| Production dependency audit | Zero reported vulnerabilities; dependencies unchanged. |
| Shell/module syntax and locale inspection | Passed. Both locales contain the same 1,851 keys; new literal setup messages have Dutch translations. |
| Candidate and public package verification | Local exact-source patch/archive validation is required. Public signing, complete inventory, approved source, reproduced frontend and channel selection are independently checked after the pipeline publishes. |

The complete collection was compared with passed test identities from each run: 90 initial passes, 28 subsequent passes, 37 subsequent passes, three corrected startup cases, 30 final UI cases and all 12 YouTube cases. Four of these executions repeat already-passed cases; no collected case remains uncovered. GitHub Verify must still run the complete current suite before merge and signed publication.

The new journeys verify plain English/Dutch restart copy, sensor versus engineering controls, protected drafts when changing Developer topics, slow/failed sound requests, temporary Wi-Fi waiting and QR recovery, debug waiting and the update page's initial cursor boundary with JavaScript disabled. Power journeys retain readback, cancellation, incompatible-helper, stale-reading, cable-consent and main-Save checks at 1280×800 and 1280×400. Native screenshots of both power-dialog sizes were inspected; the compact dialog keeps actions available while its body scrolls.

## Corrections during validation

A targeted browser run caught the Developer topic bar inheriting the old narrow navigation width, causing buttons to overlap. Its scoped layout now resets position/width and provides a four-column topic grid. The complete 25-case power run then passed. Existing sync test selectors were updated to the new Developer location; the four sync and five new usability cases passed together. Old SSR/cursor tests were updated for the deliberately separated beginner/advanced view and valid 24-pixel transparent image. These changes happened before final runtime freeze. A later broad run found one existing Updates test still looking for the old embedded Developer tabs; it now follows the shared Updates page back to Developer and keeps the same unsaved-draft/save assertions. An existing PCM test timed out once before observing the delivered playback state, then all five performance cases passed on an unchanged rerun. The test now explicitly waits for the Pause button before starting its original 1,500 ms lease-resumption check; the count and time budget are unchanged. The replay/diagnostics test also needed to save its playback preference and navigate to the new Developer → Startup location. The YouTube account test now asserts the requested plain-language privacy explanation, while retaining its account hand-off, no-password-input and consent assertions. These four corrections change test preconditions, navigation or expected wording only; application runtime remained frozen.

WebKit used native WebKit 2370 with official Debian libraries in a local library path. Only the host package-inventory check was skipped; the actual engine launched and ran. It served the frozen production build on an independent port and simulator state. Service workers were blocked only in this API-mocking harness so the routes own their fixtures. Real service-worker behavior is tested separately by the standard offline suite.

An attempted parallel offline harness was stopped after identifying tests with a fixed production origin. Its partial result is not counted as acceptance; the standard unmodified-origin suite is required instead.

## Size and scope

Compared with the accepted 3.8.2 build, the main JavaScript grows 3.15% uncompressed and 2.74% using the same gzip method. The deferred settings chunk grows 7.66% uncompressed and 6.83% compressed. Total JavaScript grows 3.01%. These are build-size measurements; no Pi CPU, touch latency, memory pressure, frame rate, temperature or power figure is claimed.

Source packaging uses the exact published tree plus the scoped changes. The owner's unrelated enclosure CSV and untracked drawings stay untouched and outside this update. Six reference JPGs absent locally remain in the Git tree. Package verification checks complete inventory/hash matching, compiled-source alignment, unchanged startup media and the existing public-key fingerprint. No private key is read or replaced. Signed publication must independently verify the real public signature, full inventory, approved source, reproducible frontend and channel selection.

## Remaining device acceptance

After installation, check a real cold start and manual OTA for cursor flashes, Settings/Wi-Fi responsiveness, progress/error recovery, drafts and touch wake. Check actual offered/verified power only through an owner-initiated setup with the supply already at 20 V, and confirm sustained stability separately. The actual reason for a 3 A offer remains unresolved. INA228 consumption remains unavailable until real VBUS sense is connected and verified. No software checkbox or test fixture substitutes for these observations.
