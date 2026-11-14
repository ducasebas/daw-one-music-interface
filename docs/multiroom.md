# GUI 3.5.0 — Music Assistant rooms

Release `2026.11.13-multiroom.1`. The owner approved preview publication on 14 November 2026. Publication still requires successful Verify and signing; the owner's Squeezelite/Rivo hardware has not yet been used to accept this release.

Rooms now reads the actual Music Assistant players instead of the earlier example TuneBox/Rivo cards. Music Assistant supplies synchronization and compatibility. TuneBox does not capture browser audio or attempt to synchronize arbitrary protocols.

## Joining music at startup

After the splash and setup, an idle TuneBox asks whether to listen along with an already-playing compatible room. **Listen together** adds this local endpoint to the existing leader; **Keep separate** sends no player command and is remembered by the kiosk for this Pi boot, including page reloads. The question is skipped when TuneBox is already playing or grouped, and cannot cover an active software installation. Open Rooms remains available for manual control.

If Rivo is playing, joining sends only `players/cmd/set_members` with Rivo as `target_player`, this TuneBox as the sole addition and an empty removal list. Rivo keeps its queue, existing members and volume. This is different from Move music. A fixed-volume Rivo may keep its existing 100% level; the new local endpoint must have a known volume within TuneBox's saved limit. PIN protection still applies. The UI waits for confirmed membership and does not replay an uncertain command.

An uninterrupted hot join cannot be promised with the inspected native Squeezelite provider. Its [membership handler](https://github.com/music-assistant/server/blob/ae091818e23082f825f34102c9cf8fc2f3cffb01/music_assistant/providers/squeezelite/player.py#L389) explicitly restarts an active stream session and says late joining into the existing stream is not supported. The GUI warns about a possible brief interruption; the actual gap on the owner's MA/Rivo version remains to be measured. Keeping the Pi/Squeezelite endpoint grouped during local amplifier/display standby avoids requesting another membership change when waking it.

## Using Rooms

- **Control room** changes which room the music screens control. It does not start music, move a queue or change volume.
- **Group rooms** opens a draft with the selected group's leader. Choose compatible members and press **Save group**. Cancel sends no group command. Joining replaces any separate music playing on the joining room.
- **Leave group** asks for confirmation and removes only that member. Other members remain grouped. Permanent members cannot be removed here.
- Each room has its own volume and mute. The selected group also has volume and mute controls. Group level follows the loudest output; lowering the group scales existing levels down together. Raising it moves existing levels upwards, with every individual output capped at the saved TuneBox maximum.
- **Move music** asks for a destination and confirmation. It transfers the current queue and listening position and replaces the destination queue. The latest paused/playing state is preserved.
- An unavailable room remains visible without working playback controls. Read-only connections can select a room for viewing. A settings PIN protects group edits and queue transfers while ordinary playback volume remains available.

Group choices follow Music Assistant's reported compatibility. A room already in another group must leave that group first. Nested group leaders and incompatible providers cannot be added. A transfer requires a real queue and known destination volumes below the saved maximum. TuneBox never silently raises an existing volume ceiling or retries a failed mutation.

Room inventory refreshes on Music Assistant player/queue events, periodically, and when the view regains focus. Saving pins the group topology and transferring also pins the current track. If another controller changes these, the dialog asks you to review the new state. After an accepted command, TuneBox waits for reported player state before confirming success; partial failures show the actual remaining state.

## Local hardware and updates

The Louder DSP and PCM reader remain local to this TuneBox. Selecting Rivo does not reroute the HAT or turn its local PCM into a measurement of Rivo. A local player or its group still playing blocks automatic updates and audible room measurements even when the selected remote room is paused. Unknown local playback status also blocks these operations.

DSP reads now wait for the device connection and an unlocked settings session, and retry when either becomes ready. **Refresh amplifier controls** allows an explicit retry after a failed read. Refresh cannot overwrite a staged DSP edit; Save/Cancel retains its existing behavior and actual ALSA On/Off labels.

A separate display fix clears manually entered screen rest when the backend wakes the screen through SSH, presence or another client. A rejected sleep request also removes the temporary overlay. This is a reproduced GUI defect; it is not a confirmed explanation for the owner's separate, physically unlit display incident that required a cold start.

The WebKit acceptance check also exposed a linked video losing its mute state when expanding. Video artwork now owns both mute and zero video volume, restores them after a browser volume change, and retains them when entering or leaving the full-screen dialog. Music Assistant remains the audio source; the same video element and playback position are retained.

## Validation and hardware acceptance

Automated coverage includes room protocol/compatibility, per-output volume limits, confirmed queue transfers, delayed readback, concurrent controls, stale dialogs, disconnects, nonce/origin/PIN checks and touch workflows at 1280×800. It also exercises delayed DSP connection, PIN-session recovery and remote display wake. These tests use controlled Music Assistant responses, not physical speaker synchronization.

Before accepting on the Pi, use a physically independent display adapter for the current power investigation. At a low listening volume, verify discovery of the real TuneBox/Rivo players, group/leave without disturbing another room, individual/group volume, pause-preserving transfer and recovery after a disconnect. Physical synchronization, power stability and sustained playback remain hardware checks.

Protocol references inspected at pinned upstream revisions:

- [Music Assistant player commands](https://github.com/music-assistant/server/blob/ae091818e23082f825f34102c9cf8fc2f3cffb01/music_assistant/controllers/players/controller.py): `players/cmd/set_members` with `target_player`, `player_ids_to_add` and `player_ids_to_remove`.
- [Music Assistant queue transfer](https://github.com/music-assistant/server/blob/ae091818e23082f825f34102c9cf8fc2f3cffb01/music_assistant/controllers/player_queues/controller.py): `player_queues/transfer` with `source_queue_id`, `target_queue_id` and `auto_play`.
- [Music Assistant frontend API](https://github.com/music-assistant/frontend/blob/48148f52fa0815f6d67b6ec0bb652da8f95ca384/src/plugins/api/index.ts) and [player model](https://github.com/music-assistant/models/blob/bb488debd14ee5bf005fc5d3fddeb955716b2f62/music_assistant_models/player.py).
