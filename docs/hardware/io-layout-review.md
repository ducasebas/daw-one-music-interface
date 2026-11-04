# I/O layout review — 4 November 2026

Source: [owner-supplied concept](io-layout-proposal.md). This review identifies verification work; it does not approve wiring, pin assignments, components or manufacturing dimensions. No boot overlay or physical driver is installed from this document.

| Topic | Status and verification step |
| --- | --- |
| Case/strip and screen dimensions | Requires measurement/prototype validation. Screen thickness, speaker-terminal outline, USB-C engagement, mounting and clearances must be measured from the actual selected parts. Make a fit template before CNC work |
| HUSB238 / 20 V startup | Proposed design choice. Establish whether the selected breakout autonomously requests the required profile before Pi boot. The description mixes switch-selected power with a Pi-issued I²C request: prove there is no circular dependency on Pi power |
| USB-C PD contract | Requires prototype validation. Confirm exact breakout revision, supported cable/current negotiation and actual readback APIs from manufacturer docs. INA228 measurements alone cannot establish that a 20 V / 5 A contract was negotiated |
| Power budget | Requires measurement. Calculate input/output efficiency, transients, thermal derating, audio demand and Pi/peripheral demand together; a 100 W charger label does not establish safe system margin |
| Separate 5 V screen rail | Requires schematic review and measurement. Verify the DSI/display power connections and possible backfeed paths before using independent rails. Never assume the flex isolates power merely because image data uses DSI |
| Fuse, wire and connectors | Requires design review. The proposed 6.3 A fuse is not an approved protection choice; coordinate conductor/connector ratings, supply protection, fuse time-current behaviour and fault paths |
| HAT PDN / Linux driver ownership | Requires revision-specific vendor confirmation. Do not let a user-space GPIO service and kernel audio driver compete for a pin. No proposed physical pin number authorises control |
| I²C chain / addresses | Proposed selection. Confirm supply and pull-up voltage, address straps, devices and revision-specific bus behaviour before connecting. An address list is not an electrical compatibility check |
| RGB ring / PWM / ULN2803 | Requires electrical and prototype validation: LED type/current limiting, driver drop/dissipation, start/reset states and PWM resource conflicts with audio/peripherals. Linux software PWM is not a real-time or fail-safe controller |
| Radar UART / Bluetooth | Requires exact module voltage/protocol and UART ownership verification. Do not apply `disable-bt` or PWM overlays automatically; preserve existing Bluetooth/network/console setup |
| Temperature/light/power sensors | Named component choices only. Drivers, calibration, sampling, mounting and stale/error behaviour are not implemented. Do not show fabricated measurements |
| Speaker wiring | The source identifies BTL outputs: verify the actual HAT wiring and insulated terminals. Do not join speaker negative terminals to system ground |
| Safety / MCU decision | Direct Pi control is a new proposal, not proof that the RP2040 concept is unnecessary. Establish safe defaults and independent disable under Linux hang, boot, reset and power faults before amp enable |
| Mechanical fabrication | Measure actual parts, then create dimensioned DXF/STEP drawings and a cheap fit prototype. Laser cutting can make through-openings; a recessed USB-C pocket also needs machining. Check the finished pocket/strip strength with the fabricator |

The quoted shopping list/prices and cut-out coordinates remain source material; they are not current purchasing advice or a production drawing. No “verified” status is inferred from copying it to GitHub. Record manufacturer source, date, actual revision and test evidence for each resolved item.
