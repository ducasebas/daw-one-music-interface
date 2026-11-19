# GUI 3.11.2 · ENDLESS — keep the music playing

Release `2026.11.19-lively.3`, cache 56. Local candidate; it needs the owner's approval before push or publication.

## Request
The owner asked, with high priority: "De track endless mode staat ie nu al aan? Net zag ik niks in de queu verschijnen." It was not implemented yet; the roadmap had it in 3.12. The owner's decision there is on by default, with a switch in Settings → Playback. Follow-up from the owner: "Ma input so make the script check when enabling the option. Tidal Spotify en YouTube".

## Change
- `prefs.keepPlaying`, default `true`.
- `LiveMusicService.wantKeepPlaying` / `syncKeepPlaying` sends `player_queues/dont_stop_the_music {queue_id, dont_stop_the_music_enabled}` when the queue state differs from the preference. It only does this:
  - for TuneBox's own queue, when the selected player and queue are both the configured local player (never a group leader's or another room's queue);
  - when playback control is enabled;
  - once per change, with no retry loop. A refusal is reported as `unsupported`.
- The queue's `dont_stop_the_music_enabled` is exposed as `playback.keepPlaying` (`null` = not reported by this Music Assistant version) and in `publicStatus().keepPlaying {wanted, active, error}`.
- **Check when switching on:** Settings calls `POST /api/music/keep-playing/check` (admin, device token). `checkKeepPlaying` is read-only:
  - it verifies the connection, control, own queue and that the field is reported;
  - it asks Music Assistant `providers` for available sources with `similar_tracks`.
- **Check results:**
  - `ready` (lists e.g. Tidal, Spotify, YouTube Music): the switch stays on, and Save applies it.
  - `no-similar-sources`, `unsupported-version`, `read-only` or `not-own-queue`: the switch flips back off with the reason.
  - `disconnected`, `check-failed` or `sources-unknown`: it stays on and is applied when possible.

## Validation (simulator/unit only)
- `integration.test.js`:
  - own queue only, once per change, no loop;
  - read-only Music Assistant and other rooms' queues untouched;
  - refusal reported once;
  - transport command shape;
  - the check never changes the queue, plus all check reasons.
- `keep-playing.spec.js`: on by default; switching on runs the check and shows the sources; "not possible" flips the switch back and saves off.
- **Not verified:** that the owner's Music Assistant reports `similar_tracks` for Tidal/Spotify/YouTube Music, and that the queue actually fills on the real server.
