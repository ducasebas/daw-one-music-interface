# Sonocotta Louder HAT — evaluation proposal

Project: **DAW TuneBox v1**, currently implemented in this repository under the DAW ONE name.
Status: independent prototype; no Sonocotta sponsorship, approval or hardware compatibility certification.

## Evaluation target

The owner selected the **Sonocotta Louder Raspberry Pi HAT** family for evaluation.
The exact SKU and PCB revision remain unconfirmed. Earlier project notes say “Louder HAT Plus”; do not treat that as proof of the selected board. Confirm the variant with Sonocotta before purchasing, installing overlays or designing wiring.

No manufacturer electrical specifications, pin assignments or supported control APIs are asserted here.

## Current evidence

- React interface with six skins and a shared 1280 × 400 layout, Node backend and hardware simulator.
- Shared device state machine, fault latching and simulated amplifier safety gate.
- Music Assistant adapter and protocol-fixture tests; an actual Music Assistant server/player and audible output are not yet validated.
- Owner reports the Linux/systemd/Chromium kiosk runs in an ARM64 Debian UTM VM. VM results do not establish Pi GPU, audio or electrical compatibility.
- Startup playback has software regression coverage; the most recent fix still needs owner confirmation in UTM.
- Physical GPIO/UART/I²C drivers and independent hardware safety enforcement are not implemented. Simulated meters and speaker activity are not audio measurements.

See [validation](validation.md), [hardware blockers](hardware.md), [Music Assistant](music-assistant.md) and [Pi first run](pi-first-run.md).

## Questions for Sonocotta

1. Which current Louder variant and PCB revision would you recommend for a Pi 4, 2 GB streaming-amplifier prototype?
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
4. Explain that no physical audio board is attached and that live Music Assistant playback remains a separate validation step.

A 60–90 second screen recording is a proposed next deliverable, not an existing artifact. Do not claim measured sound quality, output power or latency from this demonstration.

## Draft outreach — not sent

Subject: Development sample request — Louder HAT integration for DAW TuneBox

Hi Sonocotta,

I am developing DAW TuneBox, a Raspberry Pi based streaming-amplifier interface with a 1280 × 400 touchscreen layout, themes and a separate hardware simulation dashboard.

The application currently runs in an ARM64 Linux VM. It includes a Music Assistant adapter, but live playback and physical audio hardware are still awaiting validation. I would like to evaluate a Louder HAT on a Raspberry Pi 4 and document the integration honestly.

Would you consider providing one development/review sample, and advise which current variant is appropriate? In return, I propose to provide a reproducible installation guide, test results and issue reports, plus a short demonstration. Any published evaluation would disclose that the sample was supplied and would not promise a positive review.

The repository is private; I can arrange review access or share a demonstration if useful.

Could you also point me to the revision-specific installation and electrical documentation, particularly power requirements and mute/shutdown behavior?

Thank you!

## Before sending

- [ ] Confirm sender name/contact and exact requested board.
- [ ] Record the short demo and check it is accessible to the recipient.
- [ ] Decide what documentation can be shared from the private repository; do not change repository visibility automatically.
- [ ] Review the proposed deliverables and timeline before committing to them.
- [ ] Owner sends the message or explicitly authorizes sending through an available channel.

No message has been sent and no sample has been promised.
