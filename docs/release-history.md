# Release and approval history

Moved verbatim from `AGENTS.md` on 19 November 2026 so agents do not reload it every turn. Newest first. These records document past scope and approvals; none of them authorizes a later update. Standing rules live in `AGENTS.md`.

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
