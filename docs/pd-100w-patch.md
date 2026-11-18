# Fixed 100 W setup and missing consumption

Owner-approved repair candidate **GUI 3.8.1 · PD**, release `2026.11.18-pd.1`, cache 45. Base: published GUI 3.8.0 POWER, commit `007be01baa693a577e33f1fc46d8bbc8c3666207`. The owner requested this patch after seeing a 25 W contract and no consumption. The Pi is off; no physical readback, negotiation or installation was performed. The owner separately approved this reviewed patch with “Push maar” on 18 November 2026. Its review branch, required CI fixes, merge and signed preview publication are authorized; availability requires the complete Verify/signing workflows to pass. Publication does not execute a live PD request.

## Why 25 W can appear

At 20 V, 1.25 A means **25 W of contracted capacity**, not 25 W of measured load. Adafruit documents 1.25 A as the default with its ISET jumper closed. This is a plausible explanation of the owner's report, not a diagnosis established from a current register dump. The existing monitoring release reads that contract but never asks for a different one.

Opening ISET selects 3.25 A; it is **not** a 5 A / 100 W fix. Do not cut the jumper as part of this patch. Hynetek's full HUSB238 datasheet states that the I²C-selected source PDO overrides the VSET/ISET/factory RDO. The Adafruit 5991 board uses the E-marker-capable variant. Actual available capacity still depends on the connected port, adapter, cable and other loads on the same adapter.

## User flow after an authorized update

1. Open **Settings → System → Sensors → Set up 100 W**. Save or cancel existing sensor edits first.
2. Pause local playback and remove TuneBox from its group. The request never pauses another player, changes a group or restarts an audio service.
3. Confirm a **100 W USB-C PD source and 5 A e-marked cable**. A nominal 100 W adapter can allocate less on a shared port. Software refuses the request unless the controller actually reports an offered **20 V / 5 A** profile and an already-active **20 V** contract.
4. Optionally choose **Repeat verified 100 W setup at startup**. It is unchecked by default and is saved only after successful readback.
5. Choose **Request and verify 100 W**. The owned dialog shows progress and blocks duplicate clicks/cancel while the request is in flight. It explains that a new PD contract can interrupt the device's own power. A failure is displayed, never converted to a simulated 100 W reading.

The successful result means capacity was verified at that moment. The consumption card still comes from the INA228, independently. The live contract card updates from its ordinary reader; it is not overwritten with a hopeful result from the button.

## Request and recovery design

`deploy/power/read.py` stays a read-only telemetry worker. The separate `pd_request.py` worker can write exactly two fixed register/value pairs, to address 0x08 on bus 1:

| Operation | Register | Value |
| --- | --- | --- |
| Select the offered 20 V source PDO | 0x08, SRC_PDO | 0xA0 |
| Send one request | 0x09, GO_COMMAND | 0x01 |

It exposes no arbitrary address, voltage, current, register, command, path or shell argument. It does not write INA228 calibration, force kernel ownership, issue a PD hard reset, fetch-capabilities command, fallback voltage or retry loop. It rechecks the source immediately before writing. An already-100 W contract needs no write.

After a request, two consecutive consistent samples must report **active 20 V / 5 A and response success** within a monotonic four-second deadline. Transient attachment changes can settle during that bounded readback period; they never cause another write. An ACK alone, stale result, mismatched nonce, lower contract, unsupported source, continuously changing response or failed request cannot become a successful setup. The manager uses a fresh one-use request ID, a short-lived job, existing same-origin/PIN checks, mutation serialization and the OTA lock. Playback, grouping, Bluetooth, room tests and sync capture block a manual request. The worker runs as `dawpower`, with only I²C bus 1 and its two state directories writable.

Before the writes, the worker fsyncs `phase=requesting` to `/var/lib/daw-one-power/qualification.json`. If power disappears, that marker survives; an automatic startup cannot repeat the interrupted request. A fresh manual confirmation is required. An ordinary error also invalidates qualification. The installer, normal Save and ordinary telemetry sampling never send a PD request.

When enabled, `daw-one-pd-startup.service` runs before the local player and manager and remains active after success. It needs both saved opt-in and a previously verified setup. `tunebox-player.service` checks a successful result from the **same boot** that also matches the **current persistent qualification**, using monotonic timing rather than the network-adjusted wall clock. A later failed/interrupted manual request cannot reuse an earlier success file. Later player restarts can use a still-valid result from that boot. If startup setup fails, the GUI/backend can remain available while local player startup is blocked. Open Sensors to complete a fresh manual setup or turn off automatic setup and Save. A local player that already failed can then be started separately or on a normal reboot; this patch does not secretly restart it. With startup policy off, the worker does not open or require an I²C device.

Disabling automatic startup does not immediately renegotiate the existing contract down. It prevents future automatic requests. This is setup verification, **not** a continuous electrical protection or cable-identification system. The prior power fault is not proven resolved by these software tests.

## Missing Consumption

There are three distinct states:

| State | Display/action |
| --- | --- |
| INA228 monitoring off | Says to enable **Read INA228 consumption**, then Save. |
| Current-path or VBUS confirmation missing | Shows which wiring confirmation is missing, without invented zeros. |
| Confirmed setup but failed I²C/conversion | Reports the measurement failure; the PD card can still work. |

VIN+ → VIN− is the current path. The Adafruit INA228's separate **VBUS voltage-sense jumper is open by default**. The owner has not confirmed that connection. With all power disconnected, verify the VBUS-to-VIN+ jumper or the appropriate separate sense wire to the measured positive rail. STEMMA QT supplies logic/I²C; it does not make that voltage-sense connection. Confirm **VBUS senses the monitored supply voltage** only after physical verification. Never bridge the 20 V rail to the STEMMA logic supply.

The patch does not automatically mark either wiring confirmation true. It checks the INA228 identity and then reports missing setup **before** interpreting possibly floating/unconverted values. Even a successful 100 W request cannot fill in consumption when VBUS is absent. Voltage, signed current and watts still use the original nominal 15 mΩ shunt and existing conversion checks. No dependency is added.

## Update and rollback compatibility

An authorized signed appliance update installs the fixed request worker, both units, tmpfiles entry, player guard and manager together through the existing appliance maintenance path. Installing them never starts a request or restarts the player. Existing reader settings are retained; an older four-key settings file defaults to startup requests off.

Public manager responses keep the four original reader booleans in `settings`, with `startup100W` separately alongside them. The new GUI combines these for its staged Save/Cancel/defaults flow. An older GUI can still read its strict four-key object. A legacy Save that omits the new policy preserves a previously verified startup choice; disabling HUSB238 monitoring also disables the automatic policy. New clients explicitly send the startup choice when the helper supports it; if a newer GUI temporarily meets an older helper, ordinary four-key reader saves still work and the unsupported 100 W setup stays disabled. This preserves the application-slot rollback path while host helpers remain newer. Removing the new host helpers themselves requires a separate, deliberate host maintenance step.

No boot splash, selected audio route, DSP preset, speaker limit, multiroom membership or physical VBUS confirmation is changed by installation.

## Validation

See [PD patch validation](pd-validation.md) for the final local checks and limitations. Deterministic tests use register fixtures and simulated UI/API responses; no test sends a real PD request. Physical acceptance still requires the owner's authorized device test with a suitable source/cable and VBUS wiring. Do not provoke the unresolved power fault merely to test error handling.

## Sources

- [Adafruit HUSB238 pinouts](https://learn.adafruit.com/adafruit-usb-type-c-power-delivery-switchable-breakout/pinouts): address, ISET defaults and pin selection.
- [Adafruit HUSB238 overview](https://learn.adafruit.com/adafruit-usb-type-c-power-delivery-switchable-breakout/overview): E-marker variant and 100 W support.
- [HUSB238 full datasheet, Rev. 2.0](https://cdn-learn.adafruit.com/assets/assets/000/125/150/original/husb238_datasheet_full.pdf), page 9: I²C PDO selection overrides the pin/factory RDO.
- [HUSB238 register information, Rev. 1.1](https://www.hynetek.com/uploadfiles/site/219/news/c3afa59e-1c03-4b92-8525-873c152bae4b.pdf): SRC_PDO, GO_COMMAND and status/source fields.
- [Adafruit INA228 pinouts](https://learn.adafruit.com/adafruit-ina228-i2c-power-monitor/pinouts): separate VBUS sense and default-open jumper.
