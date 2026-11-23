# Release and approval history

Moved verbatim from `AGENTS.md` on 19 November 2026 so agents do not reload it every turn. Newest first. These records document past scope and approvals; none of them authorizes a later update. Standing rules live in `AGENTS.md`.

## GUI 3.16.3 SAFE UPDATE — approved

The owner approved on 23 November 2026 with “push maar”, and reported that searching for updates is greyed out. That fits a manager that is not running after the 3.16.2 update. The scope is in [hotfix-3-16-3.md](hotfix-3-16-3.md): staged manager install with an import check, a CI test for installed host trees, the updater time limit with immediate rollback, and an update page that keeps counting. The approval covers the review branch, required CI and fixes within this scope, merge and signed preview publication after the full CI passes. It authorizes no live hardware experiment or physical confirmation.

## GUI 3.16.2 PLAY — published

Merged via PR #23 as `4ef3d3adc06d6f675a6cd7522c177db5df614e07` on 22 November 2026 after all six PR CI jobs passed on head `9bc8d46`. Three CI failures on earlier heads were fixed within scope:
- the compact header's menu icons went back to 32 px;
- the Pi 3 and GUI2 tests now follow `videoConfigured`, because the Video Artwork button is hidden without a video.

Verify on `main` (run 45065557290) passed. Publish signed preview (run 45066292410) passed, including its channel check.

Verified independently from this session:
- the signature verifies with the unchanged project key;
- the manifest names commit `4ef3d3a`, release `2026.11.22-play.1` and label "GUI 3.16.2 · PLAY", and the archive hash matches;
- `release-bundle verify` confirms 418 files with cache v69, including the SSH manager module;
- `checkChannel` selects this release.

Pi installation, the host refresh and the physical checks were not observed: drag and drop on the touch panel, hold to wake, crossfade on the owner's Music Assistant, and leaving multiroom after a reboot.

### Approval

The owner approved on 22 November 2026 with “Ja pushy maar”, after the summary of the local candidate. The scope is in [update-3-16-2.md](update-3-16-2.md): widget editor, overlay header, hold to wake, Keep playing button, crossfade, SSH switch, leaving multiroom after a reboot, the Pi throttle card and the small fixes. The approval covers the review branch, required CI and fixes within this scope, merge and signed preview publication after the full CI passes. It authorizes no live hardware experiment or physical confirmation.

## GUI 3.16.1 HOTFIX — published

Merged via PR #22 as `cb95139b8831eca819282a98c91607840e1dbded` on 22 November 2026 after all six PR CI jobs passed on head `64b503b`. The first head failed only in WebKit: the new screen-rest test used a Chromium-only touch API. It was rewritten with the portable touchscreen and still fails on the old code. The owner's 30 fps CPU request was added before the merge. Verify on `main` (run 45037394541) passed. Publish signed preview (run 45038125406) passed, including its channel check.

Verified independently from this session:
- the signature verifies with the unchanged project key;
- the manifest names commit `cb95139`, release `2026.11.22-hotfix.1` and label "GUI 3.16.1 · HOTFIX", and the archive hash matches;
- `release-bundle verify` confirms 413 files with cache v68; the bundle contains the 33 ms PCM reader and the kiosk `--disable-gpu` flag;
- `checkChannel` selects this release.

Pi installation, the host refresh and the physical checks were not observed: screen rest staying on, rendering without GPU, and audio stability.

### Approval

The owner approved the combined candidate on 22 November 2026 with “zeker”, in answer to whether to push and publish it once the tests pass. The scope is in [hotfix-3-16-1.md](hotfix-3-16-1.md): the screen-rest and power-widget fixes, merged with the other agent's `hotfix/tas58xx-audio-stability` branch (Pi 4 + Louder HAT stability tuning). The approval covers the review branch, required CI and fixes within this scope, merge and signed preview publication after the full CI passes. It authorizes no live hardware experiment or physical confirmation.

## GUI 3.16.0 REST — published

Merged via PR #21 as `dbdca6015dd18a34296be0bde90f01622e7176bf` on 22 November 2026 after all six PR CI jobs passed on head `49d14af` (two CI failures on the first head were fixed within scope: offline tests still used the old rest-view select, and widgets must stay at least 80 px tall). Verify on `main` (run 45009306563) passed. Publish signed preview (run 45009888213) passed, including its channel check.

Verified independently from this session:
- the signature verifies with the unchanged project key;
- the manifest names commit `dbdca60`, release `2026.11.22-rest.1` and label "GUI 3.16.0 · REST", and the archive hash matches;
- `release-bundle verify` confirms 412 files with cache v67; the three bundled rest photos carry no EXIF;
- `checkChannel` selects this release.

Pi installation, the host refresh and physical checks (backlight off, phone photo upload) were not observed.

### Approval

The owner approved publishing on 22 November 2026 with “ja voeg maar toe. en push maar” (add the power warning, then push). The scope is in [rest-3-16.md](rest-3-16.md): city location, calm skipping, screen preservation, rest previews and backgrounds with the owner's photos and phone upload, auto-hiding header, widget fit/order/position, Developer → Values, the onset sync save fix and the lower-PD-contract notice. The approval covers the review branch, required CI and fixes within this scope, merge and signed preview publication after the full CI passes. It authorizes no live PD request or physical confirmation. The owner's readout that day showed every PD offer capped at 3 A; that is a supply/cable observation, not a confirmed cause.

## GUI 3.15.3 HOTFIX — published

Merged via PR #20 as `73b45a089625317213f342ea26dc04cf6b8ea8f5` on 21 November 2026 after all six PR CI jobs passed. Verify on `main` (run 44894739774) passed. Publish signed preview (run 44895321505) signed and published release `ota-preview-73b45a089625317213f342ea26dc04cf6b8ea8f5`. Its public channel check got HTTP 403 on the shared runner, so the failed job was re-run once.

Verified independently from this session:
- the signature verifies with the unchanged project key;
- the manifest names commit `73b45a0`, release `2026.11.21-hotfix.1` and label "GUI 3.15.3 · HOTFIX", and the archive hash matches;
- `release-bundle verify` confirms 403 files with cache v66;
- `checkChannel` selects this release.

Pi installation and the host refresh were not observed.

On 21 November 2026 the owner approved this update with "ja, widget fix erbij en dan pushen" (yes, add the widget fix and push). That was the answer to the proposal to release the power and sync fixes now and add the widget test fix. Scope: release `2026.11.21-hotfix.1`, cache 66: automatic pause and visible refusals for power setup, journaled manager refusals, sample-clock sync timing with separate clipping and stall messages, and the widget test fix. The reference timing stays deferred, at zero. See [hotfix-3-15-3.md](hotfix-3-15-3.md).

Also reported by the owner on 21 November 2026: **100 W works** on the Pi with the 3.15.2 power setup, after pausing playback. This is the owner's own report; the contract details were not seen here.

The owner's further feedback is scoped for 3.16, not this update: widgets, an auto-hiding header, screen off after inactivity, screen-rest previews and backgrounds, artwork while skipping, and a time-zone location.

## GUI 3.15.2 HOTFIX — published

Merged via PR #19 as `232475e95425de30adcd3c268afd3b882cc01766` on 20 November 2026 after all six PR CI jobs passed. Verify on `main` (run 44754439705) and Publish signed preview (run 44755610081) passed on the first attempt, including the public channel check. Release `ota-preview-232475e95425de30adcd3c268afd3b882cc01766` is public.

Verified independently from this session:
- the signature verifies with the unchanged project key;
- the manifest names commit `232475e`, release `2026.11.20-hotfix.3` and label "GUI 3.15.2 · HOTFIX", and the archive hash matches;
- `release-bundle verify` confirms 401 files with cache v65;
- `update-appliance.sh` in the archive sets `RemoveIPC=no`;
- `checkChannel` selects this release.

Pi installation, the host refresh plus restart, and the power wizard on the Pi were not observed. The 3.15.1 publish re-run (attempt 2 of run 44748600414) also passed.

**Owner hardware confirmation, 20 November 2026:** the owner confirmed the INA228 VBUS voltage-sense wiring ("Yes confirmed") when asked about `voltageSenseVerified` being on. The reading at that time was 20.13 V on a 20 V contract. This is the first physical confirmation of VBUS; the current path had already been confirmed.

On 20 November 2026 the owner approved this update with "ja en dan pushen als alles klaar is" (yes, then push when everything is ready). It came after the owner asked to fix the 100 W issue first and had been told about the other changes. Scope: release `2026.11.20-hotfix.3`, cache 65:
- the power setup explains why it cannot start and can re-read the helper capabilities;
- logind `RemoveIPC=no` keeps the player's PCM export;
- no "analysis off" reminder when the owner switched analysis off;
- no duplicate Now Playing heading;
- a clearer queue choice.

See [hotfix-3-15-2.md](hotfix-3-15-2.md). The audio analysis fix needs `sudo bash /opt/daw-one/deploy/update-appliance.sh --apply` and a restart on the Pi. The approval does not cover live power experiments; the 100 W request remains the owner's own confirmed action.

## GUI 3.15.1 SYNC — published

Merged via PR #18 as `9c5620d5dbe5e71c638c8d4b9539be284c3e7428` on 20 November 2026 after all six PR CI jobs passed. Verify on `main` (run 44747531138) passed. Publish signed preview (run 44748600414) signed and published release `ota-preview-9c5620d5dbe5e71c638c8d4b9539be284c3e7428`. Its public channel check got HTTP 403 from the unauthenticated GitHub API on the shared runner, so the failed job was re-run once.

Verified independently from this session:
- the signature verifies with the unchanged project key;
- the manifest names commit `9c5620d`, release `2026.11.20-sync.1` and label "GUI 3.15.1 · SYNC", and the archive hash matches;
- `release-bundle verify` confirms 399 files with cache v64;
- `checkChannel` selects this release.

Pi installation, the host refresh and a sync on the Pi were not observed.

On 20 November 2026 the owner approved this update with "ja push maar". Scope: release `2026.11.20-sync.1`, cache 64: onset refinement of the sync lag, a robust screen-path margin, a skip of the first second of the recording, and logging plus history of failed sync attempts. See [sync-3-15-1.md](sync-3-15-1.md).

Local results:
- unit 432/432, Python 111, offline 16/16, sync and automatic-setup browser tests passed;
- the full Chromium run was interrupted by a session restart. On a clean re-run of the affected specs, `lively.spec.js:38` (widgets after Save → Open Now Playing) failed intermittently. It fails the same way on the published 3.15.0 code (`c01f533`) when repeated, so it is a pre-existing timing race, recorded as an open point. GitHub CI decides.

 — published

Merged via PR #17 as `c01f53352aeef1d4a86aa5cae61b429e1575d263` on 20 November 2026.
- **First PR CI run:** failed in `chromium (2/3)`, `remote-share.spec.js`. "Copy link" gave up when `navigator.clipboard` was refused on a secure origin. That was a real flaw, which phones on the LAN could also hit. Fixed in `9f63650`: the code falls back to the classic copy before showing the hand-copy hint, and the test simulates both cases. The new test failed on the old code with the same error and passed with the fix.
- **After the fix:** all six PR jobs passed. Verify on `main` (run 44730736586) and Publish signed preview (run 44731735551) passed on the first attempt, including the public channel check.

Release `ota-preview-c01f53352aeef1d4a86aa5cae61b429e1575d263` is public. Verified independently from this session:
- the signature verifies with the unchanged project key;
- the manifest names commit `c01f533`, release `2026.11.20-guide.1` and label "GUI 3.15.0 · GUIDE", and the archive hash matches;
- `release-bundle verify` confirms the full inventory (398 files) with cache v63;
- the archive contains the wizard bundle, the new update page and the Bluetooth transport reporting, and no outreach draft;
- `checkChannel` selects this release.

Pi installation, the host refresh and physical checks were not observed: the wizard with a real microphone, Bluetooth with a real phone, the update duration and the phone invite.

On 20 November 2026 the owner approved this update with "Ja push maar", after being shown the local candidate and its results. Results at approval: unit 429/429, build OK, Python 111, full Chromium 235/235, offline 16/16; WebKit was not run locally.

Scope: release `2026.11.20-guide.1`, cache 63:
- room correction wizard with a check measurement;
- Bluetooth setup steps and the negotiated codec, bitrate and stability;
- full-screen update review and progress with changelog, measured duration and expectations, plus a shared popup style;
- Louder HAT health in Developer → Hardware;
- readable search suggestions with a compact keyboard;
- phone notifications and phone invites.

The Bluetooth details, the duration history and the update page need `sudo bash /opt/daw-one/deploy/update-appliance.sh --apply` on the Pi. See [guide-3-15.md](guide-3-15.md) and [guide-validation.md](guide-validation.md).

## GUI 3.14.2 HOTFIX (idle clock fault) — published

Merged via PR #16 as `1d45d5c0771390457a90848d3d6719870a5cf251` on 20 November 2026 after all six PR CI jobs passed. The final local run also passed: Chromium 227/227 and offline 16/16. Verify on `main` (run 44711873122) and Publish signed preview (run 44712877704) passed on the first attempt, including the public channel check. Release `ota-preview-1d45d5c0771390457a90848d3d6719870a5cf251` is public. Verified independently from this session:
- the signature verifies with the unchanged project key;
- the manifest names commit `1d45d5c`, release `2026.11.20-hotfix.2` and label "GUI 3.14.2 · HOTFIX", and the archive hash matches;
- `release-bundle verify` confirms the full inventory (371 files) with cache v62;
- `blockingFaults` is present in the measurement and manager code;
- `checkChannel` selects this release.

Pi installation, the host refresh and a new sweep were not observed.

On 20 November 2026 the owner approved this update with "ja push". The owner had been told the cause and the fix. Cause, from the owner's read-only journal, amixer and dmesg output: the sweep preparation refused to start on the TAS5825's idle "Fault Clock". The fix is `blockingFaults()`, applied to the measurement, Bluetooth, the startup sound and automatic DSP; real faults still block. Further changes: the preparation logs its reason, and the GUI and docs use the full `/opt/daw-one/deploy/update-appliance.sh` path. Scope: release `2026.11.20-hotfix.2`, cache 62. Local results at approval: unit 426/426, build OK, Python 109; the full Chromium run was in progress with no failures. The fix reaches the Pi only through `sudo bash /opt/daw-one/deploy/update-appliance.sh --apply`.

## GUI 3.14.1 HOTFIX (sweep diagnostics, privacy clean-up) — published

Merged via PR #15 as `2fc164ef45c3577a5b486685c1a49c386cedef6a` on 20 November 2026 after all six PR CI jobs passed (check 22/24, Chromium 1–3/3, offline + WebKit). Verify on `main` (run 44705067629) and Publish signed preview (run 44705999034) passed on the first attempt, including the public channel check. Release `ota-preview-2fc164ef45c3577a5b486685c1a49c386cedef6a` is public. Verified independently from this session:
- the signature verifies with the unchanged project key;
- the manifest names commit `2fc164e`, release `2026.11.20-hotfix.1` and label "GUI 3.14.1 · HOTFIX", and the archive hash matches;
- `release-bundle verify` confirms the full inventory (371 files) with cache v61;
- the archive no longer contains the outreach draft;
- the device selector (`checkChannel`) picks this release.

Pi installation, the host-helper refresh and a new sweep on the real hardware were not observed.

On 20 November 2026 the owner approved this update with "a, ik wil dit voorkomen voortaan, daarna mag je pushen". This was the answer to the choice about the outreach draft found in `docs/`: A meant remove the draft and the named reference, keep git history, and prevent it from now on, then push. Scope: release `2026.11.20-hotfix.1`, cache 61. It contains:
- sweep-detection diagnostics, a wider lag search, a 7 s capture and robustness against a USB-microphone start-up burst (see [sweep-diagnostics-validation.md](sweep-diagnostics-validation.md); the cause was inferred from the owner's read-only `status.json`, with no audio);
- removal of `docs/sonocotta-follow-up.md` and the named reference in `docs/design/interaction-next-proposal.md`;
- `tests/privacy.test.js` and the Privacy rule in `AGENTS.md`.

The draft remains in git history (rewriting it was option B, which the owner did not choose). The measurement part reaches the Pi only through `sudo bash deploy/update-appliance.sh --apply`.

## GUI 3.14.0 SOUND (includes 3.11.3 QUEUE, 3.12.0 PARTY, 3.13.0 OFFLINE) — published

Merged via PR #14 as `7a4caf513bf2d8d26a2a92f9d09c6532190973bd` on 19 November 2026 after all six PR CI jobs passed. Verify on `main` passed. Publish signed preview (run 44641052284) signed and published release `ota-preview-7a4caf513bf2d8d26a2a92f9d09c6532190973bd`; its public channel check got HTTP 403 from the unauthenticated GitHub API on the shared runner, and the failed job was re-run once (attempt 2 passed in full, including the public channel check). Verified independently from this session: the signature verifies with the unchanged project key; the manifest names commit `7a4caf5`, release `2026.11.19-sound.1` and label "GUI 3.14.0 · SOUND"; the archive hash matches; the inventory is complete (370 files, cache v60, `deploy/manager/reboot.sh` included); `checkChannel` selects it. Not observed on the Pi: guest pairing with PIN over the home Wi-Fi, local pause and volume on the real Louder while Music Assistant is down (needs the host-helper refresh), a Docker install of Music Assistant, saving a queue as a playlist on the owner's server, and listening with the simple sound layer.

On 19 November 2026 the owner approved publishing all four local candidates with "Ja push alles". The owner had been told the scope, the local results (full Chromium on the final state 225/226 with the one test-isolation failure fixed and re-run 9/9, offline 16/16, unit 420/420; 3.11.3 alone 222/222 and 16/16), the host-helper refresh needed for local volume, and that the cold-boot item stays separate. They build on each other and a device installs the newest, so they are published as one OTA, `2026.11.19-sound.1` (cache 60), with combined release notes. Scope: `docs/queue-3-11-3.md`, `docs/party-3-12.md`, `docs/offline-3-13.md`, `docs/sound-3-14.md`. The approval covers the review branch, required CI and fixes within this scope, merge and signed preview publication after the full configured CI passes. It does not cover live hardware experiments or physical confirmations.

## GUI 3.11.2 ENDLESS — published

Merged via PR #13 as `393b82a3b2dc9b99ef221394ee07d2a46636e6fe` on 19 November 2026 after all six PR CI jobs passed. Verify on `main` and Publish signed preview (run 44628902804) passed on the first attempt, including the public channel check. Release `ota-preview-393b82a3b2dc9b99ef221394ee07d2a46636e6fe` is public. Verified independently: the signature verifies with the unchanged project key; the manifest names commit `393b82a`, release `2026.11.19-lively.3` and label "GUI 3.11.2 · ENDLESS"; the archive hash matches; the inventory is complete (366 files, cache v56); `checkChannel` selects it. The final local run passed Chromium 220/220 and offline 16/16. Not observed on the Pi: the readiness check against the owner's Music Assistant (Tidal/Spotify/YouTube Music) and the queue filling itself.

On 19 November 2026 the owner approved the local GUI 3.11.2 ENDLESS candidate (`2026.11.19-lively.3`, cache 56) with "Ja ga door". The owner had been told about the scope ("Keep the music playing", on by default, with a read-only Music Assistant readiness check when switched on, TuneBox's own queue only) and that the full local Chromium run was in progress (152 passed, no failures at that point). Scope: `docs/endless-3-11-2.md`. The approval covers the review branch, required CI and fixes within this scope, merge and signed preview publication after the full configured CI passes. It does not cover live hardware experiments or physical confirmations.

## GUI 3.11.1 STYLE — published

Merged via PR #12 as `a6ec18028f6f575104174304d77b434c136b81f1` on 19 November 2026. The first PR CI run failed in `polish.spec.js:19`: the test still expected the skin's serif in the wizard, while Inter is now the default by design. The test was updated to choose "Skin font" (`87f2e8c`), after which all six PR jobs passed. Verify on `main` and Publish signed preview (run 44623863340) passed on the first attempt, including the public channel check. Release `ota-preview-a6ec18028f6f575104174304d77b434c136b81f1` is public. Verified independently: the signature verifies with the unchanged project key; the manifest names commit `a6ec180`, release `2026.11.19-lively.2` and label "GUI 3.11.1 · STYLE"; the archive hash matches; the inventory is complete (365 files, cache v55, Inter woff2 + OFL in `dist/fonts`); `checkChannel` selects it. Local results: Chromium 218 passed with the one test above failing before its fix (that file re-run 4/4 after the fix), offline 16/16. Pi installation and physical acceptance were not observed (fonts on the DSI panel, soft mute on the real player).

On 19 November 2026 the owner approved the local GUI 3.11.1 STYLE candidate (`2026.11.19-lively.2`, cache 55) with "Push maar". The owner had been told about the changes (Inter interface font with Manrope Heavy / skin font choice, readable type scale, Settings artwork backdrop, soft mute for players without native mute) and that the local full Chromium run was in progress (103 passed, no failures at that point). Scope: `docs/style-3-11-1.md`. The approval covers the review branch, required CI and fixes within this scope, merge and signed preview publication after the full configured CI passes. It does not cover live hardware experiments or physical confirmations. "Keep the music playing" (endless mode), asked about in the same message, is not part of this update.

## GUI 3.11.0 LIVELY (incl. 3.10.1 HOTFIX) — published

Merged via PR #11 as `4d358b18b10ea6b866beddb3cd8229586184e713` on 19 November 2026 after full PR CI passed (check 22/24, Chromium 1–3/3, offline + WebKit). Verify on `main` passed, and Publish signed preview (run 44614701213) passed on the first attempt, including the public channel check. Release `ota-preview-4d358b18b10ea6b866beddb3cd8229586184e713` is public. Verified independently from this session: the signature verifies with the project key (unchanged since 3.9.2), the manifest names commit `4d358b1`, release `2026.11.19-lively.1` and label "GUI 3.11.0 · LIVELY", the archive hash matches, the inventory is complete (353 files, cache v54), and the device selector (`checkChannel`) picks this release. The final local run before merge passed Chromium 217/217, offline 16/16 and Python 109. Pi installation and physical acceptance were not observed, including queue seek on the real server, backdrop smoothness, widget values and the remote on a phone.

On 19 November 2026 the owner wrote "Push m" (read as "Push maar") after being shown the local 3.10.1 HOTFIX (scrub through the Music Assistant queue; cause confirmed on the Pi: the player reports no `seek`) and the 3.11.0 LIVELY candidate (`2026.11.19-lively.1`, cache 54: artwork backdrop, Now Playing widgets, phone remote in TuneBox style). It was published as one update, 3.11.0, which includes the 3.10.1 fix. The local full Chromium run was still in progress (155 tests passed, no failures at that point). Scope: `docs/hotfix-3-10-1.md` and `docs/lively-3-11.md`. The approval covers the review branch, required CI and fixes within this scope, merge and signed preview publication after the full configured CI passes. It does not cover live hardware experiments or physical confirmations. A mute fallback for players without `volume_mute` is not in this scope.

## GUI 3.10.0 POLISH — published

On 19 November 2026 the owner confirmed that 3.10.0 is installed on the Pi ("Ziet er prachtig uit", then "Ja" when asked whether this was on the real screen). Individual points ("Update installed" notice, footer volume and scrubbing by touch, startup title over the splash, restart controls after the host-helper refresh) have not been reported separately and stay open.

Merged via PR #9 (`65fcce0`) and fix PR #10 as `e5501444e9b05edaec0ad85128e07aa65571173f` on 19 November 2026; full PR CI passed on both. The first Verify on `main` (`65fcce0`) failed: a navigation tap during a save was silently dropped (an earlier race, fixed in #10 with regression tests). Verify on `e550144` passed. Publish signed preview (run 44601496793) signed and published release `ota-preview-e5501444e9b05edaec0ad85128e07aa65571173f` ("GUI 3.10.0 · POLISH · preview"), but its public channel check got HTTP 403 from the unauthenticated GitHub API on the shared runner. That check was done independently from this session: the manifest signature verifies with the project key (identical to the key in the 3.9.2 archive); the manifest names commit `e550144`, release `2026.11.19-polish.1`, label "GUI 3.10.0 · POLISH" and the archive hash; `release-bundle verify` confirms the complete inventory (344 files); the device selector (`checkChannel`) picks this release from the public preview channel. The failed job was re-run once (attempt 2): Publish signed preview passed in full, including the public channel check. Pi installation and physical acceptance were not observed; the restart controls also need a host-helper refresh on the Pi.

On 19 November 2026 the owner approved the local GUI 3.10.0 POLISH candidate (`2026.11.19-polish.1`, cache 52) with "Push maar", after being told about the changes, the local results (unit 407/407, Python 109, Chromium 210/210, offline 16/16) and that WebKit and GitHub CI had not run. Scope: roadmap §3.10 items 2, 3, 4, 6, 10, 11, 12, 13, 14, 15, 17 and 18 as listed in `docs/polish-3-10.md`. The approval covers the review branch `claude/ota-update-test-status-alqo95`, required CI and fixes within this scope, merge and signed preview publication after the full configured CI passes. It does not cover live hardware experiments, a reboot or service restart on the Pi, or physical confirmations. The new restart controls also need a one-time host-helper refresh on the Pi.

## GUI 3.9.2 HOTFIX — published

Merged via PR #8 as `f3a7e37a0fb22e9dd47e332bb84d944bdf62bc15` on 19 November 2026 after full PR CI passed; Verify on `main` and Publish signed preview passed, and release `ota-preview-f3a7e37a0fb22e9dd47e332bb84d944bdf62bc15` ("GUI 3.9.2 · HOTFIX · preview") is public with archive, manifest and signature. After approval, the owner's next sweep on 3.9.1 reported both channels "no sweep detected" (correlation 0.042/0.201, delays 177/207 ms, both audible); the hotfix therefore also replaced the correlation/bass-third rule with matched-filter peak prominence (≥ 12) plus middle/last-third energy. Pi installation not yet observed.


On 19 November 2026 the owner asked for a hotfix rather than a new named update, and approved it with "push maar als het werkt". The owner reported 3.9.1 installed, a working sweep with SNR left −1.1 dB / right 9.6 dB (left audibly played; Louder Digital 103/127, Analog Gain 31/31, channel gains 0 dB). Scope: SNR from the aligned sweep window against the quiet lead-in after microphone start-up (and the tail), missing-dB tip per channel, and an optional retry 6 dB louder with consent, limited to −36/−30/−24 dBFS and validated in the UI, manager and capture helper. Release `2026.11.19-update-flow.2`, cache 51. Covers push, required CI, merge and signed preview publication after the full CI passes.

## GUI 3.9.1 UPDATE FLOW — published

Merged via PR #7 as `d7e96962f83f70db4568e0d3a23f4f801432b559` on 19 November 2026. Verify on `main` passed in about 6.5 minutes with the new CI, Publish signed preview passed including the public channel check, and release `ota-preview-d7e96962f83f70db4568e0d3a23f4f801432b559` ("GUI 3.9.1 · UPDATE FLOW · preview") is public with archive, manifest and signature. Pi installation not yet observed.


On 19 November 2026 the owner approved GUI 3.9.1 UPDATE FLOW (`2026.11.19-update-flow.1`, cache 50) with "ja push maar als de tests groen zijn": push once the local tests are green. Scope: manual install while Music Assistant is offline when the local ALSA output is silent (automatic installs unchanged), Install button independent of the global device-activity flag with persistent error/started messages, on-screen notice when the opt-in PD startup guard keeps the player stopped, `player-missing` Music Assistant status, manager restart in the measurement/sync installers (EROFS fix), missing-install reason under the sweep button, Results opening after a sweep, plus the CI speed-up and documentation on the same branch (PR #7). Covers the review branch, required CI and fixes within this scope, merge and signed preview publication after the full configured CI passes. It does not cover hardware actions or physical confirmations.

## CI speed-up (no app change)

On 19 November 2026 the owner approved pushing the CI restructure (preinstalled Playwright image, sharded browser tests, one run per pull request) and the 3.9.0 publication record with "jazeker moet je die pushen!". No application code or release ID changes. Merging it to `main` makes the publish workflow sign a new preview build with the same app and release ID (`2026.11.19-remote.1`); merging therefore needs the owner's go-ahead.

## GUI 3.9.0 REMOTE — published

Merged via PR #6 as `6fb1406b3359f8523299f906fed16cabe7ee51e2` on 19 November 2026. The first Verify run on `main` was cancelled by the 25-minute job timeout while the browser install stalled on the Ubuntu mirror; one re-run passed, Publish signed preview passed including the public channel check, and release `ota-preview-6fb1406b3359f8523299f906fed16cabe7ee51e2` ("GUI 3.9.0 · REMOTE · preview") is public with archive, manifest (label and notes) and signature. Pi installation and physical acceptance were not observed at publication.

The owner reported on 19 November 2026 that 3.9.0 installed on the Pi, after the local player was restored. Installation had been blocked because `tunebox-player.service` could not start: the opt-in `startupMaximum20V` policy was enabled while the last PD request had failed with an I²C `[Errno 5] Input/output error`, so `player_power_guard.py` kept the player stopped; Music Assistant therefore could not sync the player and manual install refused (playback state unknown). The owner disabled the startup policy on the device. Remote pairing, the room sweep and the volume rail were not yet reported.

On 19 November 2026 the owner approved the GUI 3.9.0 REMOTE candidate (`2026.11.19-remote.1`, cache 49) with "ja push maar", after being told it was committed locally and that the final local Chromium/offline/WebKit run was still in progress. Scope: phone remote control by QR code; room-measurement start fix, remaining time, large stop button and automatic stop of other audio after confirmation; volume rail on the 1280×800 Now Playing screen; tap-to-step volume; readable update names. The approval covers the review branch (`claude/ota-update-test-status-alqo95`, PR #6, which also carries the AGENTS.md cleanup), required CI and fixes within this scope, merge and signed preview publication after the full configured CI passes. It does not cover live hardware experiments or physical confirmations; phone pairing over the real Wi-Fi, a real microphone sweep and the Pi screen layout remain unobserved.

## GUI 3.8.3 PD QUERY — published

Merged via PR #5 as `ffc0be8801584c83170e3f22ec0db0ca75f04caa` on 19 November 2026 (merge performed by the owner). Verify on `main` passed, Publish signed preview passed including the public channel check, and release `ota-preview-ffc0be8801584c83170e3f22ec0db0ca75f04caa` is public with archive, manifest and signature. Pi installation and physical acceptance were not observed.

### GUI 3.8.3 publication approval

On 19 November 2026 the owner explicitly approved publishing this expanded candidate with “Als je klaar bent mag je ota pushen”. This authorizes the scoped review branch, required CI and fixes within this update, merge and signed preview publication after the configured checks pass. It includes the HUSB238 source-query repair and the requested beginner wording, Developer organization, visible waiting and cursor corrections (release `2026.11.18-pd-query.1`, cache 48). It does not authorize live PD experiments or fabricated hardware confirmation. Physical cold-start and power acceptance remain separately unobserved.

### Current HUSB238 source-query repair

The owner subsequently asked to include beginner-friendly wizard/settings wording, move engineering controls under Developer, make waiting visible and remove cursor flashes during cold start/OTA. This extends the same 3.8.3 candidate; publication is now separately approved above. Preserve the existing PD safety/qualification semantics and splash artwork. Revalidate the changed UI, cursor installation under the updater's private umask, first-paint progress page and relevant offline/startup flows. The preceding local review archive is superseded until this expanded candidate is validated.

On 18 November 2026 the owner asked to read the HUSB238 documentation and fix the negotiation while the system is off. This authorizes local implementation and testing of GUI 3.8.3 PD QUERY (`2026.11.18-pd-query.1`, cache 47), not a new push, signed publication or live PD operation. Add an explicit bounded Get_SRC_Cap query before setup/request and an opt-in maximum-offered-20V startup policy; preserve the legacy exact-profile/100W policies, cable confirmations, idle gates and interruption journal. The stored 3A offer does not prove a 5A offer exists. Do not force 5A, select 5V, issue hard reset or invent INA228 voltage-sense confirmation. Complete local validation and present the candidate before separate publication approval.

### GUI 3.8.2 publication approval

On 18 November 2026 the owner explicitly approved the reviewed GUI 3.8.2 PD60 candidate with “Ja push maar”, after being told that 3.8.2 was tested locally and 3.8.1 remained the published OTA. This authorizes the scoped review branch, required CI and fixes within PD60 scope, merge and signed preview publication after the configured checks pass. It does not authorize a live PD request, a voltage change on the Pi or physical INA228 wiring confirmation. Later updates still need separate approval.

After the local review, the owner opened ISET and reported loss of boot. The owner then measured about 5 V at the connected HUSB238 output, attempted an ISET bridge with a crocodile clip and subsequently reported that the Pi boots again. No post-recovery 20 V readback or new 60 W contract has been observed. ISET closed is sufficient for the software request; it is the original 1.25 A startup setting. Keep the startup profile and verified I2C request distinct. VBUS remains unconfirmed.

### Current local offered-profile repair

On 18 November 2026 the owner said “Ja Lets go” to building a stable verified 60 W contract after real readbacks showed 25 W active and 60 W offered. This authorizes local implementation/testing of GUI 3.8.2 PD60 (`2026.11.18-pd60.1`, cache 46), not a new external push, publication or live negotiation. The offered fixed-20 V profile may be verified at 3–5 A; over 3 A still requires 5 A cable confirmation. Preserve legacy strict-100 W semantics, existing safety/OTA/audio gates and unconfirmed VBUS. Prepare a concrete tested candidate before requesting separate publication approval. See [the scope](docs/pd60-setup.md) and [validation](docs/pd60-validation.md).

GUI 3.8.1 PD was published at `fa5707c6130ffb2c38a4d5378a4305c9f28af867`; the owner confirmed installation. Real measurements show the INA228 ADC running but VBUS near 0 V, so its voltage-sense wiring remains unverified. Do not mark it confirmed in software.

### User approval for updates

The owner separately approved the reviewed GUI 3.8.1 PD candidate with “Push maar” on 18 November 2026. This authorizes its review branch, required checks and CI fixes within this PD scope, merge and signed preview OTA publication after the full configured CI passes. No new live PD request or physical VBUS confirmation is authorized by publication. This approval is specific to this update; later updates still require permission.


## Earlier records (3.5.0 – 3.8.0)

The owner requested a local patch for the observed 25 W contract and missing consumption, then said “Go” to continue on 18 November 2026. This authorizes local implementation/testing of GUI 3.8.1 PD (`2026.11.18-pd.1`, cache 45), not an external push or live negotiation. This new request extends the earlier POWER read-only scope only to a separately confirmed fixed 20 V / 5 A request, verified readback and opt-in qualified startup. See docs/pd-100w-patch.md. Telemetry stays read-only; no arbitrary voltages, resets, live Pi experiments or invented VBUS confirmations. Present the completed patch and tests before seeking approval to publish it. Prior POWER publication approval does not carry over.

The owner requires explicit permission before pushing or publishing updates.

- Prepare changes locally and complete the relevant tests first.
- Present the concrete changes and validation results for review.
- Do not push commits, publish GitHub releases, trigger OTA publication, or deploy an update without the owner's explicit approval for that update.
- Earlier blanket authorization to push updates does not override this requirement, established on 2026-11-13.
- Local edits, builds, tests and read-only checks remain authorized within the requested task.

The owner approved publishing GUI 3.5.0 to the preview channel on 2026-11-14. That approval is specific to this update and does not authorize later updates.

### Performance and candidate review

Follow [the development workflow](docs/development-workflow.md) for GUI/system changes. Preserve before/after evidence, keep simulator and Pi measurements distinct, and check safe volume gestures, local/group audio independence, offline recovery and update progress when affected. Before publishing a candidate, notify the owner and collect their remaining improvement points.

The owner approved the reviewed GUI 3.6.0 CONNECT candidate with "Oké push it" on 2026-11-16. It was merged as `cbb7a7e64a78cfb96dad9d07953e05e969d7edaf` and published to preview through successful Verify/signing workflows. The public signature, complete inventory, approved runtime sources and channel selection were independently checked. Pi installation and physical acceptance were not observed here.

Later controls work, including manual-update pausing and the implemented wizard/DSP/sync work in [setup-automation.md](docs/setup-automation.md) and remaining proposals in [next-controls.md](docs/next-controls.md), was initially local only. The owner authorized publication of the SETUP candidate on 2026-11-17, as recorded below. The owner chose manual installs to pause music and scheduled installs to wait for idle. The owner will make the splash in Canva; do not change it as part of this work.

The local SETUP candidate is GUI 3.7.0, release `2026.11.16-setup.1`, service-worker revision 42. Connection choices are additive: Wi-Fi/Ethernet/Bluetooth and Music Assistant may coexist. Optional sound/sync wizards never become mandatory for finishing basic setup. See [validation](docs/setup-validation.md); browser/socket/package fixture checks are blocked by the current sandbox and must not be called passed. The owner authorized this candidate with "Push maar" on 2026-11-17 after being told which checks remain open. This authorization covers the review branch, CI fixes within this scope, merge and signed preview OTA publication. Run the full available GitHub CI before merge/publication. Physical Pi and microphone acceptance remain separate, unobserved checks.

GUI 3.7.0 was subsequently pushed as `df308ecb237fbff723cab98e464617e3671ce291`. Its public signature, complete archive/source inventory and preview selection were independently verified. The owner now reports that OTA runs but DSP Save fails. A separate local repair candidate, GUI 3.7.1 DSP (`2026.11.17-dsp.1`, cache 43), adds the amixer `--` option boundary for negative values in all four DSP write paths, with native GNU parser regression tests. The owner separately approved this reviewed repair with "Ja go" on 2026-11-17. This authorizes its review branch, required checks and fixes within this DSP scope, merge and signed preview publication. Do not treat this approval as permission for later updates. The owner confirmed a readable Equalizer with On=0/Off=1, current value 1 and cget exit 0 after restoring redirected SSH stdout; physical Save/readback of the repair remains unobserved.

GUI 3.7.1 DSP was published and independently verified at `99a60d9139cdda2ddefe54ac8054ea3344202706`. The next local candidate is GUI 3.8.0 POWER (`2026.11.17-power.1`, cache 44): INA228 consumption and HUSB238 contract telemetry. The owner confirmed both Adafruit boards and series current wiring; VBUS voltage sense remains unconfirmed. See docs/power-monitoring.md and docs/power-validation.md. The owner separately approved this reviewed candidate on 17 November 2026 with “Zodra je klaar bent mag je de Ota pushen”. This authorizes its review branch, required CI fixes within POWER scope, merge and signed preview publication after the full available CI passes. Physical board acceptance remains unobserved; the INA228 VBUS confirmation must remain false until actually verified. Complete available local checks and report blocked browser/socket checks honestly; CI must pass on the approved review branch and before signed publication. PD hardware remains read-only; do not add voltage requests/resets on the live Pi supply.
