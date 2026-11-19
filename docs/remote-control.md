# Phone remote control — GUI 3.9.0 REMOTE

Local candidate `2026.11.19-remote.1`, service-worker cache 49. Base: published GUI 3.8.3 at `ffc0be8801584c83170e3f22ec0db0ca75f04caa`. Requested by the owner on 19 November 2026 ("Maak een remote control systeem … wizard, scannen qr code met telefoon, toegang tot pauzeren skippen zoeken en volume control"), built and tested locally by Claude. Not pushed or published; publication needs the owner's separate approval. See [validation](remote-validation.md).

## Owner decisions (19 November 2026)

| Question | Choice |
| --- | --- |
| How long does a paired phone keep access? | Until it is forgotten on TuneBox |
| What can search do? | Play now and add to queue (same as the wall library) |
| Pairing when a settings PIN is set? | Requires the unlocked PIN |

## What the owner sees

**On TuneBox:** Settings → Connections → **Phone remote** (Dutch: *Telefoon-afstandsbediening*). It lists paired phones (name, paired date, last used) with **Forget** per phone and **Forget all phones**. **Pair a phone…** opens a three-step wizard: *Show code → Scan with phone → Ready*. The QR code is valid for 10 minutes and for one phone; the wizard advances automatically when the phone pairs. The remote is also an optional card in the first-start wizard and the Connections setup cards; it never blocks finishing setup.

**On the phone:** scanning opens `http://<TuneBox LAN address>:3005/remote.html`. No app is needed; the page can be added to the home screen. It shows the current track and artwork, previous / play-pause / next, volume − / + with a level meter and the saved limit, mute, music search with **Play now** and **Add to queue**, and **Unpair this phone**. Language follows the TuneBox setting (English/Dutch). Every action shows a pending state; errors are shown in place and controls recover.

The phone must be on the same network as TuneBox. It does not work from outside the home network.

## How it works

- **Separate LAN listener.** The main TuneBox server stays on `127.0.0.1:3001` (kiosk only). A second HTTP listener on port `3005` (`DAW_REMOTE_PORT`, `DAW_REMOTE_HOST`, default `0.0.0.0`) starts only while a QR code is shown or at least one phone is paired. After the last phone is forgotten it closes 30 seconds later, so a revoked phone is told to scan again instead of seeing an outage.
- **QR pairing.** `POST /api/remote/pairing {action:'start'}` (wall only, control token, PIN-unlocked when a PIN exists) creates a 192-bit single-use code, valid 10 minutes; showing a new code invalidates the previous one. The code travels in the URL fragment, is removed from the phone's address bar immediately and is never shown as text on the wall.
- **Phone credential.** Pairing returns an `HttpOnly; SameSite=Strict` cookie with a random 256-bit secret. Only its SHA-256 hash is stored, in `remote.json` (mode 0600) in the TuneBox state directory, at most 8 phones. Forgetting removes the hash; the phone loses access on its next request and its live stream is closed.
- **Allowlist.** Requests through the remote listener can reach only `/api/remote/session`, `/api/remote/pair`, and — with a valid phone credential — `/api/remote/state`, `/api/remote/events`, `/api/remote/search`, `/api/remote/event`, `/api/remote/play`, `/api/remote/leave` and `/api/artwork/:id`. Settings, preferences, device commands, updates, network, rooms, security, DSP, power, debug and the full state snapshot return 403. The phone-only routes return 404 on the kiosk port. The existing host and same-origin checks still apply.
- **Reduced state.** The phone receives a separate projection: track title/artist/album/artwork, playing state, volume, mute, volume limit, player name, Bluetooth flag, language and whether search is available. No settings, network names, telemetry, tokens or build details.
- **Same playback gates as the wall.** Phone commands go through the same function as the wall's playback events: update lock, Bluetooth ownership, room-change busy guard, saved volume limit, group volume handling and Music Assistant's own ceiling. Search uses the existing library browse; *Play now* / *Add to queue* use the existing enqueue (`replace` / `add`), including its volume and group-leader checks.
- **Bounded volume.** A phone volume command can lower freely but raise at most 10 points above the current level per command, and never above the saved limit. The phone sends ±5 per tap. Mute is not offered while Bluetooth is playing; Bluetooth volume uses the active Bluetooth session.
- **Small separate page.** `remote.html` is its own Vite entry (~11 kB own code plus the shared React runtime). It does not load the wall app, the locale files or the service worker.

## Security notes and limits

- The phone page uses plain HTTP on the local network, like the existing setup hotspot. Someone who can capture traffic on the same Wi-Fi could copy a phone's cookie and get the same remote access (playback only — no settings). Forget the phone on TuneBox to revoke it. HTTPS with a self-signed certificate would show browser warnings on every phone and was not added.
- Anyone who can see the TuneBox screen while a code is shown can pair within 10 minutes. With a settings PIN, showing a code requires the PIN.
- Port 3005 must not already be in use; the wizard reports it if it is.
- Multiroom: the phone controls the player TuneBox currently controls. Group membership and room changes are not available from the phone.

## Files

`server/remote-control.js` (pairing store, address, state projection, command validation), `server/index.js` (listener, allowlist, routes), `src/RemoteSetup.jsx` (wall wizard and panel), `remote.html` + `src/remote-main.jsx` + `src/remote.css` (phone page), `shared/setup-journeys.js` (optional setup card), locales, `tests/remote-control.test.js`, `tests/offline/remote.spec.js`.
