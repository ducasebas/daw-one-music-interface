# GUI 3.16.3 · SAFE UPDATE: scope

Release `2026.11.23-safe.1`, service-worker cache 70, on top of GUI 3.16.2. Built after the owner's report of 22 November 2026: the 3.16.2 update stayed on "Waiting for the update service" for six minutes, and the owner then shut down over SSH. The owner asked to prevent this in future ("Ja bouw maar alvast"). Publishing needs the owner's separate approval (see `AGENTS.md`).

## Cause (reproduced locally)

`deploy/install-manager.sh` copied the root manager from a fixed list of files. GUI 3.16.2 added `deploy/manager/ssh.mjs` and imported it from `root-adapter.mjs`, but the list did not include it. The updater runs the host maintenance step (`update-appliance.sh`) during an OTA when `applianceUpdates` is on. That step installed the new `root-adapter.mjs` without `ssh.mjs` and restarted the manager, which then failed with `ERR_MODULE_NOT_FOUND`.

The manager serves the independent update page (port 3002). With the manager down, the kiosk kept showing the last state: the clock froze at 1:37 and the heading read "Waiting for the update service". The same file set, copied into a temporary directory, fails in exactly this way.

This was not observed on the Pi itself; the owner's logs are still to come. Likely state of the owner's TuneBox: the manager is not running, even after the reboot, because its installed files are incomplete.

## Changes

| Measure | Change |
|---|---|
| Never install an incomplete manager | `install-manager.sh` builds the manager in a staging directory first. It copies all `deploy/manager/*.mjs`, `progress.html` and all `shared/*.js`, then runs `deploy/manager/check-imports.mjs` over every relative import. Only when nothing is missing does it replace `/usr/local/lib/daw-one-control`. Afterwards it waits up to 20 s until the manager answers on `/status`; if it doesn't, the log is shown and the step fails. |
| A CI test for every host tree | `tests/installed-modules.test.js` rebuilds the trees as the install scripts copy them (manager, Bluetooth, measurement, sync, power, updater) and fails on any missing import. It fails on the 3.16.2 script with `deploy/manager/ssh.mjs`. |
| The updater stops itself | `update.mjs` stops after 9 minutes with a clear error. The `daw-one-update.service` unit gets `ExecStopPost`: if a run fails, times out or is killed while the activation journal (`pending.json`) exists, it restores the previous version straight away instead of waiting for the next timer run or boot. |
| The update page never freezes | The clock keeps running from the last known start. After 20 s without contact the page says "No contact with the update service … do not switch it off". After 3 minutes it explains that TuneBox returns to the previous version by itself, and offers "Back to TuneBox". When contact returns, everything goes back to normal. The kiosk attribute that hides the cursor is also set from the page itself. Covered by `tests/browser/update-progress.spec.js`. |

Restoring after a power cut during activation already existed: at the next updater run, `pending.json` triggers a rollback before anything else. It stays unchanged.

## Repairing the owner's TuneBox now

The new manager files arrive with 3.16.3, but installing an update through the screen needs a working manager. A one-time manual repair restores the missing file from the 3.16.2 release slot and restarts the manager; this is the same file the installer should have copied. After that, the screen can install 3.16.3, followed by the host refresh.

## Host-helper refresh

All of this is host code. It reaches the Pi through OTA plus `sudo bash /opt/daw-one/deploy/update-appliance.sh --apply`, or automatically on later OTAs when appliance updates are enabled.
