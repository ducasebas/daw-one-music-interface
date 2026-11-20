# Sweep detection diagnostics — validation

Local candidate on branch `claude/ota-update-test-status-alqo95`, after GUI 3.14.0. Not pushed or published. The owner reported again that the room-measurement sweep was "not detected". Results here come from a Linux container with synthetic recordings and the browser simulator. None of them is a measurement on the Pi.

## Cause, from the owner's Pi result

The owner sent `/var/lib/daw-one-measurement/status.json` from 19 November 2026 (16:33 UTC, −36 dBFS, Louder output, read-only, no audio). The Pi already runs the 3.9.2 analyser (`grep -c prominence` = 3). Per channel:

| | left | right |
|---|---|---|
| prominence (needs ≥ 12) | 232.2 | 112.9 |
| delay | 177.2 ms | 207.4 ms |
| reported SNR | −0.6 dB | −13.7 dB |
| sweep detected | no | no |

So the sweep **was** found: the matched filter has a sharp peak, and the delay is inside the window. The completeness check passes at these delays. The failing check must be the level check (middle and high thirds > 2× the quiet lead-in). The reported SNR is not the windowed SNR: when detection fails, the 3.9.2 code falls back to "whole recording against its first 100 ms". A negative value means the first 100 ms is louder than the recording's average. That is a USB-microphone start-up burst, plus a settling offset lasting longer than the 150 ms that is skipped. That burst also makes the "quiet" lead-in loud, which fails the level check.

Fix:
- The level check uses a 150 Hz high-passed copy (settling offset and rumble are low-frequency) and compares with the quieter of the lead-in and the tail.
- SNR always comes from the sweep window once the sweep is located, on a DC-free (20 Hz high-pass) copy, so a decaying offset counts as neither signal nor noise.
- The capture waits for 0.4 s of microphone audio (was 60 ms) before the sweep plays.
- The diagnostics report the start burst level and whether the microphone was still settling.

Before/after on a synthetic Pi-like recording (sweep after a 177 ms delay, start-up click plus a decaying offset, 35 Hz rumble, noise):

| Recording | 3.14.0 analyser (= Pi) | This candidate |
|---|---|---|
| Pi-like, 5 s | not detected, SNR −10.4 dB, prominence 50.7 | detected, SNR 4.3 dB → "too quiet by 11 dB" |
| Pi-like, 7 s | not detected, SNR −11.9 dB | detected, SNR 4.3 dB |
| Stronger, slower burst | not detected, SNR −10.3 dB | detected, SNR 4.3 dB |
| No burst | detected, SNR 4.0 dB | detected, SNR 4.3 dB |

The real SNR in the owner's room is unknown. If it is below 15 dB after this fix, the result says how many dB are missing and offers the louder retry (−30/−24 dBFS), instead of "not detected".

Earlier hypothesis (ruled out by the owner's output): the Pi still running the 3.9.1 analyser.

## Changes

| Area | Change |
|---|---|
| Diagnosis per channel | `analyse()` returns `diagnostics`. It contains each check (`complete`, `edge`, `prominence`, `level`, `snr`, `clipping`) with its measured value, threshold and pass/fail, plus a `failed` list, the three strongest correlation peaks, noise/peak/sweep dBFS and the analyser version. |
| Timing | `capture.mjs` records when `aplay` started relative to the microphone, and how long the player and the capture ran. |
| Start-up burst | See above: level check above 150 Hz against the quietest reference, windowed DC-free SNR, 0.4 s microphone settle time before the sweep, `startBurstDbfs` and `settling` in the diagnostics. |
| Late output | The lag search was −0.3…+1.0 s; it is now −0.3…+2.5 s. A DAC/ALSA start-up delay above 1 s used to be reported as "not detected". |
| Capture length | 5 s → 7 s, so a late sweep is not cut off. The progress estimates were raised to match (+2 s per channel). |
| Older analyser | `measurementAnalyserVersion` (in `shared/room-measurement.js`) is written into every result. Results show a notice when the result has no diagnostics or comes from a different analyser version: "run `sudo bash deploy/update-appliance.sh --apply` once on the Pi". |
| Results screen | Per channel: plain-language reasons (late/cut off, no clear peak, middle/high part too quiet, clipping) and a "Technical details" section with every check. No audio is stored; the raw recording is still deleted after analysis. |

The detection thresholds (prominence ≥ 12, middle/high thirds > 2× lead-in power, SNR ≥ 15 dB, clipping < 0.1 %) are unchanged.

## Passed locally

| Check | Result |
|---|---|
| `npm run check` (unit tests + build) | 423/423, build OK |
| `measurement-quality` / `measurement-status` | 13/13. New: the owner's Pi case (a real sweep after a slow start-up burst) is detected and its SNR equals the clean case; New: a sweep 1.4 s late is detected; the same sweep in a 5 s recording fails with `complete`; a sweep buried in noise fails with `prominence`/`level`/`snr`; a 3.9.x result without diagnostics or with another analyser version gets the refresh notice. |
| `room-measurement.spec.js` (Chromium) | 5/5. New: Results show the late/cut-off reason, the older-analyser notice and the technical details. |
| Full Chromium suite (`playwright test`) | 227/227 passed before the start-up-burst fix; rerun below |

Screenshot: [images/sweep-diagnostics/results-diagnosis.png](images/sweep-diagnostics/results-diagnosis.png) (simulator, synthetic recording).

## Not observed on the Pi

- A new sweep on the Pi with this analyser (after `sudo bash deploy/update-appliance.sh --apply`), and its real SNR.
- Whether the start-up burst is the real cause; the 3.9.2 result has no per-check values, so this is inferred from prominence, delay and the negative fallback SNR.
- The real output latency on the Louder HAT.

These changes reach the Pi only through `sudo bash deploy/update-appliance.sh --apply`, not through OTA alone. The GUI part (reasons, notice) does come through OTA.
