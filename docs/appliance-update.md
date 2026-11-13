# GUI 3.3 — music appliance

This release makes the 1280 × 800 display the primary music control surface. Track tiles start playback directly, queue entries can be selected, and ordinary playback controls use feedback on the touched control. Header navigation is centred and includes Now Playing, Discover, My music, Search, Queue and Rooms. The TuneBox wordmark returns to Now Playing and carries the splash underline.

Settings has five groups, with related sections together on a scrolling page: Playback; Audio & DSP (including room measurement and video); Display (including presence and appearance); Connections; System (including sensors, security, updates, date/time, language and developer tools). Save/Cancel remains visible and preserves concurrent-edit protection. Notifications open the first actionable category and link to the correct section. A locked settings session has a dot and an Unlock prompt; the PIN itself does not expire.

Opening Wi-Fi setup scans networks. Selecting an SSID opens a password dialog and the full screen QWERTY keyboard, which includes digits and symbols. Search opens the same keyboard; New search clears the old query and opens entry. Secret fields use masked appliance text inputs. Native translation, password save/fill, permissions, extension, promotion and related policies are applied by the complete device update.

Spectrum bass bands integrate fractional FFT-bin power so the narrow second band is no longer absent. The UI animates transforms between actual readings, without synthesising audio samples. Paused displays rest at the bottom of the scale instead of exposing export state. Larger dials and meters, live/coalesced drag volume, one final scrub seek, and muted full screen local video are included. Album years appear when Music Assistant supplies them.

Updates show Software version, Check for updates, a check animation, a relative last-check age and a green up-to-date mark. The channel publisher verifies that the actual public channel selects the release after upload.

## One complete device refresh

The previous updater intentionally updated only the application and preserved kiosk.sh. It cannot retroactively install root-managed Chromium policy through an app change. After installing this signed release, pause music and apply the complete signed device refresh once:

    sudo bash /opt/daw-one/deploy/update-appliance.sh --check
    sudo bash /opt/daw-one/deploy/update-appliance.sh --apply

The refresh verifies the release inventory and root ownership, retains the selected network, Music Assistant configuration, PCM source and audio routing, installs the browser/display layer, keeps the virtual console while hiding ordinary boot messages, and bounds persistent boot logs. It opts this installation into host-layer maintenance on later signed OTA releases. These host changes are compatible with the previous app; app rollback does not undo Chromium policies or boot logging. No signing private key is needed on the Pi.

A physical cold-start/reveal test and actual Music Assistant playback remain device acceptance checks. Local tests cannot certify Pi electrical hardware or replace testing on the owner's server.

## YouTube follow-up

Use the official YouTube embedded player, with a deliberate per-track video selection first. Keep Music Assistant audio authoritative and mute embedded audio; send pause/seek to the audio player, then align video to observed position with a stored offset. Full screen belongs to the TuneBox surface. Do not treat title search or equal durations as proof that two versions match. Ads, blocked embeds, buffering and unavailable videos must leave the audio playing and expose a calm fallback.

Manual video IDs need no Data API key. Optional automatic suggestions should use a server-held restricted YouTube Data API key and cached results; never forward Music Assistant tokens to YouTube. Setup should make this optional and distinguish candidate search from a verified sync match. Actual embedded playback and synchronization need hardware acceptance before claiming YouTube support.

## Validation for this update

The local checks passed: 175 Node tests and the production build, 28 Python tests, and all 98 Chromium browser tests. All 9 production/offline tests and all 10 WebKit wall-display tests passed. Production/offline tests cover cached startup animation, real video decoding and byte ranges, editable offline preferences, the six legacy skins and installed help. Browser coverage includes all five settings groups and fifteen topics across six skins, checkbox Save/Cancel and clipping, live volume drag, a final seek request, direct track selection, notification routing, Wi-Fi/password/keyboard flow, silent meters and muted full screen video.

Music Assistant command tests use protocol fixtures. Managed Chromium policy is checked against the documented version-specific policy contract; it still needs verification in the installed Pi browser. The complete device refresh and cold-boot brightness transition require a physical device acceptance test. YouTube playback/synchronization is a follow-up, not an enabled feature in this release.
