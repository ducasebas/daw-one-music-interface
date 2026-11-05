# Proposed boot flow — discussion before implementation

Owner requirements collected 4 November 2026. **Shared software checks and simulated autoradio are now implemented; see [implementation](boot-runtime.md). This is not an implemented hardware boot sequence.** Agree the flow before changing skins, splash behaviour or autoplay. Current GPIO/display/sensor hardware remains unverified and disabled. The existing Pi3 startup profile intentionally uses a still.

## Flow

1. **USB-C PD connected.** The selected PD circuit establishes a usable supply independently of Linux. Prove the bootstrap path: a Pi that is not powered cannot negotiate its own first usable supply. Do not infer the contract from the charger label.
2. **HAT/Pi powered, amplifier inhibited.** Power present is separate from audio-output enable. Physical safe defaults must hold through boot/reset before software starts; do not assume the proposed PDN pin or a Linux task guarantees this.
3. **Pi boots with display dark, if supported.** Verify exact DSI panel/backlight behaviour and a supported control path. No automatic boot-file changes, relays or guessed GPIO commands. A browser splash alone cannot hide an earlier Linux console or guarantee the panel is off.
4. **Local backend and renderer ready.** Prepare minimum branding, fonts, icons, current screen and cached settings. Turn on the display through a verified driver, then start splash from a decoded first frame. Never wait indefinitely for Wi-Fi/MA before showing a usable screen. Display a still when reduced motion/low-power policy requires it; decide whether the Pi3 should get an optional animated profile only after profiling.
5. **Startup checks, concurrent where independent.** Power, outputs/sensors, network and MA checks can run while the splash/local screen is available. Use actual completion and reasons, not fictional percentage progress. Complete splash without making failures invisible; continue to usable Ready/Offline/Attention screens.
6. **Preload narrowly.** Load the current screen, selected theme, current artwork thumbnail and a small next-page cache. Do not load a whole music library, all videos or multiple web interfaces on the Pi3. Failed artwork/network requests cannot block input or audio startup.
7. **Player available.** Squeezelite announces its own real availability by connecting to MA; the React interface must not pretend to be another player. Distinguish MA authenticated, player discovered, player available and actual audio stream/route readiness.
8. **Optional automatic radio.** Default off. Require a saved exact station/media identifier, explicit output/player selection and permitted volume, real route readiness and relevant physical amplifier verification. Do not start audio simply because Wi-Fi, the display or the API reconnects. Avoid replacing a running group queue or waking an unrelated room. Define separate cold-boot/wake behaviour before implementation; never blindly replay a failed command.

## Checks and honest results

| Check | Actual evidence | Failure/unknown behaviour |
| --- | --- | --- |
| PD contract and input budget | If the exact PD controller supports it, read negotiated voltage/current via **I²C**, not I²S. Compare the contract budget to the owner's proposed 100 W target | Show “100 W not confirmed” or the confirmed smaller budget. Do not claim consumed watts prove a 5 A contract. No invented readback register/API or automatic maximum amplifier enable |
| Power measurement | Calibrated sensor data such as INA228, distinct from contract | Unknown/stale when absent; do not display 0 W as a successful measurement |
| USB and audio outputs | Enumerate actual USB devices and ALSA cards/routes | A USB descriptor/ALSA name does not prove an optical TOSLINK connector. Label USB audio honestly and let the owner select/verify digital output. No silent route change when devices appear/disappear |
| Hardware presence | Compare detected components with an approved expected-hardware profile | Optional missing is informational; required missing/faulted blocks the relevant feature/amp enable. No simulation result presented as a hardware pass |
| Temperature | Real CPU sensor plus separately verified enclosure sensor if fitted | Unknown is not cool. Hardware-specific thresholds/calibration still require agreement and measurement |
| Fan, if fitted | Approved fan control and tach/feedback, if that actual fan supports it | “Not fitted” for an optional absent fan. No invented RPM; “feedback unavailable” for a fan without tach. Treat a required cooling fault using the verified thermal policy |
| Network | Wi-Fi association if used, IP/route, then relevant DNS/service reachability; support Ethernet when present | ICMP ping alone is not proof of Internet/MA access and may be blocked. Local settings and explicit offline state remain usable |
| MA | Reachable API, supported handshake, token authentication, exact player and supported actions | Distinguish no network, unreachable server, authentication failure and unavailable player; bounded retries, no unwanted autoplay |

## Screen/state behaviour to agree

- Splash establishes branding; a separate small startup status can show real checks without exposing engineering detail in normal operation.
- A missing 100 W contract must produce a clear power message. Whether a verified lower-power listening mode is possible depends on an implemented hardware power limit; until then keep the affected amplifier inhibited rather than inventing a software safety promise.
- If MA is offline, show retry/settings and retained local settings; do not leave the display black.
- Radio setting needs a choice of exact station, target player, startup volume cap, cold-boot versus presence-wake behaviour and what happens when a group is already playing.
- Log each transition/check result with time and reason. Simulated checks stay explicitly simulated and exercise the same orchestration only once implemented.

## Before skins and implementation

Agree ordering/display timing, failure priorities, power policy and optional-radio semantics. Then implement reusable boot orchestration with mock and real-adapter boundaries; test normal boot, missing/limited PD, unavailable sensors/USB output, thermal/fan fault, Wi-Fi/DNS/MA/auth/player failures, decoded splash/fallback, preload failure, cold boot/wake, reconnect and group-safe autoplay. Finally test all skins, navigation, touch/mouse, pause/volume, sleep/wake and recovery on the actual Pi with stable power. No phase-5 completion is inferred from this proposal.
