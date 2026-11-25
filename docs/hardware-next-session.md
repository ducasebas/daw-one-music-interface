# Next session: amplifier output

Deferred at the owner's request on 23 November 2026 because TuneBox is off. Continue the interface work without changing amplifier gain, volume ceilings, DSP headroom or power negotiation.

## Retained observations

- Two self-built wall speakers, each with one driver.
- The owner reports about 15 W total system consumption at 90% TuneBox volume. Earlier observations were around 10 W. Which meter/display supplied the number is not yet confirmed.
- Driver model, nominal impedance and RMS rating remain unknown. A single driver does not establish low impedance.
- On 25 November 2026 the owner supplied ALSA readbacks: Channel Left Gain = -9 and Channel Right Gain = -9, both with range -110 to 0. This confirms equal channel attenuation; the origin of that attenuation remains unverified. The owner later read all 15 EQ bands: 20/32/50/80/125/200 Hz at 0; 315/500/800 Hz at -2; 1250/2000/3150 Hz at -3; 5000/8000/16000 Hz at -2. No band has positive boost. There is no confirmed amplifier fault or confirmed power ceiling from these observations alone.

## Resume here when TuneBox is on

The two channel gains were read as -9 on 25 November. These commands can repeat the readback without changing a setting:

```bash
amixer -c LouderRaspberry cget name='Channel Left Gain'
amixer -c LouderRaspberry cget name='Channel Right Gain'
```

The reported current curve needs no positive-boost headroom. Review saved local attenuation and the existing gain controls at low playback volume before a deliberate gain restoration; the owner has not reported changing either gain. The current Warm preset uses cuts; an earlier positive EQ can have left reserved channel headroom. Identify the drivers and their impedance, confirm the meter and whether the observation is an average or peak, and inspect the complete volume chain: Music Assistant/Squeezelite, mute/volume ceiling, local-control attenuation, digital amplifier volume and current fault flags. Inspect the actual supply contract/voltage and temperature separately. Compare readings during ordinary listening; do not provoke the unresolved power interruption or increase gain simply to reach a wattage target.

The present DSP reserves digital headroom for positive EQ. Local fallback volume can also retain channel attenuation. These are paths to inspect, not established causes. Average power drawn from the supply is not the peak output power into the speakers, and a volume percentage is not a calibrated wattage.
