# GUI 3.16.4 INTEGRITY: installed system files

Local candidate `2026.11.24-integrity.1`, cache 71, branch `codex/3.16.4-file-integrity`, based on published 3.16.3 (`df8dd7ccef2eff3d1a2e224e48de9fa14d036b43`). The owner approved publication on 24 November 2026; the configured CI must pass before merge and signing. See [validation](hotfix-3-16-4-validation.md).

## Confirmed fault and scope

After an interrupted OTA, the installed display controller was **zero bytes**. Python accepts an empty script and exits 0, so `Restart=on-failure` left the service inactive. The display API consequently reported `supported: false`, disabling automatic brightness. The active application reported 3.16.2; 3.16.3 had been offered but successful activation was not confirmed. A reboot occurred during installation, but its cause and the precise write that produced the empty file are not established.

The signed archive and its inventory protect the candidate source. They do not by themselves verify copies subsequently written to `/usr/local/lib`. The prior display installer replaced its live controller directly, without an installed-copy check or a live-process check.

This hotfix adds a separate check at that host-installation boundary:

- Read and validate every candidate helper before replacement. Refuse empty files, symlinks/special files and invalid Python. The display controller must also contain its complete daemon entry point: syntax validity alone cannot distinguish an empty script or a valid partial script.
- Stage all files in the destination filesystem, set permissions, flush and `fsync`, and compare SHA-256 before replacing anything. Replace each file by rename, sync its directory and verify the installed bytes. A staging/space/short-write failure leaves every prior live file intact.
- Write the expected checksum inventory last. The display, manager and updater units check that inventory before running. A partial batch, missing file, zero-length file or changed bytes cannot silently pass the next service start.
- Restart the display controller after installation, including on an already active service. Require two advancing, recent status samples with the actual systemd MainPID and working backlight access before reporting success. A process exiting 0 is an installation failure.
- Publish the affected service definitions atomically as well. Optional sync, measurement and Bluetooth installers use atomic copies for files shared with the manager so they cannot truncate those checked files in place.

The whole multi-file host layer is **not** an atomic slot switch. A process interruption between individual renames can leave a mixed tree, which the startup inventory check rejects; rerunning a verified installation repairs it. These checks do not establish why the Pi rebooted, repair faulty storage or guarantee behavior under every electrical fault. The existing application-slot journal, signed verification, idle gates and rollback remain in force.

## CI correction: edits made during Save

The full Chromium run exposed an existing settings race: the first Save could update the backend before its response reached the browser. Editing widget placement in that interval was then silently overwritten by the old acknowledgement, hiding Save. A deterministic held-response test reproduced the loss. The acknowledgement now adopts canonical saved values and the confirmed revision while retaining newer edits, including reordered widget arrays. Those edits remain explicitly unsaved. Queued navigation runs after the acknowledged draft renders and still asks before abandoning newer edits.

## Device recovery and installation

Recover the currently empty controller first using the separately supplied pinned-checksum recovery block. Its original source is identical in 3.16.2 and 3.16.3. Do not treat the repair as completed until `daw-one-display.service` is active and `/api/display` reports `backlight.supported: true`. Close and reopen Display settings after recovery; the current screen reads that capability when it opens.

Do not delete the pending activation journal or restart the Pi just to dismiss update progress. Confirm the active build and transaction state after the interrupted installation. The original reboot/power cause remains open.

Once this candidate is approved and published, signed OTA installs its host checks when automatic appliance maintenance is enabled. If that maintenance is disabled, pause music and run the verified installed release's `deploy/update-appliance.sh --check`, then `--apply`, once. An application-only update cannot change already installed systemd helpers. Existing configurations, wiring confirmations, volume limits, routing and the owner-created splash remain unchanged. This hotfix includes the full published 3.16.3 work.

## Physical acceptance still required

Confirm the installed build, nonempty controller and inventory, service state and fresh backlight capability. Check manual and automatic brightness, normal screen wake and an ordinary restart when appropriate. These are device observations, distinct from the temporary-filesystem/process tests. Do not provoke the unresolved power interruption.
