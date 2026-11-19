# GUI 3.11.3 · QUEUE — ask before replacing a queue

Release `2026.11.19-lively.4`, cache 57. Local candidate; it needs the owner's approval before push or publication.

## Request
The owner (19 November 2026): "Maar wat als iemand anders wat in de queue had gezet? Dan overschrijft endless dat dus, moet wel een waarschuwing en playlater (create playlist) optie aan vooraf gaan".

Answer given: "Keep the music playing" only adds tracks once the queue has run out; it never overwrites. "Play now" from search did replace the whole queue. The owner agreed to a guard: "Ja graag".

## Change
- **Server-side guard:** `MusicLibrary.enqueue(..., 'replace')` refuses with 409 `queue-not-empty` (and the count) while tracks are queued after the current one, unless the request sends `confirmReplace: true`. `next` and `add` never ask. An empty queue, or only the current track, plays straight away. This covers the wall screen, the legacy screen and the phone remote.
- **Wall screen:** a dialog with Play next · Add to the end · Save queue as playlist, then play · Replace the queue · Cancel.
- **Save as playlist** (`POST /api/library/save-queue`):
  - reads `player_queues/get` and `player_queues/items` (from the current index, max 500);
  - then calls `music/playlists/create_playlist` and `music/playlists/add_playlist_tracks`.
  - If any step fails, nothing is replaced and the dialog shows the error. A successful save is confirmed in the player bar on Now Playing.
- **Phone remote:** the same question (Play next · Add to the end · Replace the queue · Cancel). `remoteQueueOptions` now includes `next`, and `confirmReplace` is accepted.

## Validation (simulator/unit only)
- `music-library.test.js`: the guard sends nothing before a choice, next/add pass, confirm replaces, a single current track does not ask, and the playlist is saved from the current index with failures reported.
- `connect.spec.js`: the dialog appears, Play next keeps the queue, and save → replace with the confirmation shown in the player bar.
- `lively.spec.js`: the phone remote sheet → Add to the end.
- **Not verified on the owner's server:** the playlist commands (`create_playlist` / `add_playlist_tracks`) and which provider stores the playlist (normally the Music Assistant library).
