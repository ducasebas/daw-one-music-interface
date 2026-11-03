# Pi audio bench: Squeezelite with Music Assistant

This is an optional real-audio experiment, separate from the simulated amplifier. It does not configure a Louder HAT, GPIO, boot overlays or electrical protection. Keep MA on the server. Resolve undervoltage before endurance/synchronisation testing.

1. Enable the **Squeezelite player provider** in Music Assistant. Confirm its Slimproto port (default TCP/UDP 3483). For Docker, check the actual host/container networking and reachable stream URLs as well as the web port; do not assume exposing 8095 is enough.
2. On the Pi, install `squeezelite` and `alsa-utils` from the distribution. Inspect `squeezelite -?`, `aplay -l`, `squeezelite -l` and `/etc/default/squeezelite`.
3. Select the enumerated ALSA device by its actual card name. On the owner's Pi 3, the built-in jack was `plughw:CARD=Headphones,DEV=0`; this is an observation, not a universal card guarantee. Start with low playback/external amplifier volume.
4. Configure the distro defaults: `SL_NAME="DAW TuneBox v1"`, `SL_SOUNDCARD="YOUR_ENUMERATED_ALSA_DEVICE"`, `SB_SERVER_IP="YOUR_MA_HOST"`. Start the distribution service and inspect process arguments. Do not copy the owner's private host or MAC address.
5. If the old init service leaves orphan processes, stop it and verify no other Squeezelite process remains before running a single foreground diagnostic. A manual terminal process ends with its terminal/session; it is not persistent installation. A dedicated foreground systemd unit is an alternative requiring an actual service user with audio-device permission. Never run both units.
6. Discover the new player's exact ID through the token-authenticated MA player list. Set `MA_PLAYER_ID` in `/etc/daw-one.env`; the UI does not automatically switch from the previously selected Rivo. Keep `MA_ALLOW_CONTROL=false` for initial observation, then explicitly enable control when ready.

Backend example (edit privately on the Pi; never commit credentials):

```ini
DAW_PLAYBACK_MODE=music-assistant
MA_URL=http://YOUR_MA_HOST:8095/ws
MA_TOKEN_FILE=/etc/daw-one/music-assistant.token
MA_PLAYER_ID=YOUR_TUNEBOX_PLAYER_ID
MA_ALLOW_CONTROL=false
MA_VOLUME_LIMIT=40
```

The token file must be readable by the `dawone` backend account (root:dawone, 0640, parent directory 0750). `/etc/daw-one.env` can be root-owned 0600 because systemd loads it. A standalone Node diagnostic does not read this file unless explicitly coded to do so.

## Test before calling it reliable

Check playback solo before grouping. Record play/pause, next/previous, multiple track transitions, source/format changes, stream reachability, reboot/reconnect, long runs and CPU/RAM/temperature/throttling. Group only compatible player protocols; a shared group is not proof of measured synchronisation. Correct a constant delay only after stable playback; measure drift separately.

Collect bounded logs without tokens, full stream URLs or personal track/account data. Stream EOF followed by decoder completion and underrun is not by itself proof of CPU starvation. Check MA stream/source logs and compare playback with kiosk stopped, backend started and kiosk started. Do not change multiple settings simultaneously.

`sudo systemctl stop daw-one-kiosk.service` stops the display only. `sudo systemctl stop daw-one.service` stops the controller backend, not a separately managed Squeezelite service. See the [field report](field-test-2026-11-01.md) for unresolved findings.
