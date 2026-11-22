# GUI 3.16.0 · REST: scope

Release `2026.11.22-rest.1`, service-worker cache 67. This is a local candidate built from owner feedback on 21 November 2026. Publishing it needs the owner's separate approval (see `AGENTS.md`).

| Owner request | Implementation |
|---|---|
| Widgets look poor, sometimes slide under the footer when the visualizer is on, and can't be repositioned | **Fit:** Now Playing on the wall is a fixed-height grid. With the visualizer on, the track info sits on top and the visualizer takes the height that is left, so the widgets never go under the footer (checked for spectrum, meters and off).<br>• **Look:** widgets are lighter chips with no heavy border.<br>• **Position:** Settings → Display → Now Playing gets an order row (move left/right) and "Widget position: below / above the song". |
| A header that slides up by itself, with a small arrow to pull it back down | On the wall's Now Playing page the menu bar slides up after 6 s; the content moves up with it. A tab at the top centre brings the bar back for another 6 s. Other pages keep the bar. Switch: "Hide the menu bar when idle" (default on). |
| Screen off after inactivity, adjustable, clearly about protecting the screen | Display settings: "Turn the screen off" (15 min to 4 h after screen rest, or Never; default 1 hour), plus "Also while music plays" (default off). The explanation says it is screen preservation, that music keeps playing and that a touch wakes the screen.<br>• The server decides (`shared/screen-off.js`) and publishes `screenOff` in `/run/daw-one-display/activity.json`. `deploy/display/control.py` then turns the backlight fully off. The rest view also turns black and audio analysis sleeps. |
| Screen-rest options need small previews | The rest view is now chosen from tiles, each with a miniature of the view and one line of explanation. |
| Backgrounds for the dark rest views: blurred album art, gradient, the owner's photos, own photo via the QR remote | Clock, widgets, sunset and now playing can use: black, the blurred cover (gradient while nothing plays), a colour gradient in the theme colour, the three bundled photos (Fjord, Lake, Pines; the owner's own, EXIF and GPS removed, at most 1280 × 800) or your own photo.<br>• **Own photo:** the paired phone remote gets "Screen rest photo". The phone shrinks and re-encodes the picture (the canvas drops EXIF and location data) and sends it. The server strips EXIF/XMP once more and keeps it as *pending*. It appears only after **Use this photo** is tapped on TuneBox itself, so a party guest cannot put a picture on the wall. |
| Skipping: keep the old cover with a clear loading animation | `shared/skip-hold.js`: after next/previous the old cover, title and artist stay with a loading ring until a different track arrives (at most 8 s). A brief return to the old track while Music Assistant settles is ignored. New covers fade in once loaded. |
| First-start wizard: a city / time zone instead of coordinates | New "Location" step: search a city (106 built-in places, offline). Its IANA time zone handles daylight saving and local time, and its coordinates give sunrise and sunset. Date & time uses the same picker; manual zones and coordinates moved under "Advanced". |

Not included: the reference sync timing as the zero line for new TuneBoxes. The owner postponed it until a good timing measurement exists ("uitstellen tot we een goede timing hebben").

## Host-helper refresh

The GUI part reaches the Pi through OTA. The full backlight-off for screen preservation needs the updated display controller, so it needs `sudo bash /opt/daw-one/deploy/update-appliance.sh --apply` once. Without it, screen-off shows a black rest view while the backlight stays at its rest level.
