# GUI 3.15.2 · HOTFIX: scope and validation

Release `2026.11.20-hotfix.3`, service-worker cache 65. Owner feedback of 20 November 2026; the owner approved pushing once ready ("ja en dan pushen als alles klaar is").

| Owner report | Cause (Pi data, read-only) | Change |
|---|---|---|
| 100 W is offered, but the power wizard does not start | The adapter offers 20 V / 5 A. The current contract is the HUSB238 start-up 20 V / 1.25 A. No `power-discover`, `power-request` or `power-config` reached the manager today, so the GUI stopped the attempt itself. All power services exist (installed 13:39). The page reads the helper capabilities only when it opens, so a page opened before the install keeps "not installed", and `openSetup` returned silently in several cases. | A grey "Set up offered power" button now always states its reason, with "Check again" to re-read the power helper. Tapping re-reads the capabilities first and never refuses silently. The safety rules are unchanged: staged changes, PIN and busy states still block, and every request still needs its own confirmation including the 5 A cable. |
| Audio analysis no longer works | `/api/audio` reports `source-missing` while music plays. `tunebox-player` runs Squeezelite as `dawdev` with `-v`, but `/dev/shm/squeezelite-<mac>` is missing, also in the process's own view. The same process (PID 13628) had served the sync reference at 11:33. | logind `RemoveIPC=yes` removes a login user's shared memory when their last session ends, for example when SSH closes. `update-appliance.sh` and `install-audio-analysis.sh` set `RemoveIPC=no` and restart the player once if its export is missing. The setting takes full effect after a restart. The GUI hint names the cause. |
| "Audio analysis is off" message although the owner switched it off | — | The meters stay empty when analysis is deliberately off. |
| "Speelt nu" heading at the top of Now Playing | — | Removed on the wall Now Playing page; the content moves up. Clock and Power widget labels translated. |
| Queue-replace popup: more logical order, clearly tappable | — | "Play it now" (save as playlist then play, highlighted; replace and play, red) before "Keep the queue" (play next; add to the end). Full-width rows with icon, explanation and chevron. |

## Local results (container/simulator, not the Pi)

- Unit tests and build, Python, full Chromium and offline: see below.
- New and changed tests:
  - `power-monitoring.spec.js` 26/26, including a power helper installed while the page was open and found via "Check again";
  - `host-install.test.js` (RemoveIPC);
  - `audio.spec.js` (no message when switched off);
  - `connect.spec.js` (queue choice).
- Open point: `lively.spec.js:38` (widgets after Save → Open Now Playing) fails intermittently when repeated, also on 3.15.0. It passed in CI for 3.15.0 and 3.15.1.
- Not observed on the Pi: the power wizard starting, the 100 W request, and audio analysis surviving an SSH logout after the restart.
