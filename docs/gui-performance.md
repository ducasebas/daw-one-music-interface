# GUI 3.6.0 — local performance candidate

Current candidate `2026.11.15-connect.1`, based on published GUI 3.5.0 (`c6265f54125cd5547bf2649c09eaf06eee6b58da`). The controlled comparison below measured the earlier `2026.11.14-speed.1` build before adding YouTube. The owner requested a GitHub review update; publishing OTA or installing this candidate still requires approval. The expanded candidate also adds header/artwork changes, suggestions, favorites and optional Bluetooth/measurement support; see [CONNECT validation](connect-validation.md).

## Performance changes

- The seek control owns its playback clock; menus/artwork no longer render four times a second for it.
- Healthy live snapshots suppress duplicate HTTP polling. Bounded fallback rejects stale HTTP results and handles unavailable/stalled streams. Local watchdogs and update polling windows use a monotonic clock across system-time changes.
- Unchanged update responses retain a stable context. Configured idle polling is less frequent; explicit actions and active update phases retain fast polling.
- Wall navigation retains content animations without full-screen View Transition captures.
- Settings, setup and the test bench load separately. The service worker precaches their built assets for never-visited offline screens and retains one prior shell cache for already-open clients. Parsing/execution is deferred; the offline cache still downloads those chunks in the background.
- Paused local meters stop renewing PCM-analysis leases. A paused selected remote room cannot suspend local PCM that is still playing.
- A ready interface has an eight-second overall branding deadline for stalled media. It does not change hardware/audio readiness or skip an unfinished setup wizard.

## Controlled comparison

One production Chromium recording per version at 1280×800 with 4× CPU throttling, controlled simulated playback and a configured-manager response. Splash/warm-up completed before ten-second idle/playing windows. These are browser measurements, not Pi latency, watts, temperature or physical synchronization measurements.

| Observation | Published 3.5.0 | Local 3.6.0 |
| --- | ---: | ---: |
| Whole-shell renders, paused / 10 s | 58 | 2 |
| Whole-shell renders, playing / 10 s | 79 | 22 |
| Redundant HTTP state requests / 10 s | 7 | 0 |
| Idle update requests / 10 s | 9 | 4 |
| Instrumented idle script work / 10 s | 457 ms | 97 ms |
| Instrumented playing script work / 10 s | 586 ms | 288 ms |
| Navigation-state feedback, median of eight actions | 114 ms | 40 ms |
| Initially executed app bundle | 703 kB | 598 kB |

Navigation feedback runs from pointer-down to two animation frames after the state change; it is not full-panel loading time or formal INP. Instrumentation and the shared host affect absolute timings. No cold-paint improvement or memory/endurance result is claimed. Raw recordings: [baseline](performance/gui-3.5.0-baseline.json) and [candidate](performance/gui-3.6.0-candidate.json).

For a comparable local production simulator, build/start it on a separate port with a temporary DAW_STATE_DIR. Run `TUNEBOX_BENCH_URL=http://127.0.0.1:3119 npm run measure:gui -- candidate`. The command checks for a local simulator before controlling playback. Recordings go to ignored `performance-results/`. Do not run browser suites during measurement. Playwright Chromium or TUNEBOX_CHROMIUM_PATH is required.

## Owner feedback included

- Relative volume pickup requires a drag. Tapping rail/dial sends no volume change. Wall +/- buttons are larger; optional gentle sensitivity reduces drag gain.
- Visible live dBFS readouts are removed. Frequency labels use HTML outside the stretched SVG.
- Black standby explicitly turns off only the backlight; touch stays enabled. Physical-button wake requests Now Playing, preserving the normal unsaved-settings guard.
- Optional Speakers appears in First Start and Audio & DSP. Impedance/RMS are recorded; the digital control ceiling does not establish calibrated watt protection or change current playback volume.
- Warm DSP cuts upper bands without positive boost. First setup initializes neutral EQ and preserves custom curves. Missing/unavailable DSP cannot trap the user in setup. Actual HAT application still needs confirmation.
- Speaker metadata stays in the same atomic preference file, inside the existing presentation payload. The actual published 3.5.0 reader accepted the new file without reverting recognized settings to defaults. Older versions do not expose speaker fields.

## Validation and open work

The YouTube addition and latest candidate checks are recorded in [YouTube validation](youtube-validation.md). Its final application entry is about 621 kB uncompressed, versus 703 kB in the published baseline and 598 kB before the YouTube addition. The new player and wizard remain separate chunks. These size changes do not establish real YouTube decoding load or Pi responsiveness.

The current software suite passed 233 Node tests and the build. Unchanged installer/helper tests passed 28 Python cases. Twenty-five targeted Chromium cases passed for audio, volume, setup and shell behavior; 22 additional DSP/rooms/sync/update cases passed. Three later shell/startup checks passed, including the new stalled-media case. Ten production/offline cases passed before the localized startup/clock/storage refinements; the final first-use offline-settings and real-video byte-range/decode cases both passed again afterward.

WebKit initially passed seven of eight cases. Slow media retries blocked the remaining audio journey; after the overall presentation deadline, that journey and a new stalled-media case both passed. This records focused reruns, not a complete final browser-matrix run.

The owner has explicitly deferred the report that switching off TuneBox in Overal also stops Rivo. It is not marked fixed, and the YouTube work does not change group leadership or shutdown. Real Pi/Rivo acceptance remains separate from browser fixtures. Publication still requires the owner's explicit approval of this candidate.

Local MP4/WebM timing remains available. The local candidate now also includes the [YouTube Music wizard and embedded player](youtube-music.md), with explicit consent, exact provider-ID matching and bounded seek correction. Its player and wizard load separately; YouTube has no background provider poll outside setup. The original performance measurements above precede this addition and are labelled accordingly. A verified automatic visualizer-latency estimate remains separate work. No guessed correction or calibrated watt protection has been enabled. See [the development workflow](development-workflow.md).


## CONNECT final comparison (15 November 2026)

A fresh sequential production Chromium comparison used the same simulator, viewport and 4× CPU throttle for published 3.5.0 and `2026.11.15-connect.1`. No browser acceptance suite ran concurrently. Raw records: [published baseline](performance/gui-3.6.0-connect-baseline.json), [CONNECT](performance/gui-3.6.0-connect-connect.json).

| Observation | Published 3.5.0 | CONNECT |
| --- | ---: | ---: |
| Whole-shell renders, paused / 10 s | 59 | 2 |
| Whole-shell renders, playing / 10 s | 73 | 22 |
| Redundant HTTP state requests / 10 s | 6 | 0 |
| Update reads, paused / 10 s | 10 | 4 |
| Script work, paused / 10 s | 459 ms | 140 ms |
| Script work, playing / 10 s | 750 ms | 321 ms |
| Navigation-state feedback, median / eight actions | 114 ms | 55 ms |
| Main application bundle | 703 kB | 641 kB |

The frame P95 was about 16.7 ms in both recordings. CONNECT had one 467 ms idle outlier and no long task in its playing window; the baseline had one long task during playing. Average work improved, but these short recordings do not establish a worst-case latency guarantee. Inspect stalls and memory during longer normal use on the Pi before production acceptance. This recording contains simulated playback, not a live YouTube/BT decoder or physical PCM capture.
