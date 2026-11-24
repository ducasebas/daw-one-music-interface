# GUI 3.16.4 INTEGRITY: validation

Candidate on `codex/3.16.4-file-integrity`, based on published `df8dd7ccef2eff3d1a2e224e48de9fa14d036b43`. This file records local software checks; the owner has since confirmed recovery of the screen service and activity wake through device API readbacks. A successful OTA to 3.16.4 on the Pi is not yet observed. See [scope and limitations](hotfix-3-16-4.md).

## Fault reproduction and regression coverage

The regression test runs Python on an actual zero-byte file and observes exit 0. The new installation refuses that file without replacing the prior controller. It separately refuses valid-but-truncated Python without the daemon entry point and invalid syntax. The real display installer repairs an already empty installed copy from a valid source and starts a real controller process against temporary backlight files.

Fault injection covers disk-full staging, changed/short staged bytes, file and directory sync errors, failed rename, installed-copy corruption, an abrupt child-process exit before replacement and interruption between files. Before replacement, the previous files remain intact. A partial multi-file replacement cannot pass its previous checksum inventory, and a subsequent verified installation repairs it. The unit's actual coreutils SHA-256 command detects empty/changed/missing installed files and an empty inventory.

The controller health gate rejects stale, unavailable, wrong-PID and frozen status. A real loop must publish advancing samples with its own PID. The complete display installer also refuses a daemon which exits 0 immediately. Its generated service is checked by `systemd-analyze verify`. These tests use temporary filesystem fixtures; no real display, I2C rail, amplifier, volume control or power supply is exercised.

## Final check results

Local Linux results on 24 November 2026:

- `npm test -- --test-concurrency=2`: **481 passed**. A subsequent **11-test** installed-module, English/Dutch and privacy check passed with the new notes and all new files included.
- `python3 -m unittest discover -s tests -p '*_test.py'`: **135 passed**, none skipped. Includes **23 new tests** (18 filesystem/process cases and five complete display-installer cases). After adding malformed-status handling, the final 18-case filesystem/process suite passed again, including the real loop.
- Targeted Chromium appliance/update/wake journeys: **24 passed**. Covers update progress, error/pending feedback, manual group-pause confirmation, offline authority and independent progress-page recovery as well as wake and owned browser controls.
- Production/offline suite: **16 passed**, including first-use lazy screens, retained preferences, moving WebP and offline update controls. `DAW_REMOTE_ADDRESS=127.0.0.1` is the local cloud-test transport override, not a product/network change.
- `npm run build` and local release packaging/inventory verification: passed. The existing large-chunk advisory remains; no production dependency was added.
- `npm audit --omit=dev --audit-level=high`: **0 known vulnerabilities**.
- Shell syntax and `git diff --check`: passed. The fixture-generated display unit also passed `systemd-analyze verify`.

Full configured GitHub CI (including both Node versions and WebKit) and signed-publication verification remain required after explicit approval; local checks do not mean the OTA is published. The local package is unsigned and is not a deployment instruction. Subsequent readbacks confirm the recovered controller, live lux and automatic brightness at 34% after activity wake. Visual acceptance of the interface and a successful 3.16.4 device update remain unobserved. No new physical power or thermal conclusion is inferred from these results.

## Publication CI follow-up

The initial review head `8588095b1aafa99119d45e1af7f58b5bf305c2fc` passed both Node/Python/audit jobs, two Chromium shards and offline/WebKit. Chromium shard 1 exposed an intermittent older settings-save race at the second widget Save. With the first POST response deliberately held after persistence, the regression test deterministically failed: a new `top` placement reverted to `bottom`. This was an actual lost edit, not a justification to increase a timeout or rerun until green.

The correction preserves edits made after submission, takes the confirmed server revision for the next Save, keeps the unsaved indication and defers queued navigation until the new draft is rendered. The full JavaScript suite passed again with 486 tests, including five pure merge tests. Both delayed-response browser paths passed, as did the originally failing widget-order case. Installed-module and privacy checks also passed. The complete configured CI must pass again on the corrected head before publication.

Final stop/recovery review also reproduced execution of a changed controller through the old stop hook after the startup check rejected it. Both stop/restore and updater recovery now require the same verified inventory. Native tests prove changed code is not executed and the recovery journal remains; the updater test additionally executes its harmless marker with the guard removed to prove the runtime is functional. The full Python rerun passed **137 tests**, including **25 new** fault/installer cases; the final updater runtime-control case passed again after its fixture adjustment. The broader local settings/widget/save-navigation suite passed **23 tests**, and production/offline passed all **16** again with the Save correction. The installed-module assertions and shell syntax checks also passed with the guarded recovery command. Full configured CI must pass on this final source before merge.
