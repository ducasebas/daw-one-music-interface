# FLOW validation

Local candidate only. Publication and physical Pi acceptance are separate; the owner approved publication on 26 November 2026, including the header refinement. Required GitHub checks and signed publication are pending.

## Evidence retained locally

The comparison starts from published main `6ecd80f3ad5d511ba501863443532bd6b834929f` (GUI 3.16.6). Cloud browser runs use 1280×800 and the retained 1280×400 compatibility journeys. They use simulated/fixture audio, not real loudspeakers, a Pi or a real reboot.

- Full local JavaScript suite: **544 passed**, plus a successful production build.
- Existing Python hardware/installer suite: **137 passed**.
- Broader Chromium journeys: **84 passed**. Covers all skins, routes, first-start recovery, room changes, volume, long names, playback recovery, visualizers, header/widget layout, offline state fallback, seek, sleep/wake, startup fallback and power confirmation.
- WebKit: **24 passed**, covering FLOW, playback recovery and the existing volume journeys.
- Final affected-flow reruns: **14 Chromium and 14 WebKit passed** after clock caching, the explicit seek appearance/fractional-duration clamp, the live-station timer limit and authoritative restart countdown. An additional **22 Chromium** cases covered all settings skins, saving, scrolling, no text selection, media sizes and source wake behavior.
- Built production/offline journeys: **16 passed**, including real phone naming/pairing/revocation, phone playback, never-visited lazy settings/wizards, cached reloads, byte ranges and offline WebP playback.
- Final focused JavaScript/privacy/remote HTTP receipt: **30 passed**. Local runtime: Node **24.19.0**.
- Production dependency audit: **0 reported vulnerabilities**.

Early browser runs caught a compact-layout overflow, a missing return in the new recovery dialog and a startup-to-dialog measurement race. Those were fixed; the broader runs above passed. Audio fixtures were updated to accept the additional levels-only lease query. Remote HTTP checks now verify that a phone can rename itself, cannot supply another phone id and cannot reach device settings. Production testing also caught the settings phone list retaining its old name; it now refreshes on the same safe revision signal as Party mode. The production journeys complete the new naming step and verify the visible name.

## Approved header refinement, 26 November

The fixed and collapsing wall headers are transparent and 96 px high, with 36 px symbols and 80 px navigation targets. Settings retain the compact header. No backdrop blur was added. Artwork, metadata and the visualizer use three columns. The graph retains 512 px width and at least 250 px height while its controls and the floating widgets stay visible.

The JavaScript suite passed again (**544**), followed by a successful production build. The shared FLOW/header/widget journeys passed **19 WebKit** cases. The Chromium shared-shell run passed **30 cases**; its six-mode rest journey exceeded the overall 30-second test deadline during concurrent browser/build work. That journey subsequently passed in **28 seconds**, with all save/reload/wake assertions retained. Its overall deadline is now 60 seconds; individual assertion deadlines are unchanged.

Final header checks passed **four Chromium and four WebKit** cases, covering both languages, all six skins, fixed/collapsing headers, top/bottom widget positions, spectrum/meters, optional video controls and stationary content during header hiding. The Chromium final run also included the passing rest-mode journey (**five cases total**). Screenshot inspection confirmed that the visualizer controls are no longer clipped. The existing production/offline checks above are retained; the complete GitHub workflow will rebuild and check this exact candidate before publication.

The first review CI run (45776601406) passed both Node versions and production/offline + WebKit, but caught a graph-height regression and unnecessary React commits from the new smooth playhead. The layout now gives the visualizer its own full-height column; the playhead paints only the native range and elapsed label. The original minimum graph size and bounded-render assertions are retained. An older outage test also tried to click the page behind the new modal; it now verifies and closes the owned recovery dialog while retaining all local-pause, no-volume and no-command checks. A focused Chromium rerun passed all ten affected cases, and 13 WebKit journeys passed. The final playhead also stops its frame/timer work during startup and screen rest, then catches up on wake. Five further Chromium and three WebKit cases passed for seeking, live stations, resting/waking, the recovery dialog and the original render-budget guard. A final focused JavaScript/privacy run passed 36 cases, followed by a successful production build. The subsequent review run (45778303483) also exposed the existing greater-than-500-pixel spectrum-width guard. That guard is retained: the column is now 512 px wide with 20 px gaps, while the 300 px artwork and readable metadata rows remain. Four Chromium and three WebKit layout/touch cases passed after this final width adjustment. Final review/main results remain pending.

## Maintenance path

The signed pipeline exports the project public key before packaging. The local comparison includes that same public key, checked against its existing SHA-256 SPKI fingerprint; no private key was used. Comparing a local source bundle without that generated public file would misleadingly classify its removal as a system change.

With matching packaging, the actual old/new inventory comparison selects **`update-tools`**, with seven changed host paths: `deploy/install-ota.sh`, `deploy/manager/progress.html`, `deploy/ota/appliance.mjs`, `deploy/ota/maintenance.mjs`, `deploy/ota/post-update.mjs`, `deploy/update-appliance.sh`, and `server/update-status.js`. The complete display/network/audio refresh remains unnecessary. Regression tests exercise the repair through the previous updater's compatibility bridge as well as the new updater.

The post-update helper is tested with injected I/O and a stub command runner. No real `systemctl reboot`, PD request, gain adjustment or physical audio test was performed. It requires a successful updater outcome, committed exact build, healthy backend, painted UI acknowledgement, idle playback and no pending request/journal. A failed/rolled-back install, unacknowledged warning, interrupted helper, changed slot or busy device cannot loop into an automatic reboot. Public restart progress expires to a manual restart notice if its helper disappears.

## Performance measurements

Results are cloud comparisons, not Pi performance claims. The meter-only analyser preserves the same RMS/peak/clipping values and skips both FFTs. A synthetic 48 kHz, 4096-frame stereo benchmark (five batches of 300 windows) measured median **90.68 ms with FFT** versus **9.85 ms for levels only**. This measures analysis work only, not total CPU, audible latency or power use.

The recorded GUI observation, before the final CI playhead correction, uses a working SSE proxy, Chromium with `--disable-gpu`, a 4-second warm-up and a 10-second paused observation. Earlier measurements with a non-streaming interception or concurrent builds are excluded from the comparison.

| Observation | Published baseline | FLOW candidate |
| --- | ---: | ---: |
| Main-thread task time in 10 s | 43.34 ms | 52.16 ms |
| Script time in 10 s | 32.11 ms | 39.15 ms |
| Retained JS heap after explicit GC | 6,469,188 bytes | 6,632,484 bytes |
| API requests during observation | 3 | 3 |
| Largest main JS entry, uncompressed | 666,828 bytes | 685,851 bytes |

The initial extra clock formatting was investigated and replaced by bounded formatter reuse and a memoized header clock. The remaining task-time difference is about 9 ms over 10 seconds with the extra UI; this short observation does not establish a sustained CPU regression or a speed gain. Retained JS heap rises about 2.5% and the largest entry about 2.9%, with no extra polling. The existing chunk-size advisory remains; its limit was not raised. The final corrected main entry is 686,900 bytes (about 3.0% above the baseline); the recorded timing/heap comparison above predates that small final correction. Browser regressions check bounded shell renders, analysis demand and hidden-work cleanup. Live stations without a seekable duration update elapsed time once per second instead of animating an unusable bar. Real Pi response, total process memory and long-run listening remain acceptance work.

## Remaining acceptance

GitHub CI and signed publication are required for this approved candidate; their results will be recorded after they finish. Physical touch response, uninterrupted listening during visualizer changes, song-radio provider compatibility, named phones on the home network and one ordinary OTA/reboot must still be confirmed on the Pi after publication approval. The unresolved earlier power/reset issue was not reproduced. The temporary appliance-maintenance opt-out and amplifier gain changes have not been confirmed on the device; no hardware state is invented here.
