# GUI 3.16.6 validation

Publication approved on 25 November 2026. GitHub CI and signed publication are pending; physical Pi acceptance remains separate.

## Completed targeted checks

- New maintenance tests cover source/dependency classification, GUI/locale/publisher exclusions, real system changes, installed-file corruption and drift, immutable service templates, staging/import failure before replacement, and a partial tool refresh retry.
- An unchanged historical updater fixture calls the actual candidate bridge. Its shell/CLI executes against isolated directories with real hash checks and the atomic file publisher; service and network commands are controlled doubles. It refreshes only updater/page files and never reaches the full-maintenance marker or requests a daemon reload.
- A real updater child process preserves an interrupted maintenance phase and refuses scheduled replay before network/install work. Explicit checks/installs and the existing opt-out remain distinct.
- Public status derives fixed failure copy and excludes private error text. The existing privacy assertion for arbitrary updater errors is retained.

## Local results

- Full JavaScript suite: all 532 checks passed, including 23 maintenance cases and 11 additional local-pause/connection cases. Privacy checks also passed with the new files staged. The final small presentation correction was rebuilt and covered by the six focused browser journeys in each engine.
- Python suite: all 137 checks passed for the unchanged system-helper payload; the hotfix adds no Python or system-installer changes.
- Chromium 154.0.8037.57: 42 broader journeys passed for room control, startup group prompts, the local outage banner, settings, safe gestures, startup/media behavior, layout stability and local PCM demand. The final six disconnection journeys also passed after the presentation correction, including automatic recovery clearing a stale failed-test message without resuming audio. Earlier maintenance-specific update journeys remain recorded in the local logs.
- Native WebKit 2370: 23 broader room/startup/disconnection journeys passed, followed by all six final focused disconnection cases. Official extracted Debian libraries were supplied through `LD_LIBRARY_PATH`; only package-inventory validation was skipped. The actual WebKit engine executed the tests. Whole-test timeout was 60 seconds. Earlier maintenance-specific update journeys also passed.
- Production/offline: all 16 journeys passed, including a first offline visit to lazy settings/wizards, safe offline authority, phone pairing/revocation and startup-media behavior.
- Production build passed. The main chunk grew from the published baseline 658.50 kB / 191.67 kB gzip to 666.83 kB / 193.20 kB gzip (about 1.3% raw and under 1% compressed). No runtime dependency was added. Production audit reported zero vulnerabilities.
- Local unsigned package verification passed with the complete file inventory. Comparing the actual prior 3.16.4 package and this candidate selected `update-tools`, with exactly the updater installer, progress page, updater wrapper/new maintenance module/worker, OTA bridge and public-status helper changed. It did not select full system maintenance.

## Music Assistant hotfix verification

The backend now has 11 additional regression cases covering automatic local mute, one attempt per outage, failed initial connection, blocked sources, concurrent manual/automatic requests, explicit retry after device refusal, same-boot persistence, and actual HTTP reconnect/CSRF behavior. A real backend child and a controlled local-manager socket verify that reconnecting and an app restart retain the local pause without sending group, play, stop or volume commands. Browser validation includes pending/error/retry/recovery, no popup volume controls, Bluetooth and both 1280×800 and 1280×400 viewport bounds.

The first hotfix browser run found the banner extending 20 pixels beyond the short viewport. Its bottom edge is now bounded by the viewport; the corrected geometry cases pass in Chromium and WebKit. The corrected broad suites passed, followed by six final focused cases per browser. All sixteen production/offline cases passed. A failed connection-test message also clears when Music Assistant reconnects automatically; this never sends a local resume.

The first broad JavaScript run exposed an existing intentional security boundary: arbitrary updater errors must not be published. The correction derives user-visible copy from fixed phase codes and leaves the original exclusion assertion intact. A separate umask regression covers the service's `0077` setting: public progress remains `0644`, private diagnostics `0600`, and atomic writes flush both file and parent directory.

GitHub CI, signing and publication are pending after the explicit approval on 25 November 2026. Full configured CI must pass before merge and signed publication.

## Physical limits

These checks do not prove Pi power stability or a watchdog root cause. The first minimal repair, actual manager restart, later unchanged-system skip, normal app activation, touch/wake and TuneBox/Rivo behavior need device observation after an approved publication.
