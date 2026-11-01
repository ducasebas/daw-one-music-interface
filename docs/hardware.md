# Hardware verification and release gate

Status vocabulary: **Confirmed from manufacturer**, **Proposed design choice**, **Requires measurement**, **Requires prototype validation**, **Not yet implemented**. No component-specific manufacturer specifications have been verified in this session. User-provided component names do not establish wiring or electrical compatibility.

| Item                         | Current evidence / design                                 | Status / verification action                                                                                          |
| ---------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Exact Pi model and RAM       | Owner reports Pi 3 Model B+ / manufacturer 1 GB; Pi 4 / 2 GB remains the original software target, not the available board             | Requires prototype validation: photograph PCB/model; `cat /proc/device-tree/model`, `free -h`                         |
| Waveshare screen revision    | Waveshare 7.9inch DSI LCD, SKU 22293 selected; physical revision unknown        | Requires prototype validation: identify SKU/revision and manufacturer manual                                          |
| Louder HAT Plus revision     | Unknown; no driver or pin assumptions                     | Requires prototype validation: schematic, vendor instructions, audio test                                             |
| RP2040 firmware/pins         | JSON-lines protocol proposed; no board firmware delivered | Not yet implemented: identify board, UART levels/pins and firmware toolchain                                          |
| Actual PD circuit            | Unknown                                                   | Requires measurement: schematic, negotiated voltage/current, protection and failure behavior                          |
| Amplifier mute/shutdown path | Unknown; no GPIO code exists                              | Requires measurement: polarity, default state, hardware pull resistors, reset/crash behavior                          |
| Rail sequencing              | Unknown                                                   | Requires measurement: oscilloscope capture across startup/shutdown/failure; vendor limits                             |
| Temperature sensor           | Unknown                                                   | Proposed design choice: select sensor and mounting; calibrate thresholds on prototype                                 |
| LED electrical driver        | Unknown                                                   | Not yet implemented: select current-limited driver from electrical design                                             |
| Backlight control            | Unknown                                                   | Requires prototype validation: identify supported interface, confirm blanking and touch wake                          |
| Presence radar/window        | Unknown                                                   | Requires prototype validation: select module, enclosure material, antenna clearance and false-wake tests              |
| CM5 carrierboard             | No migration selected                                     | Proposed design choice: choose only after power/audio/display interface requirements are known                        |
| RP2040 fail-safe watchdog    | Software simulation policy only                           | Requires prototype validation: independent hardware disable on lost heartbeat, CRC/framing policy, stale ACK behavior |

## Physical enable gate

Real GPIO/UART/I²C drivers are **not implemented**. There is no environment variable or UI switch that turns simulation into physical output. `simulation-verified` only enables an in-memory simulated amplifier. Configuration examples are inert.

Before writing a physical transport: obtain manufacturer documents and schematics; confirm ground/voltage compatibility, mute polarity, rail ordering and power-good; independently guarantee default disable during unpowered Pi, startup, UART loss, firmware reboot, process crash and brownout. Define tested hardware timeouts and thermal limits. Simulation uses a 3 s watchdog, 30 s display idle and 75 °C alarm only as proposed demo policy, never electrical specifications. Require a signed-off verification record in the future physical driver and test deny-by-default.

## Phase 5 bench checklist — NOT COMPLETE

- [ ] Pi 4 model/RAM, storage, PSU, thermal throttling, reboot and cold boot measured.
- [ ] Screen revision and real 1280 × 400 mode confirmed; touch corners, orientation and wake tested.
- [ ] Louder HAT Plus revision and driver confirmed; muted output verified with instrument before speakers.
- [ ] RP2040 firmware, pin map, logic voltages and independent watchdog validated.
- [ ] PD rail sequencing, brownout and power-good behavior measured.
- [ ] Thermal sensor calibration, alarm hysteresis and sensor disconnect handling verified.
- [ ] Radar/window false wake and detection field tested; ambient sensor and LED driver checked.
- [ ] Amplifier fault, Pi reboot, controller reboot, shutdown during playback and competing events tested electrically.
- [ ] Long-duration Pi memory/CPU, Chromium stability and audio underruns measured.

All boxes require real hardware evidence. A green software test cannot complete them.
