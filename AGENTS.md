# Agent instructions

Standing rules for every agent (Claude, Codex) working in this repository. Past approvals and per-release scope live in [docs/release-history.md](docs/release-history.md); read it only when the history matters.

## Current state

- Published preview OTA: GUI 3.16.2 · PLAY (widget editor with drag and drop for Now Playing and rest, overlay header without reflow, hold to wake, Keep playing button, crossfade via Music Assistant, SSH switch, leave multiroom after reboot, Pi throttle card; includes 3.16.0/3.16.1), release `2026.11.22-play.1`, service-worker cache 69, commit `4ef3d3adc06d6f675a6cd7522c177db5df614e07` (22 November 2026). True shuffle is only a proposal (`docs/true-shuffle-proposal.md`). On 22 November 2026 the owner's supply offered only 3 A profiles (60 W contract); the earlier 100 W was reported on 21 November.
- Next candidate: bump `shared/release.js` (including its user-facing `notes`) and the cache in `public/sw.js` (next is 70). The following need `sudo bash /opt/daw-one/deploy/update-appliance.sh --apply` once on the Pi: restart controls (3.10), local volume (3.13), the sweep analyser and amplifier-fault rule (3.14.1/3.14.2), the Bluetooth agent, updater duration history and update page (3.15), the sync capture and history (3.15.1), logind `RemoveIPC=no` for the player's PCM export (3.15.2; needs a restart), the power pause, manager refusal logging and sync sample clock (3.15.3), the display controller's full backlight-off (3.16), and the 3.16.1 stop timeout, DSP pacing, kiosk `--disable-gpu`, Wi-Fi power saving, watchdog and timers, and the 3.16.2 SSH manager commands. The 30 fps PCM reader and the Squeezelite `-C`/`-r` changes come only through `install-audio-analysis.sh`. The owner's own `zzz-stability.conf` player drop-in still decides the player arguments. Popups follow `docs/popup-style.md`. The cold-boot console item stays separate and needs the owner. The reference sync timing as zero line for new TuneBoxes is postponed by the owner until a good timing measurement exists.
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
