# GUI 3.5.0 local validation

Release `2026.11.13-multiroom.1`, prepared from published commit `799df0392f66298371b23a135984749d313d728d`. The owner approved preview publication on 14 November 2026; GitHub verification and signed publication must succeed before device installation. Validation below ran locally with Node 24.19.0 and controlled Music Assistant responses.

| Check | Result |
| --- | --- |
| Node suite | 223 passed |
| Python installation/helper suite | 28 passed |
| Chromium | Earlier 127 scenarios plus 8 startup-join scenarios covered, with targeted regressions |
| Production/offline suite | 9 passed |
| WebKit | Earlier 14 scenarios plus 2 startup-join scenarios covered |
| Production media after the final video fix | Fresh build and byte-range/decode regression passed |
| Production dependency audit | 0 vulnerabilities |

The broad Chromium run initially passed 123 of 126 cases. The remaining cases exposed two test setup assumptions and a drag beginning during a view transition. The remote-wake fixture now isolates startup's automatic wake, the layout test accepts an already-linked video's valid ended state, and the drag waits for an actionable slider. All 14 affected/new room and wake cases passed on rerun, including the new Dutch/light-theme scenario. The formerly intermittent group drag then passed three consecutive repetitions. The full broad suite was not repeated after these localized corrections.

The WebKit run initially passed 13 of 14 cases and exposed video artwork losing its mute state when enlarged. The component now maintains mute and zero video volume, including a browser volume-change event and both dialog transitions. The real-video, failed-decode and track-change cases passed in Chromium. The previously failing WebKit video case and the Dutch/light-theme case then passed. The final production bundle was rebuilt and its byte-range/decode check passed again.

Screenshots were inspected at 1280×800, including the English group controls and Dutch controls with a custom light palette. Layout checks also retain the 1280×400 profile. The initial light-theme capture caught a transition frame; the final inspected capture waits for the group action to be actionable and suppresses animation for the screenshot.

The subsequent startup-join refinement passed 223 Node tests and a fresh build. Eight Chrome cases cover explicit join, no automatic action, per-boot dismissal, a stopped source, an already-playing/grouped local endpoint, excessive local volume, PIN unlock, deferred setup and software-installation priority. An extended join response keeps its progress visible despite early membership state. A targeted 15-case run also covered existing wake, group and first-start behavior; the two core startup flows passed in WebKit. The final production bundle and byte-range/decode check passed after this refinement. Source-level tests verify that joining sends only the membership addition, without a queue/playback or volume mutation from TuneBox. The native provider can nevertheless restart its stream internally, as described in the behavior notes.

## What still needs the actual device

- Discover, group and separate the owner's real Squeezelite TuneBox/Rivo players; verify audible synchronization and queue transfers at a low listening level.
- Read the installed GUI/device-manager DSP response. The HAT's named Equalizer On state was confirmed earlier through `amixer`; availability through the owner's current GUI/helper remains unconfirmed.
- Confirm physical screen stability with a genuinely independent display supply. The owner recovered the unlit screen through a full cold start and clarified that both prior USB feeds shared one GaN charger. A per-port power interruption is plausible but has not been measured.

The GUI screen-rest fix does not certify a repair of the physical display incident. Group tests do not certify power delivery, enclosure cooling or amplifier protection. The subsequent device acceptance test remains separate from the approved preview publication.
