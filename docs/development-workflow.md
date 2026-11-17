# Development and release workflow

The owner approves each update before signed publication or deployment. Approval for a previous version does not carry over. GUI 3.6.0 CONNECT was explicitly approved on 16 November 2026, merged as `cbb7a7e64a78cfb96dad9d07953e05e969d7edaf` and independently verified after signed preview publication. Later local controls work has no approval for a new GitHub push, merge, OTA publication or deployment.

## 1. Collect and agree the release scope

Keep one list of observations with the screen, action, expected result and actual result. Add new owner feedback before finalizing the candidate. Prioritize accidental loudness changes, shared-room playback, wake/recovery and lost input ahead of visual refinements. Record open design questions instead of silently choosing behavior that can affect another room.

## 2. Measure the existing version

Use the published version as the baseline, under the same screen size and test conditions. Record the build, measurement window and environment. Cover paused music, active music/visualizer, Settings, network loss, standby/wake and room grouping.

Measure navigation feedback, main-thread work, large UI rerenders, API requests, initial JavaScript, memory growth and visible animation stalls. Browser CPU throttling helps compare implementations; it does not establish Pi latency, temperature or power draw. Exclude splash/warm-up from steady-state comparisons and keep the original recordings.

## 3. Implement small changes with explicit budgets

- Aim for visible touch feedback within 100 ms on the real device. An external Music Assistant command can take longer; pending feedback must appear immediately and errors must restore usable controls.
- Aim for 60 fps for the visible meter/transition at 1280×800. Animate small transform/opacity surfaces; avoid rerendering menus on each meter frame or playback-clock tick.
- Keep one live state channel with bounded HTTP fallback, not two competing status feeds. Bound in-flight requests, discard stale responses and stop hidden/unneeded work.
- Use monotonic clocks for local watchdogs and timing windows, so changing the system time cannot stall recovery or extend fast polling indefinitely.
- Preserve the local PCM/selected-remote distinction. Optimize display work without changing audio timing, routing, group queues or volume limits as a side effect.
- Compare bundle size, idle CPU work and memory against the accepted baseline. Investigate a sustained regression of more than 10% in main-thread work or startup code before accepting it. Timing estimates are review signals, not flaky timing-only CI assertions.
- Use deterministic regression checks for request counts, bounded rerenders, stale-response handling and safe gestures. Stop an accidental jump to maximum volume at the input layer.

## 4. Validate one candidate

Run relevant unit tests and browser journeys, then production/offline checks when loading or caching changes. Test never-visited lazy screens after an offline reload. Keep API reads and update progress live; APIs and credentials must never enter the service-worker cache.

For changes affecting the shared shell, playback, grouping or startup, run the broader Chromium and WebKit journeys before release. Do not keep changing app code while its acceptance suite is running. Record failures, fixes and the exact final rerun scope.

On the Pi, confirm touch response, volume drag, pause/skip, visualizer behavior, standby/touch/button wake, Wi-Fi recovery and TuneBox/Rivo behavior. Observe CPU/temperature/memory during normal listening and check that memory settles. Do not provoke the unresolved power fault. A browser-fixture result is not a physical audio, sync or power certification.

An authorized test candidate can reach the Pi through preview OTA after that candidate's explicit approval. Mark physical acceptance separately; a preview publication does not by itself mean the hardware test passed.

## 5. Review before publication

Tell the owner the candidate is ready for review, with a short change list, before/after measurements, passed checks and remaining hardware checks. Invite the last improvement points. Use an explicitly authorized review branch for source review. Wait for explicit approval of the reviewed candidate before merging to main or publishing it. Without separate review-branch authorization, do not push. A test build on the Pi also requires the owner's authorization.

## 6. Publish, verify and observe

Publish only the approved source through the existing Verify/signing pipeline. Verify the public signature, full archive inventory and selection of the approved commit by the update channel. Keep the previous application slot and explain any host-helper refresh required by the update.

Report the installed build after the owner's OTA test and record real device observations separately. Carry unresolved items into the next release. A new feature must retain the same response and resource budgets; do not declare it finished solely because it builds.
