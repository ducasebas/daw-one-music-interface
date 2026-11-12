# USB microphone measurement and DSP targets

GUI 3.2 provides an opt-in local measurement worker. No browser microphone permission, continuously recorded room audio or simulated response curve is used. It requires a supported ALSA USB capture device and an explicitly verified local output.

1. Open **Settings → Room measurement**. Enter room length, width and height.
2. Enter speaker height, spacing, listening distance, wall distance and placement. These document the setup; they do not calculate a substitute for a microphone reading.
3. Select a detected USB capture device, microphone type and model. Optionally import a JSON calibration array: `[[frequencyHz, responseDeviationDb], ...]`, sorted by frequency, 20–24000 Hz, at most 128 entries. Positive deviation means the microphone reads too high and is subtracted. Convert the manufacturer's calibration convention before importing; this is not an automatic REW calibration-file importer. Use the correct orientation. Without calibration the response includes microphone coloration; absolute SPL is unavailable.
4. Choose a **Listening target**: Balanced, Neutral, Warm, Extra bass, Vocal and detail, Quiet listening, or Custom bass/treble/tilt. Optionally import favorite genres from MA and explicitly select the suggested target. An actual genre sample is used; no fictional taste profile is generated.
5. Save the room profile. Remove this player from any synchronized group and stop playback. Place the microphone at the normal ear-height listening position. Verify routing and set a safe amplifier level. A digital −36 dBFS sweep is not an acoustic safety guarantee.
6. Confirm the audible test. The worker captures mono USB PCM at 48 kHz and plays a three-second logarithmic 30 Hz–18 kHz sweep first left, then right, with leading/trailing silence. Local Squeezelite systemd services are temporarily stopped to release ALSA and restored on success, failure, cancellation or service timeout. No MA group stop or network-room sweep is sent. Other manually launched ALSA owners must be stopped by the operator.
7. Review relative response, SNR and clipping. Responses are reported in 1/6-octave bands, normalized to the median 500–2000 Hz. The capture must exceed the 15 dB SNR check and remain below 0.1% clipped samples. Poor measurements block correction. Raw PCM and temporary sweep files are deleted; the processed result remains available for download.
8. Change targets without repeating the baseline measurement. The plot shows measured channels, chosen target and a predicted corrected response. Room correction attenuates broad peaks and avoids boosting measured deep nulls. Strength and maximum cuts/tonal boost are configurable. Default tonal boost is zero; relative bass emphasis is made by attenuating other bands.
9. **Apply listening target** requires a completed valid measurement through the verified Louder output and actual supported ALSA EQ controls. A separate confirmation applies a bounded 15-band approximation, not the full plotted curve. Positive filters reserve conservative digital headroom by lowering both channel gains; overall loudness can fall. Previous ALSA values are saved for **Undo last DSP correction**. Applying a headphone-output measurement to a different Louder output is blocked.
10. Repeat the sweep after applying DSP, compare at a matched listening level and keep the response that sounds right. Genre presets are suggestions; target curves and speaker limitations still need listening and physical verification. The current correction does not implement per-speaker convolution, FIR/time alignment, calibrated SPL, crossover design, limiters or RT60 certification.

## Install the optional worker

Run only after checking the actual amplifier/output. The installer does not start a sweep.

```sh
cd /opt/daw-one
sudo bash deploy/install-measurement.sh --output plughw:CARD=Headphones,DEV=0 --verified-output
```

For an actually installed and tested Louder driver exposing the supported `LouderRaspberry` ALSA card, explicitly choose `plughw:CARD=LouderRaspberry,DEV=0` instead. This card ID is a supported configuration, not a claim that every board/driver uses it. Inspect `aplay -L` first. Do not select an unverified HAT output simply to enable the button.

The trusted helper lives outside the OTA application slots. Capture runs as an audio-service user with a 256 MiB memory limit and sixty-second timeout. The fixed service's preparation/restoration helpers can stop/start only the two known local Squeezelite units. No arbitrary command, capture path or output route is accepted from the browser. Detection rejects non-USB capture paths and stale card selections.

Physical sweep timing, USB microphone compatibility, acoustic repeatability, amplifier response and the actual HAT equalizer remain acceptance tests on the device. Software fixtures verify known flat PCM response, noise/clipping rejection, preset bounds and preservation of the baseline; they do not certify a room measurement.
