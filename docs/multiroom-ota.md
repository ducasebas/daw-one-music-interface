# GUI 3.5.0 — OTA review and device acceptance

Candidate: **GUI 3.5.0 · MULTIROOM**, release `2026.11.13-multiroom.1`.
Base: published commit `799df0392f66298371b23a135984749d313d728d`.

The owner approved publication of this update on 14 November 2026. A local archive and its checksum were prepared for review; they are not an installable signed OTA release. The final archive receives its signature in GitHub Actions after the approved commit passes Verify. Device installation and physical acceptance remain separate steps.

## Included changes

- Actual Music Assistant rooms, compatible groups, individual/group volume and confirmed queue transfers.
- A startup invitation to join an already-playing Rivo. Accepting adds only this TuneBox to Rivo's group. Declining sends no player command and is remembered for this Pi boot.
- DSP controls wait for connection/PIN readiness and offer a refresh after a failed read.
- An external wake clears the manually opened screen-rest overlay.
- Linked video artwork retains mute and zero volume when entering or leaving full screen.
- Update and audible measurement checks include local playback and room-control activity, even when the GUI is viewing a different room.

Proposed short signed release note:

> GUI 3.5.0: Real Music Assistant rooms, compatible groups, room/group volume, queue transfer and an optional startup invitation to join Rivo. Improved DSP loading, remote screen wake and silent video artwork. Native Squeezelite regrouping may briefly interrupt music. Physical synchronization and power stability still need device acceptance.

## Publication after approval

1. Confirm main still matches the reviewed base, or review any intervening changes first.
2. Commit only the reviewed source changes. Do not include local credentials, signing keys, generated review archives or unrelated mechanical edits.
3. Let Verify finish on Node 22/24, Python and the configured browser/production checks. A failed check stops publication.
4. The existing preview workflow builds from that tested commit, exports the existing public project key, signs the archive using the existing GitHub secret and publishes immutable assets. No new signing key is required.
5. Verify the public signature, archive hash and channel selection for that exact commit before asking the owner to install it.

## First installation on the Pi

Wait for publication confirmation before using **Settings → Updates → Check for updates → Install update**. Keep both TuneBox and Rivo paused for this first installation, and leave Music Assistant connected.

The previously reported appliance receipt was `2026.11.13-setup.1`, revision 1. On devices with signed appliance maintenance enabled, the update also refreshes the trusted updater/manager policy from the verified candidate. Its already-running updater process still uses its older policy during this first transaction; pausing all rooms avoids relying on the new multiroom idle checks before they are installed.

Application-only OTA does not itself refresh the trusted helpers when appliance maintenance is disabled. After the candidate is installed, check the manager's appliance release. If it has not advanced, pause all rooms and run the existing reviewed device refresh:

```sh
sudo bash /opt/daw-one/deploy/update-appliance.sh --check
sudo bash /opt/daw-one/deploy/update-appliance.sh --apply
```

This is a conditional device step, not a command to run against the old release before publication. It preserves Music Assistant, PCM export and audio routing. The existing device refresh also reapplies the appliance browser/display configuration; quiet-boot changes take effect on the next restart.

After activation, read the installed release without printing control tokens:

```sh
curl -fsS http://127.0.0.1:3001/api/health
sudo cat /var/lib/daw-one-manager/appliance.json
systemctl is-active daw-one.service daw-one-manager.service daw-one-kiosk.service daw-one-update.timer
```

Health must report `2026.11.13-multiroom.1` and the newly published deployment commit. The updater verifies release/commit/assets and restores the previous application slot if its health check fails. This application rollback does not promise to revert previously applied host configuration.

## Short acceptance test

1. At a low listening level, open Rooms and confirm the real TuneBox and Rivo, their current states and independent volume controls.
2. Group/leave explicitly, check mute and balanced group volume, then check a confirmed queue transfer while paused.
3. Test the startup invitation with Rivo already playing. Declining must leave Rivo alone; joining must retain Rivo as leader with its queue and volume. Record any audible interruption. The inspected native MA Squeezelite provider rebuilds its stream when membership changes, so seamless cold joining is not promised.
4. Retry DSP controls after opening/unlocking Audio & DSP, and verify external wake after manual screen rest.
5. Check for updates while local TuneBox music is playing and another room is selected: installation must defer. Finish this check with the refreshed helper, not an older application-only installation.

The physical screen outage remains a separate investigation. Both previous power feeds shared one GaN charger; software checks do not establish a repair. Use a genuinely independent screen adapter for the bench acceptance and observe normal operation without deliberately provoking an outage.

See [multiroom behavior](multiroom.md) and the [local validation report](multiroom-validation.md) for implementation details and the limits of simulated tests.
