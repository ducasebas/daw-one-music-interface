# GUI 3.15.3 · HOTFIX: scope and validation

Release `2026.11.21-hotfix.1`, service-worker cache 66. Approved by the owner on 21 November 2026 ("ja, widget fix erbij en dan pushen": add the widget fix, then push).

| Owner report | Change |
|---|---|
| 100 W now works; before that there was "a very short popup, then nothing" | **Error window:** a refused source query stays visible as "Power setup could not start", with the reason.<br>• **Journal:** the device manager also logs rejected actions, with the bounded message and no arguments.<br>• **Automatic pause** (owner request): tapping "Set up offered power" runs the same preparation as the room sweep (stop sync and Bluetooth, leave the group, pause only this player) on the server, then queries the adapter. The dialog lists what was stopped. The 100 W request itself is unchanged and still needs its own confirmation including the 5 A cable. |
| Sync: "microphone clipping or capture buffering is too high" (on 3.15.2) | **Sample clock:** sample times now follow from the sample index, anchored on the soonest-arriving chunk, so bunched delivery on a busy Pi no longer skews or rejects the measurement. A fixture with bursts up to 400 ms late gives identical timestamps.<br>• **Messages:** clipping and a stalled recording (> 2 s) get separate, translated messages. |
| Reference timing as the zero line for new TuneBoxes | **Deferred by the owner** until a good measurement exists. `shared/timing-reference.js` exists with zero timing. |
| Intermittent widget test (`lively.spec.js:38`) | **Root cause:** the test mocked `/api/state` with a copy taken before Save, so a state poll after Save restored the old widgets. The mock now serves live preferences: 30/30 on 5 repeats, against 4 of 5 failing before. |

## Local results (container/simulator, not the Pi)

See the release history for the final local and CI results.

Not observed on the Pi: automatic pause before the power query, a successful sync with the sample clock.
