# GUI 3.16.3: interface amendment validation

Prepared on 23 November 2026 on `codex/3.16.3-smooth`, based on the complete SAFE UPDATE hotfix at `2bd52c3aa2bc0150c38848cadba20390e0b6a80d`. At source discovery, `main` and the latest signed preview were still GUI 3.16.2 at `4ef3d3adc06d6f675a6cd7522c177db5df614e07`. This document records local software evidence; it does not certify installation or physical acceptance.

## Reproduction and resulting behavior

- The original wall header had a 24 px inset on each side. The new geometry check failed against that code, then passed with both edges aligned to the screen. The track, meter and widget rectangles remain identical when the menu hides, returns or finishes startup. Turning automatic hiding off retains the fixed header.
- The original widget editor used `touch-action: none` over its entire surface. Its new owned popup keeps normal vertical scrolling outside explicit drag grips. Cancel discards the popup draft; Apply stages it; Settings Save persists it. A first-use production popup also opened after an offline reload, at 1280×800 and 1280×400. Its footer remained reachable, and offline Apply did not persist changes to the backend. Screenshots at both sizes were visually inspected.
- The PCM reader still reads local Squeezelite shared memory without altering the producer. The native test checks calibrated sine-wave RMS through the worker, HTTP API and live event stream. Leaving SSE open without renewing the lease stops capture. No music stream is fetched by the visualizer.
- Fast frames update meter targets outside React state; status/configuration changes still update the controls. A busy worker retains one newest waiting frame. Slow event consumers retain one newest waiting response. Local pause, page hiding, navigation, stale frames and connection loss clear measured values and stop unnecessary work. A paused remote selection cannot pause local PCM.
- Timing tests retain the configured presentation delay and clear the buffer on pause, track/source changes and seeks. The animation keeps one clock, caps redraws around 30 fps, and stops writing styles when levels settle. The browser regression check sends 20 frames/s without 20 React renders/s, and verifies zero repeated style mutations for quiet, settled bars.
- Before startup is ready, no PCM demand or optional blurred artwork is started. Decoration is loaded during idle time after the usable screen, with a bounded wait. No fixed splash delay or artwork change was introduced. The Pi's existing GPU-disable stability setting is retained.

## Measured work in the controlled simulator

The [raw paired measurements](performance/3.16.3-local-pcm.json) compare the original hotfix's GUI with this amendment: local production Chromium, 1280×800, four-times browser CPU throttling, and an explicitly synthetic shared-memory PCM ring read by the real native helper. Each row is one ten-second playing window. These are review signals, not Pi frame-rate, power, thermal or statistical confidence claims.

| Playing window | Original | Amendment |
|---|---:|---:|
| JavaScript time, zero extra delay | 1,374 ms | 855 ms |
| Total main-thread task time, zero extra delay | 5,030 ms | 4,116 ms |
| React commits, zero extra delay | 221 | 61 |
| Audio HTTP reads, zero extra delay | 81 | 7 |
| JavaScript time, 600 ms presentation delay | 1,539 ms | 904 ms |
| Total main-thread task time, 600 ms delay | 5,460 ms | 4,036 ms |
| React commits, 600 ms delay | 205 | 63 |
| Audio HTTP reads, 600 ms delay | 75 | 6 |

The sampled animation-frame gap at the 95th percentile stayed about 16.7–16.8 ms in both final pairs. An early attempt with faster delivery still rendered React for every frame; its measured regression was rejected. Separating fast frames from metadata and skipping unchanged SVG styles produced the final comparison above. Faster delivery alone is not treated as a performance fix. Cold first-paint timings vary with process warm-up; no Pi boot-time improvement is inferred from them.

## Automated checks

- `npm test -- --test-concurrency=2`: **481 passed**, none skipped. Includes actual worker/native PCM integration, newest-frame bounds, capture leases, HTTP fallback, manager installation, rollback, safe volume controls, local/group independence and privacy checks.
- `python3 -m unittest discover -s tests -p '*_test.py'`: **112 passed**. No Python or hardware-control source was changed by these amendments.
- Chromium audio plus final amendment journeys: **10 passed**. The preceding broader source run also passed all **18** audio, sync, performance and amendment cases; its final header preference and settled-style cases were then checked again in the final ten.
- English/Dutch and privacy follow-up: **6 passed**. Release notes and new chooser copy have both translations.
- `npm run build`: passed. The existing large-chunk advisory remains; no production dependency was added.
- Initial main application JavaScript grew from 651,841 to 656,978 decoded bytes (about 0.8%); the shared client chunk is unchanged. The widget chooser remains in the deferred Settings chunk.
- `npm audit --omit=dev --audit-level=high`: **0 known vulnerabilities**.
- `DAW_REMOTE_ADDRESS=127.0.0.1 npm run test:offline -- --max-failures=1`: **16 passed**.
- Native WebKit wall plus amendment journeys: **18 passed**, with the actual browser engine launched. Only the host-library inventory check was bypassed to use this environment's installed libraries; no browser test was skipped.
- Full configured GitHub CI must pass on the review head before merge or publication. Local results do not establish signed OTA availability.

The final advanced-meter label keeps “Aligning meters…” while a live frame waits for its chosen delay, rather than calling that wait “Paused”. The four Chromium synchronization journeys passed again after that small correction. It does not change steady-state frame processing.

The first broad offline run stopped at phone pairing because this cloud environment could not reach its advertised container LAN address; it received a proxy error page. That run is not counted as passed. The final run uses the supported `DAW_REMOTE_ADDRESS=127.0.0.1` environment override for its local phone browser, without changing application behavior or weakening assertions.

## Physical checks retained for the next session

TuneBox is off. The owner explicitly deferred amplifier diagnosis; [hardware-next-session.md](hardware-next-session.md) retains the reported 15 W at 90%, unknown driver impedance and two read-only channel-gain commands. No amplifier gain, headroom, volume ceiling, audio route, PD setting, GPIO, boot file or splash media was changed.

Still to observe on the real Pi: touch scrolling and grip dragging, motion during ordinary playback, quiet/pause behavior, memory/CPU/temperature after a cold boot, standby/wake and the existing update path. Actual background boot contention, electrical stability and speaker output remain unmeasured. Preserve the original SAFE UPDATE host refresh requirements; app-only GUI installation does not certify that those host helpers were refreshed.
