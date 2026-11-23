# Next session: amplifier output

Deferred at the owner's request on 23 November 2026 because TuneBox is off. Continue the interface work without changing amplifier gain, volume ceilings, DSP headroom or power negotiation.

## Retained observations

- Two self-built wall speakers, each with one driver.
- The owner reports about 15 W total system consumption at 90% TuneBox volume. Earlier observations were around 10 W. Which meter/display supplied the number is not yet confirmed.
- Driver model, nominal impedance and RMS rating remain unknown. A single driver does not establish low impedance.
- No current ALSA gain readback was collected in this session. There is no confirmed amplifier fault or confirmed power ceiling from these observations alone.

## Resume here when TuneBox is on

First read the two channel gains; these commands do not change a setting:

```bash
amixer -c LouderRaspberry cget name='Channel Left Gain'
amixer -c LouderRaspberry cget name='Channel Right Gain'
```

Then identify the drivers and their impedance, confirm the meter and whether the observation is an average or peak, and inspect the complete volume chain: Music Assistant/Squeezelite, mute/volume ceiling, local-control attenuation, digital amplifier volume, EQ headroom and current fault flags. Inspect the actual supply contract/voltage and temperature separately. Compare readings during ordinary listening; do not provoke the unresolved power interruption or increase gain simply to reach a wattage target.

The present DSP reserves digital headroom for positive EQ. Local fallback volume can also retain channel attenuation. These are paths to inspect, not established causes. Average power drawn from the supply is not the peak output power into the speakers, and a volume percentage is not a calibrated wattage.
