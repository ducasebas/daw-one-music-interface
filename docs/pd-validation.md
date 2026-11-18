# PD patch validation

Candidate: **GUI 3.8.1 · PD**, `2026.11.18-pd.1`, cache 45. Base: published `007be01baa693a577e33f1fc46d8bbc8c3666207`. The owner approved the reviewed patch for its review branch, complete CI, merge and signed preview publication on 18 November 2026. Installation and hardware acceptance remain unobserved. The hardware is off; all register and negotiation tests use fixtures.

## Automated scope

- Fixed I²C address/register/value allowlist, complete transfer checks and refusal of FORCE/reset/arbitrary commands.
- Existing 20 V and offered 5 A requirements; second source check before writing; one request and two stable success readbacks; lower/failed/changing/ACK-only responses rejected.
- Durable intent before writes, simulated loss of process/power, no automatic retry after interruption, fresh manual recovery, concurrent lock handling, expired/reused job refusal and same-boot monotonic player guard.
- Manager nonce/result matching, playback/group/test/Bluetooth interlocks, OTA lock, policy rollback and separation of verified contract from a failed settings save.
- Four-key previous-GUI compatibility and policy preservation on legacy sensor saves.
- INA228 setup reasons precede unconfirmed floating conversion readings. No invented zero consumption, no automatic VBUS confirmation.
- Touch UI confirmation/cancel, one pending request, readable progress/errors, Save/Cancel/defaults, wiring guidance and sensor navigation.

## Completed local checks, 18 November 2026

| Check | Result |
| --- | --- |
| Full JavaScript unit/integration suite | 343 passed |
| Final focused power/PD/render checks | 30 passed |
| Python suite, including register vectors, interruption recovery, isolated installation and actual `systemd-analyze verify` | 78 passed |
| Chromium journeys | 176 distinct cases covered across the initial unchanged sections and completed remaining sections; see run history below |
| Focused Chromium sensor/PD journeys after the compatibility/test-clock changes | 10 passed |
| Production/offline suite | 13 passed on the final full rerun |
| WebKit sensor/PD and wall journeys | 20 passed |
| Production build and shell syntax checks | Passed |
| Production dependency audit | 0 vulnerabilities reported |
| Patch replay | Published baseline blobs checked; dry-run and exact content replay with fuzz=0 |
| Local release bundle | Packed and inventory/hash verified; unsigned review artifact, not an OTA publication |

The first broad Chromium run passed 96 cases and stopped when an existing freshness fixture expired before the Sensors page finished opening. The sensor fixture now uses a controlled clock and disables branding only in its mocked sensor snapshots. Application splash preferences/assets are unchanged. The first 93 unrelated cases passed before that stop; all sensor cases and subsequent sections were then run again, **83 passed**, covering 176 distinct current journeys together. This is not represented as one fresh uninterrupted full-suite run. The separate final focused run passed all 10 sensor cases.

The first offline run timed out in the existing volume-choice reload case after seven passes. That case passed in isolation with tracing, followed by a clean full 13-case offline rerun, without a production-code change for that timeout. Initial attempt logs are retained alongside the passing reruns. A future publication must still run the complete configured GitHub CI on the approved branch.

The first GitHub review push passed all 343 JavaScript and 78 Python tests on both Node versions, then reached 102 Chromium passes before a pending sensor-fixture request outlived its page API context during teardown. The sensor tests now explicitly drain route handlers before that context is disposed. This is a fixture cleanup change; the application and PD worker are unchanged. The complete configured checks must pass on the updated review head before merge.

The first main Verify after the CI mirror repair stopped in the existing physical-wake fixture: it injected a wake ID once while live simulator snapshots continued to carry no wake ID, allowing a later frame to erase the event before the React effect ran. The fixture now retains that same wake ID in its HTTP fallback and closes the contradictory live simulator stream before delivering the controlled event. The real backend already retains the wake ID in subsequent snapshots. The assertions still require returning to Now Playing and consuming the event only once; no production code or assertions were removed. The complete configured main matrix is required again after this fixture repair.

Local environment: Node 24.19.0, Python 3.12.14, system Chromium. WebKit 27.2/build 2370 was run with the missing official Debian shared libraries unpacked into the task cache and their downloads checked against the HTTPS package-index SHA-256 values. Its standard system-library inventory check was bypassed because the libraries were installed outside system paths; native headless launch and all 20 real WebKit journeys executed successfully. This affects the test environment only and adds no Pi runtime dependency.

The final main JavaScript chunk is **717,059 bytes**, **218,656 bytes gzip** using Node's compressor. Published POWER's recorded build was approximately 702.11 kB / 214.84 kB gzip, an increase of about **2.1% / 1.8%**. The existing over-500-kB Vite warning remains; it was already present in POWER. The main-thread/request-count browser regressions passed in the unchanged initial section. These checks do not establish Pi timing, temperature or power draw.

The review bundle is built in an isolated source directory from the published tree plus these reviewed changes. Unrelated local enclosure drafts are retained in the workspace and excluded from this power patch. Every unchanged runtime source is checked against its published Git blob; changed/new sources are checked against the patch receipt. The existing generated public key is checked against pinned SPKI SHA-256 `eef81b919977f70e399cb36ceaa5a1e77e278f4c913306f647c3724d37eb39ab`. No private signing key is present. All isolated compiled assets match the assets exercised by the browser tests byte for byte. A test-only compiler preload pins the otherwise variable build-metadata timestamp to that tested build; the production compiler configuration and application clock code are unchanged.

No software test establishes actual 100 W delivery, electrical stability or VBUS continuity. Do not report those physical checks as passed. The local patch receipt records its exact base, files and final hash separately, avoiding a self-referential archive hash inside the archive.

## Security limits

The patch adds no dependency and exposes no general I²C or shell-write endpoint. Requests use the existing origin/nonce/PIN policy and serialized root manager. The separate worker has a fixed operation and limited device/directory access. Public status does not expose the one-use job ID or credentials.

The previously documented development-only picomatch advisory remains a dependency follow-up; it is not resolved by this patch. Production dependency audit and the final runtime inventory must be checked separately. No unsigned image, public key replacement or signing-key change is involved.

## Physical acceptance still open

After the owner authorizes a device test: inspect VBUS with all power disconnected; confirm an appropriate source/5 A cable; enable INA228 and only the wiring confirmations actually verified; pause/ungroup TuneBox; perform the owned 100 W setup once and observe the actual contract. Optional startup repetition needs its own explicit checkbox. Do not provoke the unresolved power fault. Verify normal playback, source changes and startup on real hardware before treating the power setup as physically accepted.
