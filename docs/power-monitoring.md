# INA228 consumption and HUSB238 PD status

**Owner-approved follow-up:** [GUI 3.8.1 PD](pd-100w-patch.md) adds a separately confirmed, fixed 20 V / 5 A request and clearer missing-VBUS messages. The owner approved it for signed preview publication after full CI passes. The read-only description below applies to the published GUI 3.8.0 telemetry worker; that worker remains read-only in the patch.

GUI 3.8.0 POWER (`2026.11.17-power.1`) was published as signed preview at `007be01baa693a577e33f1fc46d8bbc8c3666207` after its owner-approved checks passed. Its public signature, archive/source inventory and channel selection were independently verified. The owner confirmed Adafruit INA228 5832 and HUSB238 5991 over STEMMA QT, with current routed through VIN+ → VIN−, and now reports a 25 W contract and missing consumption. Current register values and the separate INA228 VBUS sense connection remain unconfirmed. The follow-up patch above is separately approved for publication; its real PD request and INA228 readings remain untested on the boards.

## Interface

Open **Settings → System → Sensors**. Two large cards distinguish:

| Reading | Source | Meaning |
| --- | --- | --- |
| Consumption, voltage and signed current | INA228, bus 1 / 0x40 | The rail passing through the original 15 mΩ shunt. It excludes loads on a separate supply. |
| Active voltage/current and PD capacity | HUSB238, bus 1 / 0x08 | The controller's negotiated contract, not the instantaneous load. |
| Offered fixed-voltage profiles | HUSB238 | Source profiles, separate from the active contract. Missing profiles are not invented. |

A measured 12.4 W load, active 20 V × 3 A = 60 W contract and offered 20 V × 5 A = 100 W profile can coexist. The hardware notification warns about **60 W** if the saved requirement is 100 W; an advertised profile alone does not satisfy that threshold. Opening the notification leads to Sensors. **Required power (W)** sets a warning threshold, not a physical power or volume limit.

The home-reading selector adds **Supply voltage**, **Supply current** and **Negotiated PD capacity** alongside the existing **Power use**, within the four-widget maximum. English and Dutch labels are included. Reader controls participate in the main Save/Cancel/defaults and unsaved-navigation flow. Checkboxes stage changes; Save waits for the manager's acknowledgement. Activation failure restores the old reader configuration and leaves the GUI edit available for retry.

Saving sensor changes also leaves an unchanged system clock alone; sharing the System settings group no longer triggers a redundant clock-setting command.

## INA228 voltage sense

VIN+ and VIN− form the current path, but do not automatically connect the separate VBUS input. Adafruit documents its VBUS solder jumper as **open by default**. For this project's high-side measurement, verify that VBUS senses the monitored positive rail: the Adafruit jumper connects VBUS to VIN+, or a verified separate sense wire can provide that connection. Inspect/change wiring only with power disconnected. STEMMA QT carries logic/I²C.

The GUI requires separate confirmations that current flows through the shunt and VBUS senses the monitored voltage. Without both, INA228 numerical readings say **Confirm sensor wiring**. The HUSB238 contract can be read independently while VBUS remains unconfirmed. Do not tick a confirmation merely to clear the message.

The reader supports the original R015 shunt and continuous shunt-and-bus conversion, with or without die temperature. It checks chip identity, ADC range, conversion readiness, memory status, saturation and configuration changes during a sample. Current = signed shunt voltage / 0.015 Ω; consumption = bus voltage × current. It does not depend on uninitialised CURRENT/POWER calibration registers or write SHUNT_CAL. These are nominal-shunt values, not laboratory calibration. INA die temperature is not enclosure or amplifier temperature.

## Installation and activation after approval

The signed complete-device update runs `deploy/install-manager.sh`, which installs the power helper and `daw-one-power.service`. The reader is **off by default**. Existing configuration survives later updates; an enabled reader is restarted with new code. Devices still using application-only OTA need the existing complete-appliance refresh. Do not install unpublished source on the live Pi.

After an approved complete-device installation:

1. Enable **Read HUSB238 PD contract** in Sensors and Save. Check active voltage/current/capacity separately from the offered profiles.
2. Resolve VBUS wiring while powered off. Enable **Read INA228 consumption**, confirm the actual current and voltage paths, then Save.
3. Check plausible readings during normal listening, home widgets, Cancel/Save and notification navigation. Do not deliberately recreate the unresolved supply interruption.

Read-only diagnostics after activation:

```bash
systemctl is-active daw-one-power.service
curl -fsS http://127.0.0.1:3001/api/power
sudo journalctl -b -u daw-one-power.service --no-pager -n 30
```

The reader samples every two seconds; the existing host sampler publishes through the existing state channel every five seconds. There is no extra frontend power-polling interval. Samples expire after seven seconds; disabled/error/stale states clear each board independently. A fresh zero load is distinct from unavailable data. Reversed current and significant INA/PD voltage disagreement are flagged; disagreement suppresses derived consumption. Losing one board does not hide the other's valid readings.

## Boundaries

Hardware access uses standard-library Linux I²C transfers: one register-pointer byte followed by a repeated-start read. Addresses/registers are allowlisted. The worker never uses I2C_SLAVE_FORCE, writes INA configuration/calibration, accesses the HUSB238 GO register, requests another voltage or sends a hard reset. PD DIP/startup selection remains authoritative; the PD rail also powers the Pi.

The `dawpower` account has bus-1 access and the non-control `dawsensors` group, without Music Assistant credentials or manager-socket membership. The backend retains its device sandbox and reads atomic group-readable JSON. Runtime reads reject links, non-regular files and input over 16 KiB. The public DTO validates freshness, source/scaling, ranges and PD codes. Configuration accepts only four booleans through the existing PIN, same-origin nonce, schema and update lock; the privileged helper only changes its fixed config/service. Wi-Fi-only phone setup cannot access these commands.

These readings do not mark `device.verified`, `controllerReady`, `powerGood` or amplifier enable as true. They do not certify cable/supply/regulator behaviour or independent protection. Two-second sampling cannot exclude millisecond brownouts. The owner's whole-device interruption on a multi-port GaN supply remains a separate investigation.

Reading the INA228 diagnostic register can clear its latched alert flags. Coordinate any future hardware-interrupt/protection consumer with this reader; this telemetry loop is not an independent protection controller.

## References

- [Adafruit INA228 pinouts and VBUS jumper](https://learn.adafruit.com/adafruit-ina228-i2c-power-monitor/pinouts)
- [TI INA228 datasheet and register conversion scales](https://www.ti.com/lit/ds/symlink/ina228.pdf)
- [Adafruit HUSB238 pinouts and startup configuration](https://learn.adafruit.com/adafruit-usb-type-c-power-delivery-switchable-breakout/pinouts)
- [Hynetek HUSB238 Register Information Rev. 1.1](https://www.hynetek.com/uploadfiles/site/219/news/c3afa59e-1c03-4b92-8525-873c152bae4b.pdf)
- [Validation and remaining device checks](power-validation.md)
