# GUI 3.11.0 · LIVELY — scope

Release `2026.11.19-lively.1`, cache 54. Builds on the local 3.10.1 HOTFIX (scrub via the Music Assistant queue). Source: [roadmap](roadmap.md) §3.11 and the owner's request (19 November 2026) to also bring the style to the phone remote: "Denk aan meer stijl overwegingen als je hier toch al backends voor bouwt. Misschien bij de remote app voor gsm". Local candidate; it needs the owner's approval before push or publication.

| # | Item | Implementation |
|---|---|---|
| 5 | Dynamic Now Playing background | `NowPlayingBackdrop` (`src/NowPlayingExtras.jsx`). Blurred, enlarged, darkened artwork. The blur runs on a quarter-size layer that is scaled up, and only opacity animates. A new cover fades in (900 ms) after it has loaded, so the old one stays visible meanwhile. Only same-origin `/api/artwork/<64 hex>` images are used. Pi 3 / low-power: a static skin-colour tint with no artwork layer, blur or fade. Reduced motion: no fade. It can be switched off with Settings → Display → "Album art background". |
| 1 | Widgets on Now Playing | `shared/now-playing.js` (pure, tested) and `NowPlayingWidgets`. Up to 4 tiles chosen in Settings → Display from: Clock, Up next, Source & quality, Rooms, Temperature, Wi-Fi, Power, Party. Default: Clock, Up next, Source & quality. Tiles with a destination are buttons (Up next → Queue, Rooms → Rooms, Power → Sensors, Party → Connections). Unknown values say "Not available" with a reason. **Power** shows the PD contract only from a fresh HUSB238 readback, and consumption only when the INA228 reading is confirmed and consistent (`power.watts` is `null` otherwise). Nothing is inferred. |
| — | Phone remote style | `remoteView` adds `style` (skin colours, font and radius only), `playback.next` (title/artist) and `playback.quality`. No telemetry, settings or time zone. The phone applies the skin as CSS variables and shows the blurred artwork backdrop, a quality label, read-only progress and an "Up next" card. Play/skip buttons stay round. |

Preferences: `prefs.backdrop` (`art`/`off`, default `art`) and `prefs.widgets` (validated, unique, max 4).

Not in scope: party wizard and QR widget content (3.12 PARTY), offline local control (3.13), DSP overhaul (3.14).
