# YouTube component — earlier local validation

Candidate: `2026.11.15-youtube.1` · GUI 3.6.0 YOUTUBE · shell cache v40. Published baseline: GUI 3.5.0, commit `c6265f54125cd5547bf2649c09eaf06eee6b58da`. These results describe the earlier YOUTUBE component candidate. It is now part of `2026.11.15-connect.1`; see [the current validation record](connect-validation.md) for the complete review candidate. No OTA publication or Pi deployment is authorized by these results.

## Passed software checks

| Check | Result | Scope |
| --- | --- | --- |
| Node 24 unit/integration suite | 241 passed | Existing runtime plus source-state sanitization, consent, origin/PIN/nonce protection, exact video mappings, stale revisions and track guards |
| Production build | Passed | Lazy player/wizard chunks and offline asset inventory |
| Chromium regressions | 44 passed | Setup, network, PIN, settings, shared timing, local video, appliance browser behavior and bounded state/render activity |
| Final Chromium YouTube suite | 12 passed | Account handoff, unavailable Premium/source, consent, mute, pause/seek, full screen, track changes, offscreen pause, delayed API/metadata, activation, standby and owned errors |
| WebKit YouTube suite | 12 passed | Same YouTube journeys in a second browser engine |
| Production/offline suite | 12 passed | Offline first-use lazy screens, real local-video decoding/ranges, animated splash, never-visited YouTube setup and the actual frame request referrer |

The broader 44-case run preceded the final changes confined to YouTube player readiness, metadata handling and visibility. The final player suite and production/offline run covered those refinements. A final small frame-reveal guard keeps the iframe hidden until its API is ready, preventing a native frame-loading page from showing; the delayed-ready journey separately checks this guard. Earlier volume and multiroom suites also passed; their results are not a certification of physical Rivo shutdown behavior. This is not a claim that the complete release browser matrix or Node 22 CI has run for this candidate.

The player tests use a controlled IFrame API fixture, not the owner's Google account or Google's live ad/media servers. The Music Assistant account tests use controlled provider responses. This establishes application behavior and command isolation, not live service availability, Premium billing status, audible mute, decoding speed or acoustic synchronization on a Raspberry Pi.

## Performance and privacy

The current application entry is approximately 621 kB uncompressed. The published baseline was 703 kB; the performance-only intermediate candidate was 598 kB. This is about 11.7% below the published baseline and 3.7% above the intermediate candidate. Additional YouTube code and styles load separately. No new idle provider poll is added to the shell. Static chunks are precached; APIs and external YouTube resources are not cached by TuneBox's worker.

The original controlled CPU/navigation measurements remain in [GUI performance](gui-performance.md), labelled with their measured build. They must not be presented as measurements of live YouTube playback or the owner's Pi.

Google cookies and passwords stay in Music Assistant. The wizard hands setup to its existing interface and reads sanitized source availability. It cannot independently certify Google's paid subscription status. The reviewed Music Assistant provider validates Premium while initializing; TuneBox displays only whether Music Assistant accepted the source.

## Owner test after an approved preview OTA

Verify the actual account connection and playlist import; play a known recording on TuneBox; check silent video, pause, seek, track changes and full screen; adjust the per-video offset and common screen delay; check standby/touch/button wake and CPU/temperature during normal listening. Keep the power arrangement stable during this test.

The owner has deferred Rivo stopping when TuneBox is switched off. It is not fixed by this update. Automatic visualizer-latency calibration is also not implemented; the existing common delay and fine adjustment remain manual. Speaker settings provide a digital control ceiling, not a calibrated amplifier watt limiter.

The full release Verify/signing checks and explicit owner publication approval remain separate from these local checks. Hardware acceptance follows an explicitly approved test deployment.
