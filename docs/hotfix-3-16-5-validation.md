# GUI 3.16.5 validation

Local candidate on `codex/3.16.5-room-selection`. No new OTA is published by these checks; the owner approved publication on 24 November 2026, and the configured CI must pass on the reviewed source before merge/signing.

## Before and after

The pre-change reproduction used the real `LiveMusicService`, `MultiroomService` and `BootRooms` classes with an in-memory Music Assistant transport. With the configured group selected, boot handling selected the local player and saved `changed: false, left: ["select"]`. A new music-service instance reverted to the configured group; the completed same-boot marker then prevented correction.

The regression now initializes from a boot/server/local-output-scoped selection. Tests cover the supplied select-only marker, a second app instance in the same boot, an intentional remote/group choice, a new Pi boot and a saved room that no longer exists. They assert that these selection changes send no play/pause, volume, transfer or membership command, and preserve the other player's state. This is a simulator result, not a physical TuneBox/Rivo test.

Persistence tests also cover changed server/local identity, invalid state, a missing boot identity, write failures, private permissions, no credentials in the file and no repeated write when the selection is unchanged.

The separate footer ring was drawn by `.m2-player-status[data-feedback="pending"]:before`, independent of the already-hidden small-artwork ring. The browser regression holds a playback request open at both display sizes and checks that the pressed button remains busy while the separate footer ring is absent. That preserves visible pending feedback on the actual control.

## Test-fixture correction

The broad Chromium run found a teardown race in the artwork fixture: its mocked state handler was still reading `page.request` after the request context was disposed. `lively.spec.js` now waits for routed handlers to finish in `afterEach`. The 96 already completed unrelated cases and all 164 remaining cases passed; the application source stayed frozen. This change does not add an application delay or relax a product assertion.

## Checks

- JavaScript checks: **498 passed** on Node 24.19.0 (497 in the full suite plus the added HTTP process-restart test). The HTTP test starts the real backend repeatedly, checks room choice through the actual nonce-protected API and verifies that no player/transfer command is sent. It is Linux-specific; the pure selection tests also run on other platforms.
- Production build: passed.
- Focused boot, selection and multiroom run: **34 passed**.
- Privacy and source diff checks: passed, including newly tracked files.
- Chromium: **260 distinct cases passed** on Chromium 154.0.8037.57 with Playwright 1.64.1.
- WebKit wall/footer: **14 distinct cases passed** with native WebKit 2370 and official extracted Debian libraries in `LD_LIBRARY_PATH`. Only the package-inventory check was skipped; the engine launched and executed the assertions. The long six-mode scenario used a 60 s whole-test budget on this host, with its individual assertion limits unchanged.
- Production/offline: **16 distinct cases passed**. Fourteen used an isolated production server; the two cases with fixed-origin assertions ran on the standard port after the Chromium dev server exited.
- Local unsigned archive: verified complete inventory and hashes, including the new `server/room-selection.js`. No signing key or device deployment is involved.
- Production dependency audit: **0 vulnerabilities**.

The original spontaneous reboot cause remains unresolved. No electrical, microphone, speaker-power or hardware stability claim follows from these results. The existing once-per-boot terminal behavior after a membership error remains outside this selection-persistence correction.
