# Next controls update — local work and design decisions

Status: the GUI 3.7.0 SETUP candidate was authorized for GitHub and signed preview publication on 17 November 2026, subject to CI. Physical device acceptance remains separate. The published baseline is GUI 3.6.0 CONNECT, release `2026.11.15-connect.1`, commit `cbb7a7e64a78cfb96dad9d07953e05e969d7edaf`. This document distinguishes implemented local changes from proposals and hardware work.

## Implemented locally: pause before a manual installation

The owner chose: **manual installation pauses music; scheduled updates wait for idle**.

- An explicit **Install update** first checks that a candidate and configured manager exist. Invalid requests, a locked PIN session, unknown playback, faults, a measurement, Bluetooth activity or an existing room change cannot initiate this pause.
- An independent TuneBox receives one Music Assistant pause command. The backend waits for reported playback to stop before submitting the unchanged, fixed root-manager install request. It does not alter a queue, player selection, volume or group membership.
- If TuneBox shares a group, the interface names the affected outputs and offers **Pause rooms and install** or **Cancel**. Confirmation is bound to the room graph, including the selected player. A changed graph requires a fresh confirmation before any pause command.
- An independently playing remote player is never paused just to make the local updater eligible. If that remote player is the selected view, the user is asked to select TuneBox. A locally selected, idle TuneBox can update while an unrelated Rivo continues.
- The button shows preparation feedback. Duplicate installs and conflicting playback/room/device requests are rejected while this preparation runs. API reads and screen activity remain available.
- Failed or unconfirmed pausing does not start installation. A subsequent updater failure leaves music paused; there is no surprise resume or repeated pause request.
- The root updater's automatic timer and `canUpdate` gates are unchanged. Scheduled checks never call the new manual pause path. Resuming music during a download can still defer activation at the existing final readiness check.

The owner still needs to test this with the actual Music Assistant/Squeezelite devices after a separately approved test OTA. The separate report of Rivo stopping when TuneBox powers off is not fixed by this change.

Local validation on 16 November: all **273 Node tests and production build**, **27 Chromium browser journeys** (appliance settings, updates/rollback, the new manual flow and multiroom) and **7 targeted WebKit journeys** passed. The new HTTP checks exercise nonce/origin/PIN rejection without pausing playback; the room-service fixtures cover correct local/leader targeting, graph changes, failures and no resume/retry. These are software fixtures, not real Music Assistant group/audio tests.

The published entry bundle is 641,123 bytes; this local draft is 646,971 bytes (+0.91%). The feature adds no periodic polling/timers; its short wait is bounded and active only during a manual install request. Actual Pi response/CPU/power measurements remain open. Choose a new release ID/cache revision and complete the release review before any future publication.

## Implemented locally: independent setup, automatic sound and synchronization

The former genre-DSP and timing-calibration proposals are now implemented in the local GUI 3.7.0 SETUP candidate. See [the actual flow, policies and native integration](setup-automation.md) and [its separate validation record](setup-validation.md). Connection setup is additive, with optional, reopenable Music Assistant, sound and synchronization journeys. Existing warm/flat/custom choices are preserved. The new automatic voicing is opt-in and bounded against a saved reference; synchronization uses the real PCM path and USB microphone energy, with explicit review before saving a context-specific profile.

The 273-test / browser results and 646,971-byte bundle above describe the **earlier controls-only snapshot**. They do not certify the later wizard implementation. Its current software counts, bundle comparison, blocked browser/package checks and remaining Pi acceptance are recorded separately. The owner authorized publication of this candidate on 17 November 2026; CI and physical device acceptance are recorded separately.

## Remote control proposal

Build a phone/tablet web remote first, reusing the playback, queue, rooms and event APIs. Use a portrait layout with large transport/volume controls and search. Avoid loading a second full wall dashboard or analysing PCM twice. Add an installed web-app presentation where a trusted HTTPS origin is available.

Pair a remote explicitly with a short-lived, one-use QR challenge on TuneBox. Persist only bounded, revocable device sessions, with separate playback and administrator privileges. Protect settings with the owner PIN; use HTTPS for persistent remote credentials. Do not expose an unauthenticated listener merely by changing `HOST`, and do not open router ports. Internet control can be a separate private-VPN option.

Current hotspot pairing is for provisioning, and does not by itself implement permanent remote authorization. This remote is not yet built or enabled.

## Cooling and power proposal

The identified Louder amplifier is TAS5825M. A CPU temperature or a Louder thermal fault bit is not an aluminium-backplate temperature reading. No backplate sensor, fan model, supply rail or wiring has been selected yet.

Prefer a four-wire PWM fan with tachometer feedback and a controller that can enforce its own temperature/failure behavior. An extra general-purpose microcontroller is optional. A dedicated controller must actually provide autonomous thermal control/watchdog behavior; a PWM expander alone does not provide that protection. Check available GPIO/I2C resources alongside the HAT and existing sensors before choosing hardware. Fan power comes from a verified regulated rail appropriate for that fan; a Pi GPIO provides a signal, not motor power.

- **Auto:** increase cooling with temperature while retaining speaker, supply, digital gain and fault limits. This does not enable an uncalibrated maximum-watt setting.
- **Silent:** prefer passive cooling, then gradually lower the local gain ceiling at a measured backplate threshold. Show requested volume and an active thermal ceiling separately. A hard overtemperature/fault still overrides the preference for silence.
- Apply hysteresis and dwell times to avoid fan/volume hunting. When cooling recovers, relax the allowable ceiling without automatically making the current playback louder.
- A missing/stale sensor or stopped expected fan triggers a defined safe state and a hardware alert. This must be enforced below the browser. DSP changes, standby restoration, Bluetooth transitions and measurement output must all respect the same local gain ceiling.

Choose thresholds only after sensor placement, thermal coupling, case surface requirements and hardware limits are known. Sensor mounting, PWM voltage/polarity, tach pulses, fan-start behavior, failure behavior, noise and thermal derating all need physical tests. No simulated telemetry certifies available amplifier watts or thermal safety.

## Splash ownership

The owner will create the splash in Canva. The later instruction to leave it alone supersedes the requests to add version text and **Powered by Sonocotta** in application code. This work makes no splash or branding changes.
