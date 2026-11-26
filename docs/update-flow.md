# GUI 3.17.0 · FLOW — local candidate

Release `2026.11.25-flow.1`, cache 74. Publication was approved on 26 November 2026 after the requested header refinement; required GitHub checks and signed publication are pending. It starts from published GUI 3.16.6 (`6ecd80f3ad5d511ba501863443532bd6b834929f`). See [validation](update-flow-validation.md).

## Where to find it

| Feature | Location |
| --- | --- |
| Recommended / Smooth / Full graphics | First start → Welcome; Settings → Display → Now Playing |
| Header clock | Settings → Display → Now Playing |
| Floating widgets | Settings → Display → Choose widgets; also used in the Widgets rest view |
| Visualizer sensitivity and response | Settings → Display → Visualizer appearance; Save applies the preview |
| Reset only the visualizer appearance | Same section; does not reset DSP, source gain or timing |
| Minimum / maximum brightness | Settings → Display, with Automatic brightness enabled |
| Presence distance and absence delay | Settings → Display → Presence |
| Start song radio | Now Playing, alongside the visualizer control |
| Phone name | First paired phone view; Phone name on the remote footer to rename later |
| Actual output format and PCM data rate | Settings → System → Developer → Audio → Audio diagnostics |

Existing widget selections, volume limits, room choices and timing corrections are retained. A phone nickname is user-entered; TuneBox cannot discover a person's iOS device name automatically.

## Changes

- The normal and automatically collapsing wall headers are transparent and 96 px tall, with 36 px symbols, larger labels and more space around the controls. Settings retain their compact header. The visualizer and widgets keep their positions when the header hides; the graph has its own full-height column so larger text and controls cannot squeeze it out.
- Larger floating widgets with icon and value, accessible names and no permanent card. Larger separate title, artist and album rows; fit long text within a readable size range, then scroll only the text. A minute clock is on by default in the header and can be turned off.
- Recommended graphics mode selects fewer effects on Pi 2/3/4 and CM3/4. Full effects remain optional. Choose in the first-start wizard or Display. This affects decoration and visual motion, never audio resolution, routing or gain.
- Smooth local playback position with a larger seek handle and stronger times. The native control paints without React frame commits, stops its animation work during startup/rest and catches up after wake. Drag preview commits once on release. Visualizer-off has an enable invitation. Sensitivity redistributes the visual scale; measured values and the printed meter scale remain consistent. Response and sensitivity are in Display, with their own reset.
- Meter-only views can skip the FFT work; a concurrent spectrum view retains its bounded spectrum lease. Switching meter type keeps the existing analysis channel. The reader still expires without visible demand. The feed is local PCM analysis over loopback, not a downloaded music stream.
- Song radio uses Music Assistant's `player_queues/play_media` with `radio_mode: true`. The server binds the seed to the actual current song, rechecks player/queue selection and existing volume/group guards, and asks before replacing queued songs. A provider without similar-track support can refuse the request; no mutation is retried.
- Paired phones can choose and change a recognizable Party mode name, limited to their own credential. The browser cannot read the device owner's iOS name automatically.
- Relevant Music Assistant outages use an owned, dismissible dialog. A sparse, read-only ALSA check detects repeated explicit XRUN states during local playback; it pauses only the local amplifier using the existing standby helper. Missing analysis, silence and stopped playback are not faults. Resume remains manual. Developer → Audio shows the current ALSA format, rate, channels and PCM data rate; these are not network bandwidth or amplifier power.
- After healthy, committed activation, an update helper waits for the new interface to visibly acknowledge its restart warning, counts down and reboots once. The compatibility bridge covers delivery by the previous updater. Failed/rolled-back activation, missing acknowledgement, active playback or a pending operation never triggers the reboot. Failed restart scheduling leaves a manual restart notice. Intentional appliance-maintenance opt-outs stay off; that path may need a manual restart.

## Separate queue

Native higher sample rates need a separately reviewed driver change; see [roadmap](roadmap.md). This candidate leaves the driver's advertised formats, Squeezelite arguments, speaker gain, PD setup and the owner's splash artwork unchanged. Do not automatically reduce music quality to mask display load.

## Physical acceptance still required

No real Pi is accessible from the cloud. Browser measurements do not establish Pi timing, uninterrupted analog audio, real reboot success or the cause of earlier resets. Confirm normal touch response, visualizer switching during listening, standby/wake, phone names, radio/provider compatibility and one normal OTA/restart after explicit publication approval. Do not reproduce the unresolved power interruption deliberately.

The temporary `applianceUpdates=false` setting has not been read back; restore only the owner's intended policy after checking it. Current physical channel gains were both −9 dB with a zero/cut-only EQ curve; no gain change belongs to this candidate.
