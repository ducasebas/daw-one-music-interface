# GUI 3.10.0 · POLISH — validation

Local candidate `2026.11.19-polish.1` (cache 52) on branch `claude/ota-update-test-status-alqo95`. All results come from the browser simulator in a Linux container. None of them is a Pi or physical measurement.

## Passed locally

| Check | Result |
|---|---|
| `npm run check` (unit tests + production build) | 407/407 passed, build OK |
| Python tests (`pytest tests`) | 109 passed |
| Full Chromium browser suite (`playwright test`) | 210/210 after one fix (the first run had 209 passed and 1 failed: the language test looked for the music navigation, which Settings now hides by design (item 14). The test now checks the translated label in the DOM, and `wall.spec.js` passes in full) |
| Production/offline suite (`playwright.production.config.js`) | 16/16 passed |

New or changed tests: `release.test.js` (startup title), `search-suggest.test.js`, `meter-scale.test.js`, `update-notice.test.js`, `power-off.test.js` (reboot/restart validation, fixed helper, update and idle gates, simulation); browser: `polish.spec.js` (startup title, wizard skin, MA prefill without token, restart controls), `connect.spec.js` (3-character minimum, debounce, prefix cache, suggestions above the keys), `appliance-update.spec.js` (tap-to-seek once without snap-back, drag preview, update notice offer → installed → dismissed), `audio.spec.js` (dB labels, red zone, needle position), `volume.spec.js` / `wall.spec.js` (footer volume size, ≥ 3 px outlines, no rail, no scrollbar). Tests that expected a disabled Save button in a clean state now expect no save bar at all (item 18).

## Blocked / not run

- **WebKit suite**: no WebKit browser is installed in this container. Not run, not passed; GitHub CI must cover it.
- **GitHub CI**: not run. Nothing has been pushed (owner approval required).

## Not observed on the Pi (physical acceptance open)

- Footer volume, 3 px outlines and the absence of a scrollbar on the real DSI panel; touch scrubbing on the real panel.
- Startup title readability over the splash on the panel.
- Reboot and service restart on real hardware. These need a one-time host-helper refresh (`sudo bash /opt/daw-one/deploy/update-appliance.sh --apply`); until then the buttons stay disabled with an explanation. No reboot or restart was performed here.
- The "Update installed" notice after a real OTA restart.
- Search debounce and cache against a real Music Assistant server.

## Before/after evidence

Simulator screenshots at 1280×800 (`panel=wall-16-10`) are in [images/polish-3-10](images/polish-3-10): `before-*` (3.9.2 HOTFIX) and `after-*` (this candidate) for Now Playing, meters, Settings overview/section/system/dirty, search and wizards (warm-bronze, cinematic), plus `polish-startup.png` and `connect-suggestions.png`.

## Verify on main (after merge of PR #9)

The first Verify run on `main` (`65fcce0`) failed in `wall.spec.js:57` ("Video Artwork" not found). Cause: the test taps "Open Now Playing" right after Save, and `SettingsHub` silently ignored navigation while a save was in progress (`move()` returned early). The slower CI runner hit that window; locally the test passed 38 times. This race existed before 3.10. Fix: navigation tapped during a save now runs once the save succeeds; on a failed save you stay in Settings and see the error. New tests in `settings-save-regressions.spec.js` (slow save, failed save). The slow-save test fails without the fix and passes with it.
