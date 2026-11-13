# GUI 3.4 — Timing & sync

The common delay controls the screen only. Music Assistant, Squeezelite, ALSA routing, volume, DSP, GPIO and boot configuration are not modified. This is an application-only signed OTA update for an already configured TuneBox.

## Set the meters to the sound

Open **Settings → Audio & DSP → Timing & sync**. Start with both controls at zero, play a track with clear drum hits, and listen at your normal position.

- **Screen delay** adds 0–2000 ms to local video and every real PCM visualizer, including screen rest. Increase it when the screen leads the audible output.
- **Visualizer fine adjustment** adds −500…+500 ms to the meter delay. The effective delay is clamped at zero: the software cannot know future audio. For example, 250 ms screen delay and −50 ms trim means 250 ms for video and 200 ms for meters.
- **Save** persists the settings on the device. **Cancel** restores the saved values. The preview updates while editing. Audio defaults restore both delays to zero.

These are extra delays, not an automatic measurement of output latency. Squeezelite/ALSA buffering, a grouped output, the 4096-sample analysis window, the meter's attack/release animation and video decoding introduce different delays. Use the trim after setting the common delay. If the meter already arrives late at zero, increasing delay cannot fix that; examine the audio path and analysis/render latency instead. A different output/group can require recalibration. This release has one device-wide timing profile, not a profile per output group.

The browser keeps a bounded queue of actual analysis measurements with monotonic arrival times. Duplicate polls do not postpone frames. Pausing the selected player, a seek, track/source change, stale/missing PCM, hidden display or loss of connection clears the queue. A quiet meter remains quiet rather than replaying an old signal. No audio is predicted or recorded by this queue.

## Link and align a local video

Select a Music Assistant track of known duration, then open **Settings → Audio & DSP → Video**.

1. **Choose video:** upload your own MP4 or WebM. For the Pi 4 and its 1280 × 800 display, start testing with H.264 MP4 at 1280 × 720, 30 fps. The limits are 96 MB per video, 256 MB total and 64 linked tracks. This is a starting test profile, not a measured Pi performance guarantee. Unsupported decoding produces a TuneBox fallback while music continues.
2. **Match timing:** the preview follows the actual audio position. New links match their starts by default. Choose **Match ends** only when the endings of the recordings match. Adjust **Video start correction** or nudge the video back/forward by 0.1 s. A positive offset skips ahead in the video; a negative offset waits before showing its first frame. Different edits, live performances and album versions cannot be made equivalent by a fixed offset.
3. **Watch:** save the settings, open Now Playing and enable Video Artwork. Use Full screen video to enlarge the same player; no second decoder is created. Music Assistant remains the only audio source. The video stays muted.

Each video keeps its own alignment and offset. The common Screen delay still applies afterwards, so changing the output delay does not require editing every track. Existing links without timing metadata retain their previous end alignment and global correction until their timing is changed and saved. Replacing a video starts with a fresh start alignment and zero offset. Deleting a link removes its timing too.

The server checks track identity, file identity and revision before saving timing. It rejects a stale editor or a replaced file instead of applying a correction to another song. Uploads are pinned to the track selected when the upload request starts. Unknown-duration radio cannot be linked. During setup, a track change discards that track's unsaved video correction; shared unsaved settings remain available through Save/Cancel.

## Playback behavior

Video target time is:

```
audio position - screen delay + per-track correction
```

End alignment additionally adds `video duration - audio duration`. Small drift is corrected with a bounded video playback rate of 0.96–1.04; large drift, an explicit seek or pausing repositions the video. The sound itself never changes speed. The clock checks every 125 ms. Video buffering, a slow decoder, Music Assistant position accuracy and network/group delay remain practical limits; this is not sample-accurate multiroom synchronization. A disconnected or sleeping display pauses video. A video that ends early does not stop the music.

## YouTube scope

No YouTube API key or account is required for local video. YouTube as a separate source, including an optional search-key wizard, remains a later feature. Combining a muted YouTube embed with alternate Music Assistant audio is not shipped: see [YouTube Developer Policies, III.I.7](https://developers.google.com/youtube/terms/developer-policies). A future YouTube source must use its own audiovisual playback through the official player.

## Physical acceptance on the Pi

After updating, play a familiar local track and first calibrate the spectrum/meters. Confirm Save/Cancel, normal and standby meters, immediate quiet on pause, and fresh data after wake, seeking and a track change.

Upload the same recording's local video, align it, and check drum hits near the start and near the end. Test pause/resume, seeks in both directions, two linked tracks with different offsets, an unlinked track, full screen and return, offline recovery, and video end. Watch a 720p30 file for at least ten minutes, checking the case/CPU temperature in System status and watching for stutter or growing picture delay. Lower resolution/frame rate if decoding is slow. Validate the HAT and the intended Music Assistant group separately; cloud browser tests cannot measure the Pi's actual speaker latency or certify hardware acceleration.
