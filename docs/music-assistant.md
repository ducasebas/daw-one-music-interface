# Music Assistant connection and first real test

Live transport is implemented; **no connection to the owner's server or physical audio has yet been verified**. The default remains simulation. Native Node.js WebSocket JSON commands were reviewed against the official Music Assistant frontend at commit [`a54001f4913b4ccce8574311fde79fe0f8683aef`](https://github.com/music-assistant/frontend/blob/a54001f4913b4ccce8574311fde79fe0f8683aef/src/plugins/api/index.ts). Schema and player fields follow that frontend's `interfaces.ts`. This source reference is not a claim that every MA server version is supported. Record and test the actual installed server version before accepting the integration.

## Network placement

The Node backend connects to Music Assistant; Safari only connects to DAW ONE. Running DAW ONE on the Pi or NUC in the same LAN is simplest. A GitHub Codespace cannot normally reach your home `192.168.*`/`10.*` address or `.local` hostname. For a Codespaces test, first provide an authenticated private network route from that Codespace to the NUC, for example your existing VPN. The browser being on home Wi-Fi does not give the Codespace access to that LAN. No such route is configured by this repository. No public MA exposure is needed for the local Pi/NUC test.

## Configure, first in read-only mode

Use Node.js 22.9+ (or current Node 24 LTS). In the repository:

```sh
cp .env.example .env
```

Edit `.env` locally (it is ignored by Git):

```dotenv
DAW_PLAYBACK_MODE=music-assistant
MA_URL=http://YOUR_MA_HOST:8095
MA_TOKEN_FILE=/absolute/path/to/music-assistant.token
MA_PLAYER_ID=
MA_ALLOW_CONTROL=false
MA_VOLUME_LIMIT=40
```

Use the actual MA base address/port. `MA_URL` accepts http(s)/ws(s) base URLs including an existing reverse-proxy path and adds `/ws`; embedded credentials or query tokens are rejected. The backend must reach that WebSocket endpoint directly; Home Assistant Ingress session cookies are not implemented. TLS validation remains enabled.

Create/use an access token through the authentication/session controls supported by your installed MA version. Put its value in the token file with permissions restricted to the backend account, or provide a server-side environment/Codespaces secret `MA_TOKEN`. Do not enter credentials in ChatGPT, browser local storage or Git. Token files take precedence over `MA_TOKEN`. Servers allowing unauthenticated access can omit both; auth errors are surfaced as a connection failure, not bypassed.

Restart the development processes after editing `.env`:

```sh
npm ci
npm run dev
```

Open forwarded port 5173. Go to **Settings → Connection** and choose the exact available player. No player is auto-selected and no play, volume or unmute command is sent on connect/reconnect/selection. `MA_PLAYER_ID` can pin that choice across backend restarts; browser selection lasts for the running service only.

## Enable controls and test

After confirming the correct player and its current volume, set `MA_ALLOW_CONTROL=true` in `.env` and restart. `MA_VOLUME_LIMIT` defaults to 40 percent and caps DAW ONE's requested volume; it is not a hardware limiter and does not prevent other apps changing the player volume. Current server volume is displayed honestly, even above the ceiling. DAW ONE will refuse play/unmute above the ceiling until you lower the volume. Percent is the player's reported scale, never a fabricated dB/SPL reading.

- Start a known queue in MA, confirm identical title, artist, elapsed time and volume in DAW ONE.
- Try pause/resume, next/previous and seek on a seek-capable player/finite track.
- Use the reference volume control (horizontal touch drag, release to set), plus/minus or keyboard arrows. Confirm the MA interface shows the same value. Mute/unmute only enables if the player advertises support.
- Change volume and tracks from MA; confirm push updates arrive in DAW ONE.
- Restart/temporarily disconnect MA. DAW ONE must show unavailable and stop progress; reconnect must refresh state without replaying commands or restoring a stale volume.
- Test a radio/live source with unknown duration: no fictional duration or seek capability is shown.
- Confirm `/api/health` and backend journal show the intended mode; never include secrets in collected logs.

## Behaviour and limitations

Commands: `auth`, `players/all`, `players/get`, `player_queues/all`, `player_queues/items`, and `players/cmd/{play,pause,next,previous,seek,volume_set,volume_mute}`. Queue pages load at most 25 upcoming items. Events trigger coalesced state refreshes. Browser updates use `/api/events` SSE with snapshot polling as fallback. Reconnect backs off from 1 to 30 seconds; commands are never replayed after a lost connection. Streaming services, queue creation/browsing, image proxying and content search are not implemented here. Cover artwork remains a conceptual graphic; Video Artwork remains a timing demo, not a real YouTube integration.

Live music mode blocks simulator scenarios and direct simulated case controls, so demo actions cannot masquerade as real playback. Physical Pi/RP2040/amplifier control remains absent; this software does not electrically protect the selected external player's amplifier. Do not equate the simulated hardware inhibit indication with actual remote-player muting.

Tests exercise an injected WebSocket protocol fixture and browser fixtures, not a live MA installation. Real server-version compatibility, network latency, audio buffering and audio output remain acceptance tasks.

## Pi service configuration

The systemd unit optionally reads `/etc/daw-one.env`. Set the same variables there and use a token file readable by the `dawone` service account outside its protected home. Restart `daw-one.service` after edits. Do not put the token into the repository or a unit committed to Git. The HTTP health probe accepts both simulation and music-assistant modes; a healthy HTTP response does not prove MA connectivity or sound output.
