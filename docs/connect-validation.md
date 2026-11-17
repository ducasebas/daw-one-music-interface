# GUI 3.6.0 CONNECT — review candidate

Candidate `2026.11.15-connect.1`, shell cache v41. Published baseline GUI 3.5.0 at `c6265f54125cd5547bf2649c09eaf06eee6b58da`. The owner approved this reviewed candidate on 16 November 2026. It was published to preview at merge commit `cbb7a7e64a78cfb96dad9d07953e05e969d7edaf` after successful Verify/signing workflows; public signature, complete inventory, runtime-source correspondence and channel selection were independently checked. Physical Pi acceptance remains separate. Later local work requires new approval.

## Changes to review

- Larger header symbols, 336 px main artwork and 300 px artwork beside the visualizer on the 1280×800 panel. The small legacy viewport also contains its loading state.
- Debounced Music Assistant suggestions are visible inside the touch keyboard and stale responses are discarded. Track suggestions start playback; album/artist/playlist suggestions open their contents. More provider filters and server-acknowledged favorites use registered catalogue IDs, not browser-supplied provider URLs.
- Existing YouTube Music wizard and silent official embed, with source checks, explicit consent, pause/seek/track handling, full screen and manual timing. Google account credentials remain in Music Assistant. See [YouTube behavior and limits](youtube-music.md).
- Optional phone-to-TuneBox A2DP receiver, confirmed code pairing, muted source entry, independent Louder gain ceiling, source-session guards, group isolation and restoration journal. It does not relay phone audio to MA multiroom or provide a Squeezelite PCM spectrum for Bluetooth.
- USB calibration imports, actual sweep correlation/completeness, flat baseline, current-DSP verification, bounded target application/undo and raw capture cleanup. No mic, simulated curves or calibrated acoustic SPL are invented.
- Host/origin protection, endpoint-scoped MA credentials, isolated manager group, exclusive root temporary files, updater/audio-entry lock, archive bounds and pinned CI actions. See [security review](security-review-2026-11-15.md).

## Local validation

The complete 160-case Chromium inventory has been exercised. Targeted reruns corrected a loader-size defect and test assumptions around lazy development chunks, a live SSE connection and fixture teardown; the corresponding cases passed. Production offline loading is a separate check, because the development asset server does not provide the production service-worker cache.

| Check | Result | Scope |
| --- | --- | --- |
| Node 24 tests and production build | 260 passed; build passed | Runtime/API, credentials/origins, root lock and permissions, Bluetooth peer/gain rules, real PCM/calibration quality and recovery |
| Python | 32 passed | Browser policies, host boot/config, archive bounds and pairing-window/peer validation |
| Chromium | All 160 unique scenarios passed, including targeted reruns | Existing UI and new functions, legacy/wall sizes, setup, shared audio, network, settings, startup, update progress and recovery |
| WebKit | All 52 selected unique scenarios passed, including the one-step touch-quantization rerun | New functions, volume, grouping, performance/state handling, wall layout and YouTube |
| Production/offline | 12 passed | NODE_ENV=production with CSP, lazy first-use offline screens, actual local-media decoding, animated splash and YouTube frame referrer |
| Dependency audit | Zero known advisories including dev dependencies | Existing lockfile; OS packages are separate |
| Controlled production comparison | Lower script work and fewer shell renders/HTTP reads | [Fresh before/after evidence](gui-performance.md); simulator, not a Pi |

The one WebKit scaled-touch check permits one percentage step of pixel quantization; it continues to reject a large volume jump. A Chromium setup-fixture teardown race was fixed by waiting for intercepted responses before disposing the page. No actual product error was hidden by retries. Earlier component evidence remains in [YouTube validation](youtube-validation.md).

The main entry is approximately 641 kB (about 8.8% below the 703 kB published baseline). Typical measured navigation feedback in the controlled recording fell from 114 to 55 ms; an isolated idle stall remains recorded, so no worst-case Pi latency claim is made. Node 22 and the full release CI matrix remain GitHub checks, not locally executed results.

## Physical acceptance remains open

No Raspberry Pi, phone/BlueZ audio stream, owner's Google account or USB measurement microphone is connected to this workspace. Browser mocks establish UI and command behavior; PCM fixtures establish relative signal-analysis behavior. They do not certify these physical/service paths.

After explicit approval of a test OTA: verify normal touch/navigation/volume, group independence, standby/touch/button wake, network recovery, Google/MA source initialization, decoding/sync and resource use on the Pi. Install Bluetooth or measurement support only after the local Louder output is verified; normal application OTA does not install these packages or run an audible test. Keep the power arrangement stable.

For microphone acceptance use a serial-calibrated USB reference such as UMIK-1, at ear height with its matching orientation file. Compare a flat baseline with current-DSP verification and listen at matched level. The user has no USB mic yet. The [microphone guide](room-measurement.md) records the recommendation and unverified Amazon availability.

Rivo stopping when TuneBox is switched off remains deferred by the owner. Automatic visualizer latency measurement is not implemented: the common screen delay/trim remains manual, and USB sweep capture delay is not treated as Squeezelite output latency. Speaker RMS/impedance provide conservative controls, not a calibrated watt limiter. The unresolved power interruption is not certified fixed by any GUI test.
