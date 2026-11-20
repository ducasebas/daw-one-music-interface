# Sweep detection diagnostics — validation

Local candidate on branch `claude/ota-update-test-status-alqo95`, after GUI 3.14.0. Not pushed or published. The owner reported again that the room-measurement sweep was "not detected". Results here come from a Linux container with synthetic recordings and the browser simulator. None of them is a measurement on the Pi.

## Most likely cause on the Pi

The sweep analyser (`deploy/measurement/signal.mjs`, `capture.mjs`) runs from `/usr/local/lib/daw-one-control`. `deploy/install-measurement.sh` copies it there, and `sudo bash deploy/update-appliance.sh --apply` refreshes it. **OTA updates do not refresh it.** The 3.9.2 detection fix (matched-filter prominence instead of correlation) only reaches the Pi after that refresh. If the refresh has not run since 3.9.1, the Pi still uses the old correlation rule that failed on 19 November. The GUI could not show this until now.

## Changes

| Area | Change |
|---|---|
| Diagnosis per channel | `analyse()` returns `diagnostics`. It contains each check (`complete`, `edge`, `prominence`, `level`, `snr`, `clipping`) with its measured value, threshold and pass/fail, plus a `failed` list, the three strongest correlation peaks, noise/peak/sweep dBFS and the analyser version. |
| Timing | `capture.mjs` records when `aplay` started relative to the microphone, and how long the player and the capture ran. |
| Late output | The lag search was −0.3…+1.0 s; it is now −0.3…+2.5 s. A DAC/ALSA start-up delay above 1 s used to be reported as "not detected". |
| Capture length | 5 s → 7 s, so a late sweep is not cut off. The progress estimates were raised to match (+2 s per channel). |
| Older analyser | `measurementAnalyserVersion` (in `shared/room-measurement.js`) is written into every result. Results show a notice when the result has no diagnostics or comes from a different analyser version: "run `sudo bash deploy/update-appliance.sh --apply` once on the Pi". |
| Results screen | Per channel: plain-language reasons (late/cut off, no clear peak, middle/high part too quiet, clipping) and a "Technical details" section with every check. No audio is stored; the raw recording is still deleted after analysis. |

The detection thresholds (prominence ≥ 12, middle/high thirds > 2× lead-in power, SNR ≥ 15 dB, clipping < 0.1 %) are unchanged.

## Passed locally

| Check | Result |
|---|---|
| `npm run check` (unit tests + build) | 422/422, build OK |
| `measurement-quality` / `measurement-status` | 12/12. New: a sweep 1.4 s late is detected; the same sweep in a 5 s recording fails with `complete`; a sweep buried in noise fails with `prominence`/`level`/`snr`; a 3.9.x result without diagnostics or with another analyser version gets the refresh notice. |
| `room-measurement.spec.js` (Chromium) | 5/5. New: Results show the late/cut-off reason, the older-analyser notice and the technical details. |
| Full Chromium suite | see below |

Screenshot: [images/sweep-diagnostics/results-diagnosis.png](images/sweep-diagnostics/results-diagnosis.png) (simulator, synthetic recording).

## Not observed on the Pi

- Which check failed in the owner's last sweep. Needed (read-only, no audio): `sudo cat /var/lib/daw-one-measurement/status.json`.
- Whether the Pi's analyser is the 3.9.1 or the 3.9.2 version.
- The real output latency on the Louder HAT.

These changes reach the Pi only through `sudo bash deploy/update-appliance.sh --apply`, not through OTA alone. The GUI part (reasons, notice) does come through OTA.
