# User approval for updates

The owner requires explicit permission before pushing or publishing updates.

- Prepare changes locally and complete the relevant tests first.
- Present the concrete changes and validation results for review.
- Do not push commits, publish GitHub releases, trigger OTA publication, or deploy an update without the owner's explicit approval for that update.
- Earlier blanket authorization to push updates does not override this requirement, established on 2026-11-13.
- Local edits, builds, tests and read-only checks remain authorized within the requested task.

The owner approved publishing GUI 3.5.0 to the preview channel on 2026-11-14. That approval is specific to this update and does not authorize later updates.

# Performance and candidate review

Follow [the development workflow](docs/development-workflow.md) for GUI/system changes. Preserve before/after evidence, keep simulator and Pi measurements distinct, and check safe volume gestures, local/group audio independence, offline recovery and update progress when affected. Before publishing a candidate, notify the owner and collect their remaining improvement points. GUI 3.6.0 has no publication approval.

The owner requested a GitHub update for the expanded GUI 3.6.0 candidate on 2026-11-15. Prepare a review branch and draft pull request after local validation. This does not authorize merging to main, signed OTA publication or deployment; collect explicit approval for those actions after review.
