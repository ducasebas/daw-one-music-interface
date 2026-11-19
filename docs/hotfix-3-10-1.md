# GUI 3.10.1 · HOTFIX — seek through the Music Assistant queue

Release `2026.11.19-polish.2`, cache 53. Local candidate; needs the owner's approval before push/publication.

## Problem
After installing 3.10.0 the owner reported "Het scrubben werkt niet". In the simulator, touch drag on the progress bar sends one seek on release (verified with real CDP touch events). The live path required the player to report `seek` in `supported_features` and used `players/cmd/seek`. Confirmed on the owner's Pi on 19 November 2026 (read-only `/api/state` check): the player reports `['play_media','power','volume_set','set_members','enqueue','pause','gapless_playback','multi_device_dsp']`, with no `seek`, while the track has a duration (264 s) and `seekEnabled` is true. The owner sees the bar stay grey ("Blijft grijs gebeurt niks"). That matches the disabled state exactly. Whether `player_queues/seek` actually moves playback on the owner's server is still to be observed after installation.

## Change
- `normalizeMusic` adds a `queue_seek` capability when the player lacks native `seek` but has an active Music Assistant queue and the track has a duration, and exposes the `queueId`.
- `LiveMusicService.control` seeks with `player_queues/seek {queue_id, position}` in that case; native `players/cmd/seek` is still preferred.
- The UI enables the bar for `seek` or `queue_seek`. Live streams without a duration stay non-seekable, and "Allow seeking" is still respected.

## Validation (simulator/unit only)
- `integration.test.js`: capability mapping, `player_queues/seek` command, service route (queue vs native).
- `connect.spec.js`: a `queue_seek`-only player can be scrubbed by touch; without either capability the bar stays disabled.
- On the Pi: not observed.
