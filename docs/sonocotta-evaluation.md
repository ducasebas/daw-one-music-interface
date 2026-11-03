# Sonocotta Louder HAT — evaluation proposal

Project: **DAW TuneBox v1**, currently implemented in this repository under the DAW ONE name.
Status: independent prototype; no Sonocotta sponsorship, approval or hardware compatibility certification.

## Evaluation target

The owner selected the **Sonocotta Louder Raspberry Pi HAT** family for evaluation.
The model previously discussed with the maker is the **Louder Raspberry HAT Plus 1X (TAS5825M)**. Earlier correspondence concerned revision F1; the revision of any actual sample and its current documentation still need confirmation. Do not infer wiring, driver APIs or electrical acceptance from the model name.

No manufacturer electrical specifications, pin assignments or supported control APIs are asserted here.

## Current evidence

- React interface with six skins and a shared 1280 × 400 layout, Node backend and hardware simulator.
- Shared device state machine, fault latching and simulated amplifier safety gate.
- Music Assistant adapter and protocol-fixture tests; owner-reported MA 2.10.9 authentication, player discovery and audible Squeezelite playback through the Pi 3 headphone jack. See the bounded [field report](field-test-2026-11-01.md).
- Owner reports a real Pi 3 B+ HDMI kiosk. The Pi 4 remains the original design target; no physical Pi 4 or HAT acceptance is claimed. The Pi 3 has unresolved undervoltage and cursor stutter.
- Startup playback has software regression coverage; the lightweight Pi3 profile deliberately uses static branding.
- Physical GPIO/UART/I²C drivers and independent hardware safety enforcement are not implemented. Simulated meters and speaker activity are not audio measurements.

See [validation](validation.md), [hardware blockers](hardware.md), [Music Assistant](music-assistant.md) and [Pi first run](pi-first-run.md).

## Questions for Sonocotta

1. Is the previously discussed Plus 1X/TAS5825M still the appropriate variant for this prototype, and which revision/documentation would accompany a sample? The current bench Pi is a 3 B+; Pi 4 was the original target.
2. Where are the matching installation instructions, schematics and supported Raspberry Pi OS/kernel versions?
3. Which power supply, speaker loads, cooling and enclosure conditions are required?
4. What are the documented mute/shutdown/fault interfaces, electrical levels and default states during boot, reset and loss of host control?
5. Which GPIO, I²C and I²S resources are occupied, and are there constraints when using a DSI display and an additional controller?
6. What is the recommended ALSA/player configuration? Are volume, mute or fault readback supported through documented interfaces?

Manufacturer answers must be recorded with source, date and exact board revision. An answer about another revision does not release the hardware gate.

## Integration sequence and acceptance evidence

| Stage | Work | Evidence required |
| --- | --- | --- |
| Identify | Confirm SKU/revision and collect documentation | Board photographs, document links and revision |
| Review | Map power, audio and any control interfaces | Reviewed wiring/resource table; no guessed pins |
| Install | Use vendor-supported OS/audio setup | OS/kernel versions, installation log, ALSA device enumeration |
| Audio | Register a supported player with Music Assistant | Play/pause, queue, seek where supported, reported volume/mute and audible output |
| Safety | Verify mute/default state and independent disable path | Instrumented boot/reset/power-loss/control-loss results |
| Endurance | Run kiosk and music together on the actual Pi | Duration, CPU/RAM, temperatures, underruns and crash/recovery log |

Start audio checks with vendor-approved supply/load and conservative gain. A software volume ceiling alone is not electrical protection. Do not connect an unverified control path to the amplifier.

For every test record hardware revision, software versions, setup, expected result, actual result and evidence. Use PASS, FAIL, BLOCKED or NOT RUN. Do not turn a blocked physical test into a simulated pass.

Real amplifier control stays disabled until the documented physical enable gate in [hardware.md](hardware.md) is satisfied.

## Short demonstration before requesting a sample

1. Show the product screen, then reveal the separate simulator and its “simulated” indication.
2. Demonstrate playback controls, themes and saved settings.
3. Show standby/presence and one injected fault with timestamped reasons and amplifier enable denied.
4. Distinguish the reported real Pi-jack playback from simulated HAT/safety controls; explain that no Louder HAT is attached or validated.

A 60–90 second screen recording is a proposed next deliverable, not an existing artifact. Do not claim measured sound quality, output power or latency from this demonstration.

## Follow-up outreach — draft, not sent

Technical correspondence with the maker already occurred in October 2026. No development-sample request or sample commitment is established. This is a follow-up, not a first introduction. The full private thread and personal contact addresses are deliberately excluded from the repository.

See [the proposed follow-up email](sonocotta-follow-up.md). Do not claim eligibility for a free-hardware programme until the owner supplies the actual published offer or the maker confirms it.

## Before sending

- [x] Select MIT for the project source; owner confirmed public redistribution permission for supplied images.
- [ ] Finish the visibility change and verify public access.
- [ ] Confirm the actual sample revision and suitable power/display setup with the maker.
- [ ] Make the repository/demo accessible to the recipient; a public GitHub page is not a hosted demo.
- [ ] Review proposed documentation/test contributions; no unagreed schedule or favourable review is promised.
- [ ] Owner reviews and sends the message. No email is sent by this repository work.
