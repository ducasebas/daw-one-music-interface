# GUI 3.4.2 — Louder equalizer controls

The HAT DSP already processes audio when Music Assistant plays through Squeezelite. The equalizer is a separate controllable part of that DSP. A flat equalizer can be enabled without an audible tonal change.

The owner confirmed the installed TAS5825M driver reports:

```
numid=22,iface=MIXER,name='Equalizer'
; Item #0 'On'
; Item #1 'Off'
: values=0
```

GUI 3.4.1 assumed index 1 enabled the equalizer in its Flat/Soft presets. That was incorrect for this driver. GUI 3.4.2 reads the actual enum labels through ALSA and uses their corresponding values. It also supports drivers with the reverse order and does not guess when labels are missing. ALSA boolean switches retain their defined 1/0 semantics.

Open **Settings → Audio & DSP**, then scroll to **Louder HAT DSP**:

- **Equalizer** shows On/Off by name and stages a change until Save.
- **Flat** enables EQ and sets bands and channel gains to 0 dB.
- **Soft** enables EQ, cuts the exposed bands by 3 dB and preserves channel gains.
- Applying a completed room measurement also uses the named On value; missing enum labels stop the application before writing a profile.
- **Cancel** restores the saved preview; Save applies and verifies ALSA values.
- **Restore defaults** returns bands/channel gains to neutral and enables the named equalizer state. With legacy missing labels, it preserves the unknown switch value.

Positive EQ gains retain the existing digital-headroom checks. Failed ALSA writes attempt to restore previous values. This release does not change the playback route, driver overlay, modulation, bridge mode, amplifier power or the Pi's shutdown behavior. Playback and the named equalizer On state were owner-confirmed on the Pi; a complete DSP/room-calibration and hardware-power acceptance test remains separate.

The manager now returns enum item labels and recognises the actual `Fault ...` and `Warning ...` control names, including over-temperature shutdown, clock and channel overcurrent. A reported flag is the current driver reading, not a stored history or a measurement of the HAT's 5V regulator temperature. The driver can return zero flags when its audio section is inactive. These readings do not certify that no earlier hardware fault occurred.

The root device manager needs the matching updated helper. Devices already opted into signed appliance maintenance receive it with OTA; older installations require the complete device refresh documented in [appliance-update.md](appliance-update.md). If labels are unavailable, the GUI disables the switch and presets rather than interpreting a bare number.

Release validation also reproduced an intermittent upload rejection error after changing tracks. The server now finishes draining the incoming video body before replying with the track-conflict or invalid-control-token response, so a closing proxy connection cannot cut that body off. A streamed HTTP regression covers both rejection paths; this does not change which track receives an accepted upload.

For an immediate named-state command on the owner's configured card:

```bash
sudo amixer -c LouderRaspberry cset name='Equalizer' On
```

This changes only the equalizer switch, not its bands. The owner's returned `values=0` confirms On for the installed driver. Reopen Audio & DSP after external changes so its preview reads the current hardware controls. Saving in another already-open stale settings page can otherwise apply that page's staged values.

## GUI 3.7.1: negative dB arguments

The owner approved repair candidate `2026.11.17-dsp.1` for signed preview publication on 17 November 2026. DSP writes now terminate amixer's command-line options before `cset`. Without that separator, Linux GNU `getopt_long` interprets a negative integer such as `-3` as an option. A Soft/Warm preset, channel attenuation or headroom reservation can therefore fail before ALSA receives the value. The same bug also affects restoring a negative previous value after failure and local amplifier standby/restore.

All four write paths now use `amixer -c LouderRaspberry -- cset ...`. Existing range validation, headroom ordering, readback verification and failure recovery remain in place. The correction does not change the saved sound profile or apply a preset by itself.

`tests/dsp_argv_test.py` collects the actual arguments emitted by the controller with a simulated ALSA device and passes them through GNU `getopt`, which uses the same argument-parsing semantics as Linux amixer. Before correction, EQ cuts, headroom, rollback and standby fail argument parsing. All five tests pass with the separator, including the explicit reproduction of the legacy failure. Related DSP, automatic-sound, Bluetooth and measurement tests also pass. These checks do not establish that the physical amplifier accepted a DSP write.

During the owner's 17 November diagnosis, ordinary SSH stdout was redirected: even `printf` produced no visible output. Restoring the interactive terminal output with `exec >/dev/tty 2>&1` made the reads visible again. The owner then confirmed Equalizer `On=0`, `Off=1`, current value `1`, and a successful `cget` exit status of `0`. This proves that the switch is readable and currently Off; it does not yet prove that the corrected Save operation works on the HAT.

The pinned driver also advertises TLV dB metadata for the unrelated Digital Volume control without providing its TLV data. An `amixer contents` metadata warning alone does not mean the supported EQ controls failed: targeted `cget` reads and the program's exit status distinguish the cases. The application continues to require successful reads and matching values for every requested DSP change.

After the approved patch installs, pause playback and test a Soft/Warm Save through Settings. Reopen DSP and check that the requested cuts and named Equalizer On state were read back, then confirm ordinary playback at the existing listening level. Signed appliance maintenance must refresh the installed root manager; an app-only installation needs the verified complete device refresh described above. Physical Save/readback and audible acceptance remain pending.
