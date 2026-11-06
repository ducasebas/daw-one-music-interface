# Live library and artwork — GUI 2.12

The GUI2 Discover, Library and Search views use the existing authenticated MA WebSocket backend in live music mode. Simulation keeps the existing labelled example journeys. No second MA web interface or library server runs in Chromium.

## Implemented

- Albums, artists, tracks, playlists and radio from MA's library, with a favourite-only filter for the selected type.
- Artist → albums and album/playlist → tracks. Browse position/context is retained when returning from Now Playing.
- Global search over music/radio with a 300 ms debounce, touch keyboard, cancellation/obsolete-response protection and explicit loading, empty/error/retry states.
- Explicit Play, Play next and Add to end for available album/track/playlist/radio selections. A read-only connection can browse but cannot mutate playback.
- Artwork in the library, current track and mini player. Missing/unsupported images use a neutral fallback, never a fictional album cover.

Discover currently presents real library content; it is not Spotify's personalised home/recommendation feed. Adding/removing favourites, arbitrary queue reordering/deletion and group-management controls are not added by this release. MA/provider capabilities and account access still determine available music. Podcast/audiobook results are intentionally excluded.

## Reviewed API evidence and bounds

Official frontend command evidence: [b8fdb38 API client](https://github.com/music-assistant/frontend/blob/b8fdb38beec49eab32da8e2276f1c0e436fd89b5/src/plugins/api/index.ts). Version-specific checks against MA server **2.10.9**:

- [Album controller](https://github.com/music-assistant/server/blob/2.10.9/music_assistant/controllers/music/media/albums.py): library items accept limit/offset; album tracks take item_id/provider without paging arguments.
- [Artist controller](https://github.com/music-assistant/server/blob/2.10.9/music_assistant/controllers/music/media/artists.py) and [playlist controller](https://github.com/music-assistant/server/blob/2.10.9/music_assistant/controllers/music/media/playlists.py): content lists similarly do not accept the newer frontend's pagination arguments.
- [Image proxy](https://github.com/music-assistant/server/blob/2.10.9/music_assistant/controllers/metadata/images.py): canonical `proxy_id`, `/imageproxy/<64-hex-id>?size=256&fmt=webp`.

Root lists fetch four items and display three, using the extra item as a next-page sentinel. Search requests up to 10 per media type and pages that bounded result locally. Album/artist/playlist content is capped at the first **1000 retained items**, then paged locally because these 2.10 endpoints do not page. Large playlists may take longer or time out; this is not unlimited-library pagination. The full playlist can still be sent to MA by its URI without materialising all tracks in the browser.

The backend stores at most 400 opaque media references and 40 short-lived pages. References expire after 10 minutes; pages after 20 seconds. A completed command is not retried. Selected-player availability, read-only policy, the configured volume ceiling and synced-child restrictions are checked before queue mutation. Unknown volume is rejected for these new catalogue actions until the operator confirms a known suitable player volume. Existing playing queues are changed only by explicit Play/Next/Add actions, never by opening the library or reconnecting.

## Backend API

- `GET /api/library?type=albums&offset=0` (optional q, parent opaque ID, favorite=true).
- `POST /api/library/play` with `{id, option}` where option is replace, next or add. The ID must have come from a current catalogue result; clients cannot supply an arbitrary media URI or command name.
- `GET /api/artwork/<64-hex-id>`: only the configured MA imageproxy is fetched. Credentials remain in a backend Authorization header. Redirects, SVG, arbitrary target URLs and responses over 2 MiB are rejected. Up to four image fetches are coalesced concurrently; 16 image responses are cached in memory for five minutes. Browser image URLs contain no MA token or provider path. Older metadata without proxy_id falls back safely.

These are local/trusted-device APIs under the existing loopback/private-forwarding deployment policy, not a public multi-user gateway. Artwork caching does not grant redistribution rights; images are fetched from the user's configured MA providers, not bundled in Git.

## Verify on the actual server

Update the normal release and retain the existing `/etc/daw-one.env` URL/token/player configuration. First leave MA_ALLOW_CONTROL=false and verify library/search/cover rendering. If forbidden, check the token's library-read scope. Empty library sections may need albums/playlists/stations added in MA; search can also query configured providers. Then explicitly enable control, choose the correct player with a low known volume, test Play/Next/Add and inspect the actual MA queue. Grouped child players may require selecting the leader.

Cloud validation uses API/WebSocket fixtures, not access to the owner's NUC. Real server/provider compatibility, authenticated thumbnail delivery and audible playback of newly selected media still need this owner check. No physical amplifier verification is changed.
