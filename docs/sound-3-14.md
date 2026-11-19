# GUI 3.14.0 · SOUND

Release `2026.11.19-sound.1`, cache 60. Local candidate; it needs the owner's approval before push or publication. Roadmap §3.14.

## Change
- **Simple layer** (`SimpleSound`, `soundCurve`/`soundSettings` in `shared/dsp-settings.js`), stored as `prefs.sound {preset, bass, treble, loudness}`:
  - **Preset:** Flat / Warm / Soft, using the existing `dspPreset` curves.
  - **Bass:** −6…+6 dB on bands below 250 Hz.
  - **Treble:** −6…+6 dB on bands from 4 kHz up.
  - **Loudness:** +3 dB below 150 Hz and +2 dB from 8 kHz up.
  - Everything is clamped to each band's limits. Each control has one line of explanation.
- **Room correction:** honest status (a room profile exists or not) with a link to Room measurement. Nothing is switched silently.
- **Advanced:** the full Louder controls (`LouderDsp`), unchanged. They now sit in a collapsible "Advanced: all amplifier controls" section, which stays open for the session once opened (also after unlocking).
- **Safety unchanged:** changes are previewed and only written on Save, through the existing manager path that reserves headroom for positive gains, verifies the readback and restores on failure. Cancel and Restore defaults still work. Automatic sound disables the simple controls with an explanation.

## Validation (simulator/unit only)
- `dsp-controls.test.js`: bass, treble and loudness on top of the presets, the equalizer switched on, clamping, and settings validation.
- `dsp.spec.js`: the simple layer previews without writing, Save sends the expected bands and stores `prefs.sound`. The existing DSP tests open Advanced first.
- Not observed: listening on the real Louder.
