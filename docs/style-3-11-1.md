# GUI 3.11.1 · STYLE — interface font, Settings backdrop, mute fallback

Release `2026.11.19-lively.2`, cache 55. Local candidate; it needs the owner's approval before push or publication. It started as a mute hotfix. The owner then asked for "een nog urgentere stijl update" (19 November 2026): "Settings openen gebruik dezelfde geblurrede achtergrond. Pas lettertype aan van de hele gui, vooral de settings pagina, maar check ook de wizards en full screen interactie met de gui." Asked which direction, the owner chose: "Inter lijkt me goed, maak het goed leesbaar, houd rekening met scherm en grootte van items. Gebruik ook manrope heavy en bij instellen van skin de optie van lettertype te wijzigen of deze twee preselects."

## Style
- **Interface font:** `prefs.font` = `inter` (default) | `manrope-heavy` | `skin`, chosen under Settings → Display → Appearance (Skins and Typography tabs) with sample tiles. The choice applies on `<html data-font>`, so it also reaches dialogs, the on-screen keyboard, wizards and full-screen overlays.
- **Inter:** self-hosted variable woff2 (latin + latin-ext, `@fontsource-variable/inter` 5.1.0, SIL OFL; `public/fonts/OFL-Inter.txt`, precached by the service worker). Manrope stays the fallback for characters outside those ranges (e.g. →).
- **Manrope Heavy:** the self-hosted Manrope variable font at weight 620 for text, 700 for controls and 800 for headings.
- **Skin font:** each skin keeps its own font (e.g. warm-bronze serif).
- **Measured before:** with the default skin everything was Manrope, except the on-screen keyboard (`system-ui`). All `system-ui` keyboard and phone-setup rules now use the interface font.
- **Readable sizes on the 7" 1280×800 panel:** Settings title 30 px/600, section headings 25 px/600, labels 19 px/500, body 18 px, secondary ≥ 15 px, buttons 18 px/500; wizard title 34 px, body 19 px; keyboard keys 26 px. The Settings sidebar is widened to 224 px so labels stay on one line.
- **Settings backdrop:** the same blurred artwork as Now Playing (static tint in Pi 3 mode, none when switched off). Panels are slightly translucent, and the darker overlay keeps text contrast.
- **Phone remote:** follows the interface font choice.

## Mute (original hotfix)

## Problem
The owner's player reports `['play_media','power','volume_set','set_members','enqueue','pause','gapless_playback','multi_device_dsp']`, with no `volume_mute` (read-only check on the Pi, 19 November 2026). The Mute button therefore stayed disabled. The owner confirmed: "Yeah mute doesn't work".

## Change
- `LiveMusicService.applySoftMute`: a single (non-group) player with `volume_set` but no `volume_mute` gets the capability `volume_mute_soft`.
- Mute sets the volume to 0 and remembers the previous level, in memory only. Unmute restores exactly that level, capped by the configured volume limit, and only while the volume is still 0. It never goes louder than before.
- If the volume is raised elsewhere while muted (after a 3 s grace period for late Music Assistant updates), or another player is selected, the soft mute ends. A later unmute sends nothing.
- Native `volume_mute` is still used where the player supports it. Groups keep their existing per-output logic.
- The UI enables the Mute button for `volume_mute` or `volume_mute_soft`. Phone remote mute goes through the same service path.

## Limits
- After a TuneBox service restart while soft-muted, the remembered level is gone. The player then shows volume 0 (not muted), and you raise it yourself. TuneBox never guesses a level.

## Validation (simulator/unit only)
- `integration.test.js`: soft mute → 0, unmute → previous level capped at the limit, raised elsewhere → no jump, native mute still preferred.
- `connect.spec.js`: the Mute button is enabled and sends one mute for a `volume_mute_soft` player, and stays disabled without either capability.
- On the Pi: not observed.

## Evidence
Screenshots in [images/style-3-11-1](images/style-3-11-1): Settings overview, Display and Appearance (font picker), wizard and keyboard in Inter, Now Playing in Inter and in Manrope Heavy.
