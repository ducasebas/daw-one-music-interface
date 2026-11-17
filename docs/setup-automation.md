# Independent setup, automatic sound and measured synchronization

Owner-approved candidate: **GUI 3.7.0 · SETUP**, `2026.11.16-setup.1`. Publication was authorized on 17 November 2026 and is gated on the full GitHub Verify/signing workflows. The previously verified signed preview is GUI 3.6.0 CONNECT. Physical installation/acceptance is not implied by publication. See [validation and remaining device checks](setup-validation.md).

## First start

The basic flow is **Welcome → Connections → Your next step → Finish setup**.

Connections are independent. Users can configure Wi-Fi, Ethernet, Bluetooth and Music Assistant together, keep an existing connection, add another later, or finish the basic setup without a music source. Internet connectivity is not confused with Music Assistant availability. Ethernet is recognized directly. Wi-Fi uses the existing scanning, on-screen password keyboard and explicit interruption confirmation.

The next-step screen offers optional Music Assistant, Sound & DSP, picture/meter synchronization and the existing YouTube Music setup. Finishing without these steps is allowed. **Skip for now** and **Finish later** keep a usable exit. Deferring an offline screen dismisses it for that session without claiming that offline settings were saved. PIN protection is retained.

All wizards can be reopened from Settings:

| Wizard | Location | What it does |
| --- | --- | --- |
| Basic first start | System | Reopens the three-step overview |
| Wi-Fi & network | Connections | Scans and joins networks; Ethernet and phone provisioning remain available |
| Bluetooth | Connections | Pairs a phone using the existing receiver and code confirmation |
| Music Assistant | Connections | Tests the server, selects the local player and asks whether playback control is allowed |
| Sound & DSP | Audio & DSP | Optional speaker data, an optional room measurement, listening preference and confirmation |
| Picture & meter sync | Audio & DSP | Measures timing with music and a USB microphone; saves an output-specific profile |

Both Bluetooth and Music Assistant configurations remain available. The local amplifier plays one audio source at a time; switching into Bluetooth retains the existing idle/group/volume checks. Setting up another connection does not automatically replace a queue or start playback. Without Music Assistant, entry into Bluetooth still requires a verifiably idle ALSA output.

The Music Assistant wizard keeps tokens only in component memory and the existing protected server configuration. A slow read-only connection test can be skipped; its late response cannot reopen a completed step. A mutating save remains pending until it finishes. YouTube account credentials stay in Music Assistant as described in [YouTube setup](youtube-music.md).

## Sound and DSP

Speaker impedance and RMS ratings are optional. They guide the controls; a digital volume ceiling is **not** a calibrated watt limit. Unknown speakers retain a conservative ceiling unless the owner explicitly configured another one.

A genuinely flat new installation gets the warm starting curve once when basic setup is finished or deferred. An existing custom EQ, an explicit Flat/Keep choice, an already reviewed starting sound, active calibration or unavailable hardware prevents this initialization. A manually selected DSP setup is not replaced when the basic wizard finishes.

Automatic sound is opt-in. Its four profiles are **Reference, Warm, Bass focus and Vocal clarity**. Users choose a fixed preference or follow Music Assistant genre metadata, with a chosen fallback and strength. The current mappings are explicit rules: electronic/dance/hip-hop favors Bass focus, acoustic/vocal favors Vocal clarity, jazz/ambient favors Warm, and classical favors Reference. Missing or equally strong conflicting tags use the fallback. Bluetooth uses the fallback rather than guessing its genre.

The controller saves the actual effective EQ baseline. Factory Warm is recognized as a listening target so it is not stacked twice; a separately measured or custom baseline is preserved. Room measurement can provide a neutral correction first, followed by the chosen listening target.

Automatic voicing changes bands by at most 3 dB **downward relative to that baseline**, with bounded one-dB ramp frames. It adds no positive band boost or automatic gain increase. Existing Louder headroom enforcement can retain or add channel attenuation when a custom boosted baseline requires it. Inactive latent EQ boosts are normalized while EQ is off; restoring an inactive curve turns EQ off before putting those values back.

Changes follow the local TuneBox audio, even when the interface is viewing another room. Followers can use their actual group leader's track metadata. They do not use an unrelated selected remote track. Genre changes apply at a track/source boundary, not continuously from late metadata. Bluetooth entry uses the fallback, and return to Music Assistant restores genre following.

External EQ changes stop automation and are preserved. Source interruptions, faults, standby and measurement gates stop or defer adjustment. **Switch to manual sound** restores the saved original EQ if the controller still owns the current values. Room sweeps and manual baseline changes require manual mode first. An explicit rollback also requires manual mode so the older interface does not inherit automation it cannot control.

## Automatic synchronization

The synchronization wizard uses the **actual Squeezelite PCM-analysis reference and a real USB microphone during the same playing music path**. It does not infer Squeezelite latency from a separate `aplay` room sweep, and does not move the audio route, volume, queue, group or playback position.

1. Play music with clear, irregular dynamics on the local TuneBox. Keep the song, volume, output and microphone position fixed.
2. Select the USB microphone and explicitly allow a 12-second energy measurement. A known microphone input latency can be entered; leave it at zero if unknown.
3. The browser estimates reference delivery/render delay. The native helper timestamps PCM and rolling microphone energy on the same monotonic clock, then searches for a stable correlation.
4. Silence, clipping, large capture chunks, ambiguous periodic signals, drifting timing, stale PCM and source/volume/track changes reject the measurement. Stop/exit cancels this wizard's capture. No successful result is invented in simulation or without hardware.
5. Review the estimated delay, uncertainty and signal match, optionally fine-tune it, then choose **Use measured timing**. Measurement alone does not activate a profile.

The capture retains rolling squared samples briefly in memory to calculate energy. No raw microphone recording is saved or sent to the browser. The on-demand service is not enabled to record at boot and always closes its input on completion, failure or cancellation.

A saved profile matches the local hardware route, sample rate, leader and group membership. Another output or group falls back to manual timing until calibrated. A selected remote player or Bluetooth does not receive TuneBox's PCM timing profile. Storage is bounded and survives restart; a failed write cannot activate an unsaved profile. Fine adjustment belongs to that profile rather than carrying an unrelated old manual offset into a measurement.

Unknown USB input latency, acoustic reflections, microphone position and rendering variability remain uncertainty. This is a measured alignment estimate, not certified absolute output latency or an acoustic calibration of the speakers. The final listening-position adjustment and physical USB-capture behavior still need device acceptance.

The profile can optionally supply the shared output delay for video artwork. It cannot remove YouTube advertisements, align a different recording or identify a music-video intro automatically. Existing per-track video alignment remains available; YouTube synchronization is best effort.

## Operation and installation

The automatic DSP dispatcher is event-driven and coalesces track changes. It does not send a root command on every playback-clock update. Extra local queue metadata is requested only for changed local media when another room is selected. Microphone capture, fast status reads and browser delay sampling run only in the open synchronization journey. The three optional wizard modules remain lazy-loaded and included in the static offline inventory; device APIs, tokens and captures are not service-worker assets.

The new fixed native commands are validated by the existing owner/PIN and control-nonce paths. Browser requests supply settings and a USB input ID, never arbitrary ALSA control IDs for automatic voicing, filesystem paths or shell commands. A dedicated restricted service runs capture with a bounded duration and resource budget. Updates are blocked during synchronization. Manual-install pausing and scheduled idle-only OTA retain their existing behavior.

After a separately approved release, installations that already enabled signed appliance maintenance receive the manager modules and on-demand capture service through that maintenance path. App-only installations need the existing verified **complete device refresh** before these native capabilities become available. A missing helper is reported as unsupported and can be skipped. No device installation was performed while preparing this candidate. The owner subsequently authorized signed preview publication. The owner-controlled Canva splash is unchanged.
