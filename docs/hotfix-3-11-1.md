# GUI 3.11.1 · HOTFIX — mute for players without native mute

Release `2026.11.19-lively.2`, cache 55. Local candidate; it needs the owner's approval before push or publication.

## Problem
The owner's player reports `['play_media','power','volume_set','set_members','enqueue','pause','gapless_playback','multi_device_dsp']`, with no `volume_mute` (read-only check on the Pi, 19 November 2026). The Mute button therefore stayed disabled. The owner confirmed: "Yeah mute doesn't work".

## Change
- `LiveMusicService.applySoftMute`: a single (non-group) player with `volume_set` but no `volume_mute` gets the capability `volume_mute_soft`.
- Mute sets the volume to 0 and remembers the previous level, in memory only. Unmute restores exactly that level, capped by the configured volume limit, and only while the volume is still 0. It never goes louder than before.
- If the volume is raised elsewhere while muted (after a 3 s grace period for late Music Assistant updates), or another player is selected, the soft mute ends. A later unmute sends nothing.
- Native `volume_mute` is still used where the player supports it. Groups keep their existing per-output logic.
- The UI enables the Mute button for `volume_mute` or `volume_mute_soft`. Phone remote mute goes through the same service path.

## Limits
- After a TuneBox service restart while soft-muted, the remembered level is gone. The player then shows volume 0 (not muted), and you raise it yourself. TuneBox never guesses a level.

## Validation (simulator/unit only)
- `integration.test.js`: soft mute → 0, unmute → previous level capped at the limit, raised elsewhere → no jump, native mute still preferred.
- `connect.spec.js`: the Mute button is enabled and sends one mute for a `volume_mute_soft` player, and stays disabled without either capability.
- On the Pi: not observed.
