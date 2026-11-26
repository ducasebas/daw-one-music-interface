# GUI 3.16.6 UPDATES: maintain only the system components that changed

Published preview `2026.11.25-updates.1`, cache 73, based on published 3.16.5 (`a7700b5e9eb2ce25d73bba867fa957d0a5d3d20e`). Published through PR #27 as `6ecd80f3ad5d511ba501863443532bd6b834929f` after all six review/main Verify jobs and signing/channel verification passed. Physical acceptance remains separate. Validation is recorded in [update-3-16-6-validation.md](update-3-16-6-validation.md).

## Problem and device evidence

A 3.16.5 installation downloaded and verified its archive, then the Pi restarted during the repeated system-maintenance phase before application activation. The next boot still ran 3.16.4. The system watchdog was configured for three minutes; bootstatus was zero and did not identify a watchdog reset. The most recent completed daemon reloads in the supplied monotonic journal took about 1.5 seconds. The retained step trace was from the previous day. The reset cause remains unproven.

The owner subsequently reported a successful GUI-only installation with optional system maintenance temporarily disabled. That workaround required matching system payloads, existing helper-file integrity and the normal signed OTA, idle checks and application health/rollback. Final API readback and restoration of the previous maintenance setting are still pending.

## Resulting behavior

The updater compares the verified system payloads before maintenance. App assets, language files, version metadata and unused GUI helpers do not require a system refresh. Active manager dependencies, updater code, service templates and system installers do. Existing installed inventories are checked and the copied helper bytes are bound to the expected source before an unchanged-system skip. A locally valid inventory alone cannot disguise unapplied system changes.

There are three paths:

- **GUI only:** keep existing system services running and perform the usual application swap and startup check.
- **Update tools:** stage and check updater files, then publish them through the existing atomic file installer. When the independent update page or its status helper changes, refresh those files while preserving the rest of the manager tree and restart the manager once. No display, player, network, power or boot configuration is changed, and no daemon reload is requested by this path.
- **System update:** run the existing complete maintenance script when real system payloads or unit templates change. This retains the previous behavior for necessary device changes, with fixed stage checkpoints.

The first repair must work through the already installed updater, which invokes the candidate's maintenance script unconditionally. An early bridge in that verified script selects the small path before the full maintenance body. Adding this bridge or its logging does not itself change the underlying system configuration. The service/timer templates and complete maintenance body must match before the small path is allowed. Known candidate updater/page files can be resumed after a partial tool refresh; unrelated installed-file differences remain errors.

## Progress and interruption

Maintenance checkpoints persist the step, result, boot identity and time in a bounded private record. Public progress exposes fixed labels rather than child-process arguments or arbitrary error strings. The independent update page shows the current step and retains a failure when the previous app is available, with a button back to TuneBox. Settings retain the maintenance warning after a new release check.

An interrupted maintenance run blocks automatic replay while system maintenance is enabled. A manual check and explicit installation remain available. This does not silently change the owner's update policy or disable the watchdog. Signature checks, idle/source gates, group consent, application health checking and activation rollback remain in place.

## Music Assistant disconnection hotfix

The backend automatically pauses the local Louder amplifier when its configured Music Assistant connection fails. This uses the existing local amplifier standby command, not a Music Assistant player/group pause, stop, transfer or queue change. It works even when the user is in Settings or no browser is open. Automatic retries of the same failed connection do not repeatedly write the amplifier gains. The local pause indication survives an app/OTA restart within the same kernel boot, matching the manager's retained standby state. A cold boot has separate hardware initialization and is not treated as that same session. Bluetooth, an active microphone measurement, shutdown and manual update preparation are excluded. A device refusal remains visible with a manual retry; unconfirmed silence is never presented as a successful pause.

The outage message removes the volume output and plus/minus controls. **Test connection again** checks the saved server connection, with visible waiting feedback and a bounded browser timeout. Concurrent tests share the existing connection attempt. The endpoint requires the normal local control token and same-origin boundary, accepts no server address or credential arguments, and is unavailable to the paired phone/provisioning listeners. Connection recovery leaves the amplifier paused; **Resume locally** is an explicit separate action. The older bounded local-volume API remains for compatible clients.

The hotfix adds app/backend files only and uses the already installed manager command. It does not change the minimal system-maintenance plan or alter the saved updater policy. Local fixtures verify command isolation; real TuneBox/Rivo playback and reconnection still need device observation after approved publication.

## Installation and limits

Automatic appliance maintenance must be enabled for the existing updater to install the new updater/page files through this minimal bridge. A device that intentionally disables it keeps that setting. The 3.16.5 recovery backup can restore only that original flag without replacing later policy edits.

This change avoids unnecessary system reinstalls; it does not establish the physical cause of the earlier reset. Real Pi acceptance is separate: first upgrade through the existing updater, visible progress during the manager restart, later GUI-only updates, standby/touch recovery and TuneBox/Rivo playback. Do not reproduce the unresolved power fault to validate this release.

## Amplifier follow-up

The owner read both channel gains as -9 and all fifteen EQ bands as zero or cuts. No positive EQ boost in that curve requires a separate -9 dB boost reserve. This update does not automatically remove that attenuation, raise normal channel gains or alter the reference EQ. The separate disconnection pause uses the existing gain-based local mute and restores its saved levels only after an explicit resume. The user can review the normal gains through the existing controls at low playback volume; the actual origin of the attenuation, driver impedance and full output chain remain separate checks.
