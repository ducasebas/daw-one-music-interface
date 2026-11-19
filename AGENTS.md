# Agent instructions

Standing rules for every agent (Claude, Codex) working in this repository. Past approvals and per-release scope live in [docs/release-history.md](docs/release-history.md); read it only when the history matters.

## Current state

- Published preview OTA: GUI 3.11.0 · LIVELY (includes the 3.10.1 scrub fix), release `2026.11.19-lively.1`, service-worker cache 54, commit `4d358b18b10ea6b866beddb3cd8229586184e713` (19 November 2026).
- Candidate GUI 3.11.1 · STYLE (`2026.11.19-lively.2`, cache 55): approved 19 November 2026 ("Push maar"), in review. The next candidate uses cache 56 and must update `notes` in `shared/release.js`. Restart controls from 3.10 need `sudo bash deploy/update-appliance.sh --apply` once on the Pi.
- 3.10.0 is installed on the owner's Pi (reported 19 November 2026, "looks beautiful"); its individual touch/notification points are not separately confirmed. The last PD request (on 3.9.x) failed with an I²C I/O error; the startup PD policy was disabled on the device.
- Physical acceptance still open: cursor hidden on cold start, real PD source query and 20 V contract/stability, INA228 VBUS wiring; for 3.9.0, phone pairing and control over the real home Wi-Fi.

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

- Never invent hardware confirmations. INA228 VBUS voltage-sense wiring is unverified (ADC runs, VBUS reads near 0 V); keep its confirmation false in software until the owner physically verifies it.
- PD: no live PD experiments, arbitrary voltages, 5 V selection, hard resets or forced 5 A. Requests stay fixed 20 V at documented current targets, each separately confirmed on the device; above 3 A requires 5 A cable confirmation. A stored 3 A offer does not prove a 5 A offer exists.
- Preserve legacy strict-100 W and exact-profile policies, cable confirmations, idle/audio/update gates, the interruption journal and opt-in startup policies.
- Keep the HUSB238 ISET startup profile (closed = original 1.25 A) distinct from the verified I2C request.
- Do not provoke the unresolved Pi/display power interruption.

## Product decisions

- The splash artwork is made by the owner in Canva; do not change it.
- Manual installs pause music; scheduled installs wait for idle.
- Connection choices are additive (Wi-Fi/Ethernet/Bluetooth and Music Assistant may coexist). Optional sound/sync wizards never become mandatory for basic setup.
