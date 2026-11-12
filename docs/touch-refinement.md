# GUI 3.2.3 · TOUCH

Release `2026.11.12-touch.1`, 12 November 2026. Native wall layout: 1280 × 800. The 1280 × 400 legacy layout remains available. Music Assistant credentials, Squeezelite identity, audio routing and the installed PCM reader are retained.

## Settings and everyday controls

Fifteen topics occupy five columns and three rows. Topic buttons size to their contents, with scrollable detail pages and a fixed Save/Cancel bar. The saved check uses an SVG rather than a font glyph. Checkbox edits, including date/presence/display and update-window choices, are compared with their saved values; Cancel resets the preview without creating a phantom DSP change. Save is highlighted when there are changes and the device is reachable.

From a topic, use **All settings** at the top left, then **Now Playing** from the overview. The playback footer stays visible and its current-track area returns directly to Now Playing from every other page. Unsaved changes offer Save and continue, Discard changes, or Stay here. On Now Playing, that return action is inactive.

The circular volume control is 112 × 112 px with a vector arc, a larger readout and touch step controls. Audio & DSP has a larger real PCM preview. On Now Playing, an active visualizer spans the track-detail area rather than being squeezed into the narrow artwork sidebar. Levels remain digital dBFS, not measured speaker watts or analog SPL.

**Playback → Maximum volume** now shows the effective TuneBox control ceiling. An explicit saved change can raise or lower it. Until then, the existing installation limit remains in force (normally 40%). Raising the limit sends no volume command. Restoring Playback defaults returns to the installation limit. This applies to TuneBox commands; another Music Assistant client can still change the remote player.

The header Wi-Fi fan uses three arcs from actual NetworkManager signal data. The percentage remains in the details panel. Unknown signal is not presented as full strength; an app connection alone does not establish Wi-Fi strength.

## Screen rest and browser gestures

The moon button and automatic timeout share local display events. In live mode these bypass Music Assistant control, so one touch wakes the UI even if Music Assistant is disconnected or read-only. Waking changes no playback or amplifier state. Wake feedback remains visible while the request is pending.

Text selection, image dragging and the browser context menu are suppressed on the product surface. Editable inputs retain text editing/selection. Scrolling, volume gestures, file inputs and keyboard navigation remain available.

## Splash diagnosis

The bundled MP4 has four seconds of distinct frames; it is not a still video. **Animation** explicitly requests video even if reduced motion or the automatic low-power policy would otherwise choose a still. Changing preferences no longer resurrects a completed splash. MP4 is attempted first, then WebM; a failed decoder still has a bounded still fallback.

In **Settings → Playback**, select Animation, Save, then Replay startup. Open **Splash diagnostics** afterward. Check renderer `video`, source `startup.mp4` or `startup.webm`, advancing playback time and multiple decoded frames. `still-selected`, `low-power-auto`, `reduced-motion`, `media-error-*` and a stalled clock identify different reasons for a still image. These browser diagnostics are local to the kiosk: opening the interface on a Mac reports that Mac's playback, not the Pi's.

A GIF is unnecessary if the video decoder works and is less efficient for a full-screen 1280 × 800 animation. The physical cold boot/backlight timing still needs the Pi acceptance check.

## OTA acceptance on the configured Pi

The project signing key, preview/auto policy and active `daw-one-update.timer` were set up on the owner's Pi. The trusted runtime-permissions fix was installed separately. There is no need to generate another key or reinstall the PCM reader.

1. Wait for **Verify** and **Publish signed preview** to finish successfully and for a public release with the archive, manifest and signature to exist. A skipped publisher or `no-release` does not mean an update was installed.
2. Stop Music Assistant playback on TuneBox (and its group if grouped). Keep Music Assistant connected. In Settings → Updates, check for updates and install the available signed release. The independent progress page should show download, verification, preparation, restart and health checks.
3. Alternatively, request an immediate automatic check through SSH:

   ```sh
   sudo systemctl start daw-one-update.service
   sudo journalctl -u daw-one-update.service -n 40 --no-pager
   curl -fsS http://127.0.0.1:3001/api/health
   ```

4. Confirm build `2026.11.12-touch.1`, a non-null `deploymentCommit` matching the published release and update status `installed` or subsequently `up-to-date`. A running timer alone is not proof of activation.
5. Resume playback. Confirm the existing MA player, audio jack/HAT route and real PCM spectrum still work. Check a single moon/wake touch, no text selection on double tap, the full splash animation and the saved checkbox/navigation/volume changes.
6. With playback stopped, use Updates → Previous version and its confirmation to exercise rollback. Confirm the earlier health ID/commit; automatic installation pauses after manual rollback. Re-enable the preview auto policy only when ready to return to this release.

Never paste `private.pem`, Music Assistant credentials or the browser control token into diagnostic output. For sanitized update status, use the command in [OTA/PCM commissioning](ota-pcm-setup.md#diagnostics-without-the-browser-control-token).

## Verification

Automated coverage includes local live-mode wake while Music Assistant is unavailable, volume-cap persistence through a backend restart, no implicit volume command on changing the limit, checkbox Save/Cancel, unsaved navigation, tile/content/footer geometry across all six skins, larger PCM/dial geometry, measured Wi-Fi fan levels, video frame progression and retained input/scroll controls. Production offline suites run serially because they share a mutable simulator backend; parallel Cold boot/Playback scenarios were interfering with each other and blocking signed publication.

Software/browser checks do not replace the real Pi acceptance sequence above. The physical PCM spectrum has been confirmed by the owner; cold-boot animation and the first successful OTA/rollback transaction require device results.
