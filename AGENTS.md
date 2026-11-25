# Agent instructions

Standing rules for every agent (Claude, Codex) working in this repository. Past approvals and per-release scope live in [docs/release-history.md](docs/release-history.md); read it only when the history matters.

## Current state

- Local candidate GUI 3.16.6 · UPDATES (`2026.11.25-updates.1`, cache 73), branch `codex/3.16.6-update-maintenance`, based on published `a7700b5e9eb2ce25d73bba867fa957d0a5d3d20e`. Publication approved on 25 November 2026; see the release history. GitHub CI and signed publication are pending. See [scope](docs/update-3-16-6.md) and [validation](docs/update-3-16-6-validation.md). Local checks: 532 JavaScript and the retained 137 Python cases passed; 42 broader Chromium / 23 native WebKit journeys, six final disconnection cases in each engine, and 16 production/offline journeys passed. Production audit is clear; no dependency was added. Actual package comparison selects the minimal update-tools path. Skips unchanged system services, minimally refreshes update tools/page files through the installed updater bridge, retains maintenance errors and blocks scheduled replay after interruption. The added Music Assistant hotfix automatically pauses only the own amplifier, removes volume from the outage message, offers a token-protected connection test and retains pause across same-boot app restarts; reconnecting never resumes it. The old reset cause remains open. The owner's original `applianceUpdates` flag must be restored for the minimal updater repair to run; final readback is pending.

- Published GUI 3.16.5 · ROOMS (`2026.11.24-selection.1`, cache 72), PR #26, commit `a7700b5e9eb2ce25d73bba867fa957d0a5d3d20e`; all six review and main CI jobs and signing/channel verification passed. Approval and publication are in the release history. Local checks passed: 498 JavaScript, 260 Chromium, 14 WebKit and 16 production/offline cases; production audit is clear. See [scope](docs/hotfix-3-16-5.md) and [validation](docs/hotfix-3-16-5-validation.md). Fixes the reproduced same-boot app-restart selection reset and removes the generic footer pending ring. On 25 November the owner reported a successful update after the supplied GUI-only recovery route; final API readback and restoration of the original `applianceUpdates` setting are pending. A normal attempt rebooted during repeated host maintenance before app activation; reset cause is unproven, watchdog bootstatus was 0, and the retained step trace was from the previous day. Do not repeat that host refresh to provoke the fault. Preserve intentional room choices across app restarts; a new kernel boot defaults to the local endpoint.

- Amplifier follow-up: two self-built single-driver wall speakers reportedly draw about 15 W total at 90% volume; impedance remains unknown. On 25 November the owner supplied both channel gains as -9. All fifteen EQ bands were subsequently read as zero or cuts, so this curve needs no positive-boost reserve. Low-volume review of the existing gain controls was explained; no gain change has been confirmed. Resume with [the retained observations and read-only checks](docs/hardware-next-session.md). Do not raise gain or alter headroom/power limits based only on wattage.

- Previous published preview: GUI 3.16.4 · INTEGRITY, release `2026.11.24-integrity.1`, cache 71, commit `69222be1c4f5df732e5910664412f6785cd324d4` (PR #25). CI, signature, complete archive and channel selection were verified; see [release history](docs/release-history.md). On 24 November an interrupted Pi installation left an empty display controller; the running GUI reported 3.16.2, so successful 3.16.3 device activation is not confirmed. A later API readback confirmed GUI 3.16.4 on the published commit and a successful updater exit without another reboot (the same boot since 20:59:21 CET). The original reboot cause remains unknown. True shuffle remains a proposal (`docs/true-shuffle-proposal.md`); amplifier readings remain deferred.
- Previous published implementation: GUI 3.16.4 · INTEGRITY (published and independently verified), release `2026.11.24-integrity.1`, cache 71, on `codex/3.16.4-file-integrity`. Adds atomic, verified host-file replacement and startup checks for the display, manager and updater, with a live display-process health gate. See [scope/recovery](docs/hotfix-3-16-4.md) and [validation](docs/hotfix-3-16-4-validation.md). The owner approved publication on 24 November; all six review and main CI jobs and the signing/channel workflow passed. The previous display service and activity wake were recovered through SSH; the owner subsequently confirmed this OTA on the published commit with updater Result=success, ExecMainStatus=0 and unchanged boot time. See the release history. Later versions still need new approval. Preserve all 3.16.3 [scope](docs/hotfix-3-16-3.md) and [validation](docs/hotfix-3-16-3-validation.md). The following need `sudo bash /opt/daw-one/deploy/update-appliance.sh --apply` once on the Pi if automatic appliance maintenance is disabled: restart controls (3.10), local volume (3.13), the sweep analyser and amplifier-fault rule (3.14.1/3.14.2), the Bluetooth agent, updater duration history and update page (3.15), the sync capture and history (3.15.1), logind `RemoveIPC=no` for the player's PCM export (3.15.2; needs a restart), the power pause, manager refusal logging and sync sample clock (3.15.3), the display controller's full backlight-off (3.16), the 3.16.1 stability settings, the 3.16.2 SSH manager commands and the 3.16.3/3.16.4 host checks. The 30 fps PCM reader and the Squeezelite `-C`/`-r` changes come only through `install-audio-analysis.sh`. The owner's own `zzz-stability.conf` player drop-in still decides the player arguments. Keep kiosk `--disable-gpu`; popups follow `docs/popup-style.md`. The cold-boot console item stays separate and needs the owner. Reference sync timing is postponed until a good timing measurement exists.
- 3.10.0 is installed on the owner's Pi (reported 19 November 2026, "looks beautiful"); its individual touch/notification points are not separately confirmed. The last PD request (on 3.9.x) failed with an I²C I/O error; the startup PD policy was disabled on the device.
- INA228 VBUS voltage-sense wiring was confirmed by the owner on 20 November 2026 (20.13 V on a 20 V contract).
- Physical acceptance still open: cursor hidden on cold start, real PD source query and 20 V contract/stability; for 3.9.0, phone pairing and control over the real home Wi-Fi.

## Approval per update

The owner requires explicit permission before pushing or publishing updates (established 2026-11-13; earlier blanket authorization does not override it).

- Local edits, builds, tests and read-only checks are authorized within the requested task.
- Prepare changes locally, complete the relevant tests, then present the concrete changes and validation results.
- Do not push commits, publish GitHub releases, trigger OTA publication or deploy an update without the owner's explicit approval for that update. Approval for one version never carries over to the next.
- An approval covers that update's review branch, required CI and fixes within its scope, merge and signed preview publication after the full configured CI passes. It never authorizes live hardware experiments or physical confirmations.
- Record each new approval (date, the owner's words, scope) and the published commit in `docs/release-history.md`, not here.

## Workflow

Follow [docs/development-workflow.md](docs/development-workflow.md). Preserve before/after evidence, keep simulator and Pi measurements distinct, and check safe volume gestures, local/group audio independence, offline recovery and update progress when affected. Before publishing, notify the owner and collect remaining improvement points. Run the full available GitHub CI before merge/publication; report blocked checks honestly and never call them passed. A preview publication is not physical acceptance.

## Working with several agents

- One agent per branch at a time (`codex/...`, `claude/...`). Do not edit another agent's open branch without the owner asking.
- Hand over through the repository: scope in a `docs/*.md` scope file, results in a `docs/*-validation.md` file, approvals in the release history.
- Green CI on the exact commit decides readiness, whichever agent built it.

## Hardware and safety constraints

- Never invent hardware confirmations. The INA228 VBUS voltage-sense wiring was physically confirmed by the owner on 20 November 2026; any other wiring or hardware confirmation still comes only from the owner.
- PD: no live PD experiments, arbitrary voltages, 5 V selection, hard resets or forced 5 A. Requests stay fixed 20 V at documented current targets, each separately confirmed on the device; above 3 A requires 5 A cable confirmation. A stored 3 A offer does not prove a 5 A offer exists.
- Preserve legacy strict-100 W and exact-profile policies, cable confirmations, idle/audio/update gates, the interruption journal and opt-in startup policies.
- Keep the HUSB238 ISET startup profile (closed = original 1.25 A) distinct from the verified I2C request.
- Do not provoke the unresolved Pi/display power interruption.

## Privacy

The repository and its releases are public. Never commit personal correspondence: emails, letters, drafts of messages to third parties, chat transcripts, quotes or summaries attributed to named people, contact details or personal email addresses. Refer to outside parties by role ("the manufacturer"), not by personal name. The owner's name appears only in `LICENSE`. Drafts the owner asks for go in the chat or a scratch file, never in the repository. `tests/privacy.test.js` enforces this in CI; do not weaken it to make a file pass.

## Product decisions

- The splash artwork is made by the owner in Canva; do not change it.
- Manual installs pause music; scheduled installs wait for idle.
- Connection choices are additive (Wi-Fi/Ethernet/Bluetooth and Music Assistant may coexist). Optional sound/sync wizards never become mandatory for basic setup.
