# True shuffle: proposal

Status: proposal only, nothing implemented. The owner asked on 22 November 2026 how to implement a "real shuffle".

## Why Music Assistant's shuffle feels repetitive

Music Assistant's shuffle reorders the queue at random. Two things make that feel "not random":

- **Clustering.** A truly random order often puts the same artist or album next to each other.
- **Re-shuffles.** Adding songs or "Keep playing" can bring recently heard tracks back early.

People expect a *spread* shuffle: every song once before any repeats, and no artist or album twice in a row where avoidable. Spotify moved to this kind of balanced shuffle for the same reason.

## Proposed TuneBox shuffle

1. **One pass, no repeats.** Take the upcoming queue items (after the current track) and shuffle them once with Fisher–Yates.
2. **Spread.** Repair the order so the same artist is at least *k* tracks apart (k = min(3, number of artists − 1)), and no two neighbours share an album. Use a greedy pass that picks the next item from the artist that waited longest. This is the "balanced shuffle" approach: it keeps randomness but avoids clusters.
3. **Memory.** Keep the IDs of the last 50 played tracks (in the state directory). When the queue is refilled by Keep playing, those tracks move to the end.
4. **Apply through Music Assistant.** Write the new order with `player_queues/move_item` for each moved item, or replace the upcoming part with one `play_media` call (option "replace next"). Only for TuneBox's own queue, never another room's.
5. **UI.** A shuffle button in the queue view with three states: Off · Shuffle (Music Assistant) · True shuffle. The current track keeps playing; only the upcoming order changes.

## Open points to check on the real Music Assistant

- Which of the two write paths is faster and gap-free on the owner's version: per-item moves, or one "replace next".
- Whether a long queue (several hundred items) stays responsive.
- How Keep playing appends items, and whether the spread should run again after each refill.

The work would be one new shared module with its own unit tests (no repeats, artist spacing, determinism with a seed), a queue button and a browser test. Expected size: one update.
