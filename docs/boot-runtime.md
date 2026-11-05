# Boot checks implementation — GUI 2.9

The [agreed flow](boot-flow-proposal.md) now has shared software checks, paged UI, a bounded startup preparation hook and a simulated cold-boot radio decision. **This does not implement physical PD negotiation, GPIO/fan/backlight control, an early Linux splash, or live radio autoplay.**

## What is connected

- `shared/boot.js`: check/status contract, changed-result logging and one-shot cold-boot radio policy. The device/safety model remains authoritative for simulated amplifier enable.
- Product header **Open opstartcontrole**, or Settings → Startup: three check pages plus Autoradio. Shared theme tokens work across all six skins. Swipe/arrows/select navigation fit the native 1280 × 400 display.
- Startup branding shows real software-check status with explicit simulation attribution. It still uses decoded-first-frame video/fallback and respects Pi3 static/reduced-motion policy. Font and still-image preparation is bounded and does not gate navigation/audio. No whole-library/video preloading is added.
- Simulator Controls → Boot power / Boot devices: PD watts/unknown, USB audio presence, explicit digital-output verification, required fan/RPM and group activity. Existing sensors/network/controller faults remain in the same runtime.
- Startup check transitions appear in the existing timestamped timeline. Repeated identical checks are not logged on every clock tick.

## Mock and live boundaries

Simulation defaults use a labelled 100 W mock contract; initial device output still starts inhibited/unverified. Less than 100 W or unknown contract, and required fan feedback failure, latch a simulated safety fault and block verification. These are simulation/design policies, not validated hardware limits. Automatic scenarios reset mock boot inputs explicitly to make repeated runs deterministic.

In live MA mode, the server uses a read-only 30-second host inventory (CPU temperature, ALSA card presence, network-address presence, exposed fan tach data when available) and the actual MA authenticated/player state. PD contract, optical TOSLINK identity, physical amp verification and display/backlight control stay unavailable without verified drivers. CPU temperature is not enclosure temperature; a network address does not prove Wi-Fi association, DNS or Internet access. A detected ALSA card is not a tested audio route. No pins, I²C registers, ping target or OS boot settings are guessed or written.

Transport errors distinguish MA authentication-required (20), authentication-failed (21) and insufficient-permissions (22) without exposing raw server error details or tokens. Other connection/player-sync failures remain generic until there is sufficient diagnostic evidence.

## Saved optional radio

`POST /api/boot/settings` saves normalized `{radioEnabled, station, volume}`. Default disabled, fixed mock stations `ambient`/`classical`, volume 0–40. Settings take effect on the **next simulated cold boot**, not immediately when saved, on browser reload, reconnect or presence wake. The simulated radio is not a real network audio stream.

The one-shot decision waits for verified, powered, cool, connected simulation state and any required cooling feedback. An existing playing queue/group is left unchanged; a failed initial network/player connection, fault, standby and shutdown cancel the pending decision. No command is retried after that session decision. Device verification cannot be restored by merely restoring inputs or acknowledging a fault.

Real MA autoplay is deliberately blocked, and its settings endpoint returns 409 in live mode. A real station catalogue/URI, route-specific verification, source/group-aware queue contract and actual player tests are still required before it can be enabled. Manual live player control continues to use the existing MA APIs; these boot checks do not fabricate amplifier permission.

Persistence: local development uses ignored `.tunebox-state/boot.json`; installed systemd uses dedicated `/var/lib/daw-one-state` via StateDirectory. State files are outside the release archive and public static paths. Installed state directory mode is 0700; JSON writes use a temporary 0600 file plus rename. The updated systemd unit must be installed/reloaded when updating a Pi. Do not confuse this with the optional MA container data directory or put tokens in the boot settings file.

## Test it

1. Run `npm ci && npm run dev`, open `/?gui=2&lab=1`, run Playback.
2. Open product Opstartcontrole; page through all checks and switch skins in Settings.
3. Save Autoradio (simulation), then run Cold boot. Set power good and simulation-verified in Connections; observe one mock radio start and the timeline. Pause/reconnect/wake must not replay it.
4. Enter a 60 W or unknown PD contract in Boot power; amp enable is denied. Restore inputs, acknowledge and perform fresh verification; no automatic radio restart is implied. Run Playback to reset a scenario to its known defaults.
5. Test required fan/absent feedback, temperature, network and controller faults. For a successful required-fan fixture, set positive RPM before marking the fan required.
6. Test backend outage: settings/checks must show unavailable/offline rather than invent current results. A saved radio edit needs the backend; existing ordinary visual preferences remain browser-local.

Run domain tests/build, Chromium journeys and production/offline tests before publishing. Physical DSI darkness/backlight, real sensor values, optical output identity, HAT safety, sound latency and Pi smoothness still require board-level tests. No phase-5 completion is claimed.
