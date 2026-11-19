# GUI 3.10.0 · POLISH — scope

Release `2026.11.19-polish.1`, service-worker cache 52. Source: [roadmap](roadmap.md) section "3.10 · POLISH" (owner feedback, 19 November 2026). Local candidate only; publication needs the owner's separate approval (see `AGENTS.md`).

| # | Roadmap item | Implementation |
|---|---|---|
| 2 | Startup shows update name and version | `releaseTitle()` in `shared/release.js` turns `GUI 3.10.0 · POLISH` into `Polish · GUI 3.10.0`; shown as text over the unchanged splash artwork (`StartupScreen.jsx`). |
| 3 | Search suggestions | `shared/search-suggest.js`: start at 3 characters, 250 ms debounce, AbortController cancels stale requests, bounded 20 s LRU cache per prefix (case-insensitive). Earlier results stay visible while the next prefix loads. Suggestions render in the keyboard dialog above the keys; a test checks that geometry. |
| 4 | Now Playing | 3.9.0 volume rail removed. The footer volume is back and larger (96 px tall track, 52 px thumb, 88×80 px step buttons, 44 px readout, 5 % steps); tap-to-step and hold-to-step kept. Outlines ≥ 3 px on Now Playing. `.m2-content` on Now Playing is `overflow:hidden` with scrollbars hidden. |
| 6 | Topic list inside a section | `hub-section-links` restyled as cards like the overview (panel, 2 px outline, icon + label, accent for the current topic). |
| 10 | Notification lifecycle | `shared/update-notice.js`: the update row exists only for an offer, an install in progress, or an outcome. The end of an install becomes "Update installed" / "Update failed" (also after a reload, kept in `localStorage`), and can be dismissed or expires after 24 h. A withdrawn offer disappears. |
| 11 | Wizards follow the skin | Wizards no longer set their own palette: colours, font, radius and outline width come from the active skin (`polish.css`); the first-start wizard outside the shell gets the theme variables through a wrapper. |
| 12 | Music Assistant wizard keeps fields | `publicStatus()` exposes the saved, validated `serverUrl` (no credentials). The wizard pre-fills address, player and control choice, even while disconnected. The token is never sent back or shown. |
| 13 | Developer controls | Developer → Services: "Restart TuneBox service" (`systemctl restart --no-block daw-one.service`) and "Reboot TuneBox" (fixed helper `deploy/manager/reboot.sh` via `systemd-run`). Both ask first and are refused during an update; a reboot also needs idle playback and no running measurement. |
| 14 | Settings without the main header | On the wall display, Settings hides the brand and navigation; status icons stay in a compact overlay at the top right. |
| 15 | VU visualizer scale | `shared/meter-scale.js`: dBFS peak dial with marks −60…0 (labels −60/−40/−20/−10/0) and a red zone above −6 dBFS; VU dial −20…+3 with a voltage response and a red zone above 0 VU. The needle and the marks use the same mapping. |
| 17 | Progress bar | Pointer capture on the bar: tapping seeks to that spot, dragging shows a preview, and releasing sends one seek. The chosen position stays visible until playback reports it (max. 3 s). Seeking still follows source capability and the "Allow seeking" setting. |
| 18 | Save bar only when relevant | Shown only with unsaved changes, while saving, or with a result or error. "Saved" and "Changes discarded" clear after 4 s. "Restore defaults" moved to the section header. |

## Host-helper refresh

Restart controls need the new device manager (`validateRequest`, `power.mjs`, `root-adapter.mjs`, `reboot.sh`). OTA updates the application slot only, so the Pi needs `sudo bash deploy/update-appliance.sh --apply` once. Until then both buttons stay disabled, with an explanation. Everything else works through OTA alone.

## Out of scope

Items 1, 5, 7, 8, 9, 16 and 19 belong to 3.11–3.14 or to the separate cold-boot work.
