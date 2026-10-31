# GUI 2.0 interactive preview

Open `/?gui=2&product=1` for the new music-first interface, or `/?gui=2&lab=1` for the same interface inside the existing hardware workbench. The original GUI remains the default. Its header links to GUI 2.0.

For a monitor use `/?gui=2&screen=1&display=hdmi-development`; DSI uses `/?gui=2&screen=1&display=dsi-production`. Changing the installed kiosk launch URL is a separate deployment change; GUI 2.0 is not enabled on the Pi automatically.

Start with `npm ci && npm run dev`, then open port 5173. Production: `npm run build && npm start`, port 3001.

## Available now

- Discover example music, album/artist/track/playlist categories and empty radio state.
- Album details, play now, add next, add to end and paginated queue removal through the shared simulator backend.
- Locally saved example favourites; these are not MA/provider favourites.
- Search example music using the on-screen keyboard or physical keyboard.
- Persistent transport and volume controls across navigation, with request-in-progress feedback and duplicate submission protection.
- Shared theme/settings engine and six existing presets; GUI 2.0 uses a common layout with theme colours and typography.
- Now Playing, seek and mock Video Artwork End-Sync/manual correction.
- Rooms: TuneBox volume uses the real application API; Rivo grouping and volume are explicitly local visual examples only.

Live MA playback controls use the existing adapter. Browsing/recommendations and queue edits are not connected to MA; example actions are disabled in live mode. A sample album is not a full provider album. No physical audio or GPIO control has been added. Playback selection cannot clear a latched safety fault.

## SVG icons and community skins

`src/Icon.jsx` is the shared GUI 2.0 icon set. Icons are inline SVG with a transparent background, a 24 × 24 viewBox, no fill, rounded line endings and `currentColor` strokes. They stay vector at any render size. The set is authored within the project rather than depending on a remote icon font. SVGs are decorative (`aria-hidden`); the containing button owns its accessible action name.

- Use stable icon names from `Icon.jsx`; add icons on the same grid and with the same outline style.
- All GUI 2.0 icon controls use this component. Earlier GUI 1.0 symbols are retained for compatibility and are not yet migrated.
- Use `themeVariables()` and the validated tokens in `shared/themes.js`. Colours, typography and radius come from the same theme engine.
- Icon line weight uses `--icon-stroke` (default 1.6). Keep it consistent across a skin. This internal variable is not a new arbitrary CSS field in saved theme data.
- Add a built-in skin to `presets`, or create/save a custom theme in Settings. Do not change command handlers or state machines for a visual skin.
- Adding a new editable token requires schema, normalisation, resolver/CSS mapping, settings UI and tests; do not bypass validation with pasted CSS/JS.
- Preserve focus indication, readable contrast, selected/disabled states and button labels. Test large icons and reduced motion.
- Do not accept uploaded SVG markup or scripts as a theme. Skin contributions should remain reviewable source changes or validated token data.

These are contribution interfaces for a future community release. Repository visibility and the project's release licence have not been changed by this work; do not interpret private access as a blanket open-source licence.

## Verification

Run `npm test`, `npm run build` and `npm run test:ui -- --workers=1`. The browser config serialises suites because they share one simulator backend. New journey tests cover browsing, shared queue updates, keyboard search, rooms, 1280 × 400 bounds, settings and fault-inhibited output. These are Chromium simulation checks, not Pi frame-rate, Safari or live MA acceptance.

See [GUI 2.0 discovery](gui-2-discovery.md) for Spotify/Tidal/Rivo requirements and remaining integration research.

## Update the already installed Debian UTM VM

The queue changes include backend code, so copying only `dist` is insufficient for this update. In the guest repository:

```sh
cd ~/daw-one-music-interface
git pull --ff-only
sudo bash deploy/install.sh --target vm
```

Use the existing SSH tunnel and open `http://localhost:3301/?gui=2&product=1` in Mac Safari, or `http://localhost:3301/?gui=2&lab=1` for the workbench. Port 3301 assumes the tunnel in the Mac guide; use your actual forwarded port if different. The installed kiosk continues using its existing URL until explicitly changed.

## Motion and feedback

Main sections crossfade; album details enter forwards and Back reverses direction. Now Playing remembers the previous music context, including the search query and selected album. Native View Transitions enhance supporting browsers; a CSS entry animation provides the fallback. Rapid navigation interrupts prior transitions. Header and transport keep their layout; their controls do not wait for the content animation.

Transitions use an initial 180 ms budget with 120 ms press feedback. These are design choices, not measured Pi guarantees. Reduced-motion disables movement, fades and animated pending indicators while retaining text. Pending/attention colours are semantic tokens; the selected skin still owns accent, typography and base colours. Artwork changes fade separately in the persistent player.

The durable simulator entry is `/demo.html`, on both the development preview and production server. GitHub's README links to Codespaces creation; access to this private repository is still required. An anonymous public demo has not been deployed.

User interaction resets the shared display-idle timer. Real pointer presses/drags, touch swipes, keyboard input, text/range input and wheel activity report to `/api/activity`, throttled with a trailing update. Passive hover, playback clocks and automatic animations do not count. Activity wakes only the display of a ready device; it cannot exit standby, acknowledge faults, grant verification or enable an amplifier. This is application state behaviour, not certification of physical backlight or OS blanking.

## GUI 2.0 skin refinement

Use **Skin** in the header for direct switching; custom skins remain available in the same selector. Choosing a skin selects manual mode, as Settings does. Saved presets still use the shared token resolver and persist locally. Reference Dark uses graphite and restrained warm accents; Minimal uses flat mint markers and an upcoming-track panel; Bronze uses copper/serif display type; Champagne uses satin panels and output information; Cinematic uses wider artwork and midnight surfaces; Nerd adds the available shared device telemetry. Custom themes use the Reference presentation as their starting structure.

The common 24-unit transparent SVG set now also includes favourites and Video Artwork symbols. Button labels remain accessible; unknown icon names get an obvious placeholder rather than silently becoming a Play symbol. This is an internally authored set, not Apple's SF Symbols or a claim of Apple affiliation.

Meters explicitly say LEVEL SIGNAL UNAVAILABLE. Nerd's amplifier, power and temperature values are labelled simulated; hardware verification remains separate. No audio levels, sample-rate badges or actual output quality are invented. Skins contain no hardware command logic.
