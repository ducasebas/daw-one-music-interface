# User approval for updates

The owner requires explicit permission before pushing or publishing updates.

- Prepare changes locally and complete the relevant tests first.
- Present the concrete changes and validation results for review.
- Do not push commits, publish GitHub releases, trigger OTA publication, or deploy an update without the owner's explicit approval for that update.
- Earlier blanket authorization to push updates does not override this requirement, established on 2026-11-13.
- Local edits, builds, tests and read-only checks remain authorized within the requested task.

The owner approved publishing GUI 3.5.0 to the preview channel on 2026-11-14. That approval is specific to this update and does not authorize later updates.

# Performance and candidate review

Follow [the development workflow](docs/development-workflow.md) for GUI/system changes. Preserve before/after evidence, keep simulator and Pi measurements distinct, and check safe volume gestures, local/group audio independence, offline recovery and update progress when affected. Before publishing a candidate, notify the owner and collect their remaining improvement points.

The owner approved the reviewed GUI 3.6.0 CONNECT candidate with "Oké push it" on 2026-11-16. It was merged as `cbb7a7e64a78cfb96dad9d07953e05e969d7edaf` and published to preview through successful Verify/signing workflows. The public signature, complete inventory, approved runtime sources and channel selection were independently checked. Pi installation and physical acceptance were not observed here.

Later controls work, including manual-update pausing and the implemented wizard/DSP/sync work in [setup-automation.md](docs/setup-automation.md) and remaining proposals in [next-controls.md](docs/next-controls.md), was initially local only. The owner authorized publication of the SETUP candidate on 2026-11-17, as recorded below. The owner chose manual installs to pause music and scheduled installs to wait for idle. The owner will make the splash in Canva; do not change it as part of this work.

The local SETUP candidate is GUI 3.7.0, release `2026.11.16-setup.1`, service-worker revision 42. Connection choices are additive: Wi-Fi/Ethernet/Bluetooth and Music Assistant may coexist. Optional sound/sync wizards never become mandatory for finishing basic setup. See [validation](docs/setup-validation.md); browser/socket/package fixture checks are blocked by the current sandbox and must not be called passed. The owner authorized this candidate with "Push maar" on 2026-11-17 after being told which checks remain open. This authorization covers the review branch, CI fixes within this scope, merge and signed preview OTA publication. Run the full available GitHub CI before merge/publication. Physical Pi and microphone acceptance remain separate, unobserved checks.
