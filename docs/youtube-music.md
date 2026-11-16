# YouTube Music and video setup — local candidate

This integration is being prepared locally. It has not been published, deployed or tested with the owner's account or Raspberry Pi. The owner has deferred the separate issue where Rivo stops after TuneBox is switched off; this wizard does not change group leadership or shutdown behavior.

## Account and library

Open **Settings → Connections → YouTube Music → Set up YouTube Music**. The same wizard is available under **Audio & DSP → Video** and on the final page of first-start setup.

The account step reads the actual YouTube Music sources from the connected Music Assistant server. A running, available source is shown as accepted by Music Assistant. A saved configuration alone is insufficient. Missing Premium, expired authentication and an unavailable PO Token server have separate messages when Music Assistant reports those failures. Permission failures and an offline server are never represented as a successful account connection.

For a new or expired account, choose **Connect or repair account**. Open the Music Assistant address from the displayed QR code on another device, or type it on a computer. In Music Assistant, open **Settings → Music sources → YouTube Music** and follow its setup instructions. Return to TuneBox and choose **Check account**. The wizard also rechecks every five seconds while that handoff is open and visible.

This is deliberately a handoff to Music Assistant's account setup, rather than a pretend Google OAuth button. Music Assistant's documented YouTube Music integration currently needs Premium, an account cookie and its PO Token service. The cookie stays in Music Assistant: TuneBox does not request, proxy, copy or log the Google password or cookie. Installing that token service and entering the cookie are still performed in Music Assistant; this update does not silently install another service on the Pi.

Music Assistant validates Premium while initializing its YouTube Music provider in the reviewed implementation. TuneBox reports **Account accepted by Music Assistant**, rather than claiming an independent Google billing check. No free-account support or permanent validity is promised. The provider can need reauthentication later.

Your Music Assistant library and playlists continue to appear in **My music**, using the existing Music Assistant library integration. TuneBox does not create a second account library or require a shared YouTube API key. Library imports may take time after connecting the source.

## Player and video

1. Choose which existing Music Assistant player the video should follow. Choosing it changes TuneBox's selected view, without sending play, volume, stop or grouping commands. The ALSA output, Squeezelite MAC and default device setup are unchanged.
2. Explicitly enable **Allow YouTube video** before a player or YouTube script is loaded. The wizard explains the connection to Google's services and links to Google's privacy policy. The Music Assistant account does not sign the separate embedded player into Premium; ads and embed restrictions can still apply.
3. Optionally enable **Follow YouTube Music tracks automatically**. Only the exact YouTube recording ID supplied in the current Music Assistant track/provider mapping is used. A title is never used to guess a different performance. An album version may contain only a still image.
4. Alternatively, enter a YouTube video URL for the current track. This overrides automatic matching for that track. Supported input is a valid video ID or a recognized HTTPS YouTube/youtu.be watch, short, live or embed link. Playlists alone and arbitrary frame URLs are rejected.
5. Use the timing preview, **Match starts** or **Match ends**, and the per-track correction. Choose **Save and continue**. The shared screen delay remains the same as local-video timing. This never moves the Music Assistant audio clock.
6. Open **Now Playing → Video Artwork**. Full screen retains the same player instance. Pause, seeking, track changes, screen rest, visibility loss and disconnection affect only video presentation. Removing a video while automatic matching is on suppresses that track's automatic link, rather than immediately putting it back.

The official IFrame player receives its normal video; TuneBox uses its mute and zero-volume controls. There is no stream extraction, audio replacement in the embedded media, ad filtering or hidden/background YouTube playback. The iframe cannot open appliance browser tabs or request native full screen. TuneBox supplies its own full screen container. The frame sends an origin referrer so YouTube can identify the application, avoiding the missing-referrer class of error 153.

Video timing is best effort. YouTube buffering, ads, seek precision and differences between recordings prevent a guarantee of sample-accurate or frame-accurate synchronization. Corrections use bounded seeks; the IFrame API does not support the fine playback-rate adjustment used for local files. A blocked autoplay request offers **Start silent video**. Private videos, disabled embedding, decode failures, missing connectivity and loading timeouts receive owned feedback; none pauses Music Assistant.

YouTube's own branding, playback restrictions and ads remain. The appliance hides browser chrome; it does not pretend that the YouTube player is TuneBox's own licensed streaming service. For a clean presentation with predictable timing, user-owned local MP4/WebM remains available.

## Persistence, permissions and rollback

- `youtube.json` contains only the selected source ID, consent, automatic-follow choice and revision, with mode `0600`. It contains no Google credentials or API keys. API reads use `no-store` and never enter the offline cache.
- Saving settings, linking video and saving timing require the existing control nonce, same-origin checks and an unlocked PIN session when PIN protection is enabled. URLs cannot select arbitrary hosts or local files. Track identity and revisions guard against stale changes.
- Only source checks run during account setup; there is no new global provider poll. The player and wizard are lazy chunks. Static chunks can be precached for first-use offline access; YouTube resources and live account data cannot.
- Factory setup reset revokes TuneBox's saved YouTube consent. It does not revoke or remove an account on a separate Music Assistant server. Existing media files remain under the existing reset policy.
- Previous TuneBox versions ignore YouTube video entries and keep their local-file validation; their existing local media entries remain readable. Reverting application code cannot undo a source added directly in Music Assistant.

## Validation still required on hardware

Software fixtures can check commands, state changes, privacy defaults and UI layout. They cannot prove Google's acceptance of a particular account, the user's Music Assistant permissions, availability of a chosen video, real Pi decoding speed, physical audio alignment or continuous mute behavior inside an actual Google iframe. After an explicitly approved preview OTA, verify account linkage, library import, video and ads, pause/seek, standby/wake, local/remote room selection, CPU/temperature and actual acoustic synchronization on the Pi. Do not provoke the unresolved power fault.

## Sources reviewed

- [Music Assistant: YouTube Music setup and limitations](https://www.music-assistant.io/music-providers/youtube-music/).
- [Reviewed Music Assistant provider initialization and Premium validation](https://github.com/music-assistant/server/blob/ae091818e23082f825f34102c9cf8fc2f3cffb01/music_assistant/providers/ytmusic/__init__.py).
- [Reviewed source configuration API](https://github.com/music-assistant/server/blob/ae091818e23082f825f34102c9cf8fc2f3cffb01/music_assistant/controllers/config/providers.py) and [running provider API](https://github.com/music-assistant/server/blob/ae091818e23082f825f34102c9cf8fc2f3cffb01/music_assistant/mass.py).
- [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference), [player parameters](https://developers.google.com/youtube/player_parameters) and [developer policies](https://developers.google.com/youtube/terms/developer-policies).

