# GUI 3.15.0 · GUIDE: validation

Local candidate `2026.11.20-guide.1` (cache 63) on branch `claude/ota-update-test-status-alqo95`. All results come from a Linux container: the browser simulator, unit tests and synthetic data. None of them is a Pi or physical measurement. Not pushed, so GitHub CI has not run.

## Passed locally

| Check | Result |
|---|---|
| `npm run check` (unit tests + build) | 429/429, build OK |
| Python (`pytest tests`) | 111 passed (adds Bluetooth transport and link history) |
| Full Chromium suite | 235/235 |
| Production/offline suite | 16/16 |

New browser tests:

| Test | What it covers |
|---|---|
| `room-correction.spec.js` | The whole wizard. No sweep before confirmation, cancel sends nothing. It also covers the separate DSP confirmation, the check sweep with `verifyCorrection`, waiting for a microphone, the louder retry and blocked leaving during a sweep. |
| `bluetooth-quality.spec.js` | Setup steps; SBC 328 kbit/s and AAC 256 kbit/s from real configuration bytes; stable versus unstable connection. |
| `update-sheet.spec.js` | Full-screen review (duration, changelog, expectations, nothing installed before "Install now"); the running update sheet with elapsed time and estimate. |
| `search-overhaul.spec.js` | At least 4 readable suggestions of 64 px or more above the keys; keys at least 56 px. |
| `remote-share.spec.js` | Notifications on the phone with persistent dismiss; invite QR, PIN note, copy link. |

Changed tests:
- update tests click "Install now" after "Install update";
- `startup-join` expects `.update-sheet`;
- `connect.spec` uses the new suggestion names ("Artist · Song");
- room measurement opens the advanced tools.

New unit and HTTP tests:
- SBC and AAC bitrate reference values; stability verdicts; sanitising of link and transport fields;
- Louder HAT health grouping (idle clock is a notice, over-temperature is a fault);
- remote notification fields;
- phone invite: unpaired caller gets 401, kiosk port gets 404, the invited phone pairs;
- `targetDeviation`.

Screenshots (simulator) are in [images/room-correction](images/room-correction) and [images/feedback-3-15](images/feedback-3-15). `search-before.png` and `search-after.png` show the search change.

## Not run or not observed

- **WebKit:** not installed here; GitHub CI covers it.
- **On the Pi:**
  - the wizard with a real microphone;
  - the Bluetooth codec, bitrate and drop-outs from a real phone;
  - the update duration history and the new update page;
  - notifications and invite on a real phone over the home Wi-Fi.
- **Host-helper refresh:** these parts need `sudo bash /opt/daw-one/deploy/update-appliance.sh --apply` once.
- **Web Share:** the button only appears where the phone browser allows it. Over plain `http://` on the LAN, browsers usually don't, so "Copy link" is the reliable path. Browsers likewise only allow system notifications over HTTPS, so phone notifications appear on the remote page (with vibration where supported), not as system push messages.
