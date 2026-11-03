# Pi 3 / Music Assistant field report — 1 November 2026

Evidence source: owner-operated tests and terminal output shared during development. These observations were not independently repeated by the development environment. Private server addresses, player MACs, room/device names and credentials are intentionally omitted.

## Observed on the owner's setup

- Raspberry Pi 3 Model B+ with approximately 905 MiB OS-visible RAM; Raspberry Pi OS Lite ARM64 deployment and HDMI kiosk started.
- A real Music Assistant server reported version **2.10.9**, schema **65**. Token-authenticated player enumeration succeeded.
- TuneBox displayed real playback after selecting the actual player ID.
- Distro Squeezelite **2.0.0-1517** registered with MA. Audible playback through `plughw:CARD=Headphones,DEV=0` (the built-in 3.5 mm output) was reported.
- Group playback with a Volumio Rivo was reported. Relative delay was noticed; synchronisation/drift was not measured.
- Audio continued during a staged test with Squeezelite alone, then the backend, then the kiosk. This is a short functional observation, not endurance acceptance.

## Problems still open

- Earlier track changes and stream termination produced silence. Logs showed stream EOF, decoder completion and eventual output underrun while the control connection stayed active. Cause and lasting resolution are unproven.
- The legacy Squeezelite init service left a process behind; a separate foreground systemd service was used for diagnosis. Avoid running two player instances.
- Player visibility was intermittent during manual/background-service changes. Reboot/reconnect recovery remains unverified.
- The Pi reported **`throttled=0x50005`**: active undervoltage and throttling, plus historical flags. Resolve the power/cable issue before reliable performance conclusions.
- The kiosk mouse stuttered significantly. Graphics acceleration, frame rate and resource use need measurement with a stable supply.
- A kiosk console override (`StandardInput=tty-force`, `TTYVHangup=no`) was applied during the owner's test after an early HUP exit. The default repository unit has not yet incorporated or independently validated that fix.

## Not established

Louder HAT compatibility/audio, output power, distortion, bit-perfect playback, synchronised multiroom accuracy, final DSI/touch behaviour, physical button/LED/sensors, controller firmware and electrical fail-safe operation have **not** been validated. Phase 5 is incomplete. Source browsing, recommendations, artwork and queue editing in the new UI still need real MA API integration.

Use the [audio bench guide](pi-audio-bench.md) and [hardware gate](hardware.md) for the next checks. A HAT sample would enable the intended amplifier integration; it would not by itself resolve the Pi's power or kiosk performance issues.
