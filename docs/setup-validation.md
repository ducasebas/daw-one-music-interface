# SETUP candidate validation

Candidate: `2026.11.16-setup.1` / GUI 3.7.0 · SETUP. Status: owner approved push and signed preview publication on 17 November 2026 with "Push maar", after disclosure of the open checks. Full GitHub CI must succeed before merging and signing. The local evidence below describes the restricted workspace; hosted CI runs are linked from the repository Actions page. Physical Pi/microphone acceptance is still unobserved. The approved published baseline is GUI 3.6.0 CONNECT, commit `cbb7a7e64a78cfb96dad9d07953e05e969d7edaf`.

## Software evidence

Final executable subset: **286 passing tests across 48 test files**, with the explicit filters below; production build passed; syntax checks passed for 107 JavaScript modules and 22 shell scripts. The final manual-update and server-rendered-wizard tests were rerun after their last related edits. No HTTP/browser/native-hardware pass is implied by these totals.

The main application module is **683,850 bytes** versus **641,123 bytes** in the published preview (+6.66%); gzip is 209,560 versus 198,841 bytes (+5.39%). All asset JavaScript grows by 8.38%. The 8,524-byte appliance bootstrap shim is unchanged. These are build-size measurements, not Pi CPU or frame-rate measurements. The new lazy wizard assets are present, and the startup media files match the published splash byte-for-byte.

The current run's results, exact file selection, exclusions, individual logs, build output and bundle comparison are retained under `/workspace/tunebox-wizards-notes/`. `validation.json` records the final counts and hashes. These checks do not certify physical audio or a real Pi installation.

Coverage includes bounded genre selection; baseline capture/restore; inactive positive EQ and intermediate ALSA headroom; source interruption; Bluetooth fallback and return; avoiding a double Warm target; local versus selected-remote metadata; follower metadata; fixed command validation; concurrent read-only probes; event coalescing; ALSA idle detection; synthetic delayed PCM/microphone sessions; cancellation; stale references; clipping, ambiguous timing and drift rejection; route/group profiles; profile-specific fine adjustment; bounded persistent storage; write failure; updater idle gates; existing manual-update and multiroom policies; and English/Dutch server-rendered wizard semantics.

The production build, JavaScript/shell syntax and the generated offline asset inventory are checked separately. New optional wizards are distinct lazy modules and are present in that inventory. The service-worker revision is 42. The version/cache change identifies this local candidate; it does not publish it.

## Checks that remain blocked here

The current sandbox denies local socket binding and Chromium IPC (`EPERM`). Chromium/WebKit click, layout and production/offline journeys cannot be reported as passed in this environment. The browser specs are authored and can be enumerated; enumeration is not execution. Earlier controls-only browser passes predate these changes and do not certify this candidate.

Eight Node test files remain excluded in full because their socket/native-compiler fixtures cannot run here. Two other socket-dependent files run only their independent policy/protocol cases. Four socket test cases and the two tar-spawning package/runtime integration cases are filtered explicitly; they are not counted as passes. The native PCM file also fails before its tests can start because spawning the C compiler is denied. They must be rerun together with the full suite before publication. See `socket-exclusions.json`, `test-filters.json` and the per-file logs in the evidence directory.

Run in an environment that permits the required processes and local test servers:

```bash
npm test
npm run build
npm run test:ui
npm run test:webkit
npm run test:offline
```

The new browser cases cover additive first start, defer/reopen, PIN protection, a skipped slow server probe, password privacy, optional speakers, unsupported hardware exits, visible wizard controls at 1280×800 and 1280×400, microphone consent/progress/result saving, a rejected result and loading never-visited lazy wizards offline. Include the broader shared-shell, playback, multiroom, safe-volume, standby and update journeys in the final release run.

## Device acceptance after a separately approved test build

- Reopen each wizard; finish basic setup with different combinations of Wi-Fi/Ethernet/Bluetooth/MA and with optional steps skipped. Confirm previous connections and queues are retained.
- Verify Louder controls, current faults, custom/flat/warm initialization, manual restore and Bluetooth fallback at low listening volume. Test genre changes with real MA metadata while the screen views TuneBox and Rivo. Verify the reference is not overwritten and another room's volume is untouched.
- Use a supported USB microphone. Verify actual capture buffering and timestamps, stop/cancel behavior, uncertainty, repeatability, group/route/sample-rate matching and the audible alignment at the listening position. Check that bad captures cannot be saved and no raw recording exists.
- Check both screen sizes for clipped text and persistent footer controls, English/Dutch labels, native popups, text selection and keyboard behavior. Confirm the published splash assets were not changed.
- Measure actual Pi touch feedback, idle/playing CPU, memory settling and visualizer smoothness. Keep the screen's stable separate power arrangement; do not provoke the unresolved GaN power fault.
- Verify manual OTA pauses the intended local output or requests the named group confirmation; scheduled OTA waits. Confirm synchronization blocks installation, switching automatic sound to manual permits rollback, and the previous application slot remains recoverable.

No real MA account/BlueZ pairing, microphone latency, Pi response time, thermal behavior, fan control, amplifier watt limit, power stability or seamless group join has been certified here. The deferred Rivo stop-on-power-off report is not fixed by these wizards.
