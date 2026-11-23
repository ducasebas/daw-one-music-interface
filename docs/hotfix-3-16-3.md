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

## Interface amendments requested on 23 November

These changes extend the same 3.16.3 candidate on a separate `codex/3.16.3-smooth` branch based on the complete SAFE UPDATE hotfix. The original staged-manager checks, rollback limits and independent update page stay included.

- The wall music header reaches both screen edges. Its overlay geometry is established before the splash finishes, so the track, widgets and visualizer keep their coordinates when the menu collapses or becomes ready. The compact Settings status header keeps its own layout.
- Display settings open an owned widget chooser with Cancel and Apply selection. Settings Save remains the persistence step. Swiping the chooser scrolls; only the explicit grips capture dragging. The fixed footer remains reachable on the legacy 1280×400 display.
- The visualizer already reads local Squeezelite shared-memory PCM, not an internet music stream. FFT analysis now runs in a lazy Node worker, with at most one frame in progress and the newest waiting frame. Intermediate frames are discarded instead of accumulating delay. It never changes the player, output route or producer memory.
- The browser receives analysis values over one local `/api/audio/events` connection, with a bounded HTTP fallback for older/offline helpers. A small request every 1.5 seconds renews the existing three-second capture lease. An open event connection alone cannot keep capture running. Pausing the local player, hiding the page or leaving the visualizer releases it; a paused selected remote room cannot stop local PCM.
- A small client frame source separates changing measurements from React status. Only the meter nodes receive live targets; the music shell, Settings controls and SVG scales no longer render for each frame. The existing bounded presentation-delay queue still clears on pause, source/track/seek changes and stale input. Meter motion keeps one animation clock, capped at roughly 30 fps, while new values update its targets.
- PCM demand and optional artwork decoration wait for the first usable music screen. No fixed delay was added to the owner's splash. The Pi's `--disable-gpu` stability setting stays in place; actual boot background load still needs a physical observation.

The owner deferred amplifier-output diagnosis while TuneBox is off. The reported approximately 15 W at 90% volume does not establish an output-power ceiling. The retained readings, unknowns and read-only commands are in [hardware-next-session.md](hardware-next-session.md). No amplifier gain, EQ headroom, volume ceiling, power negotiation or audio route is changed by these amendments.

The owner approved publishing the combined candidate on 23 November with “push wanneer klaar”. See [validation and physical limits](hotfix-3-16-3-validation.md). Source readiness, signed publication and installation on the Pi are separate states.
