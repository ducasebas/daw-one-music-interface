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
