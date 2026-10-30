# GUI 2.0 — music-first discovery and browser review

Research date: **30 October 2026**. Status: **proposal for discussion, not an approved feature scope or visual design**.

The owner wants an iPod-like focus on finding and playing music, with clear navigation and responsive feedback. The next step is to agree on functions together, then define navigation, then design. No GUI layout, skin or runtime behaviour is changed by this document.

## Evidence and boundaries

- Reviewed the official [Music Assistant API guide](https://www.music-assistant.io/api/), [client](https://github.com/music-assistant/client), [player support](https://www.music-assistant.io/player-support/), [Squeezelite](https://www.music-assistant.io/player-support/squeezelite/) and [Sendspin](https://www.music-assistant.io/player-support/sendspin/).
- Command names below were checked in the official frontend at [b8fdb38](https://github.com/music-assistant/frontend/blob/b8fdb38beec49eab32da8e2276f1c0e436fd89b5/src/plugins/api/index.ts). This pins research evidence, not compatibility with an installed server.
- The operator's server is not connected. Its version, schema, permissions, providers, player features and generated `/api-docs` must be checked before implementation acceptance.
- Current TuneBox transport uses WebSocket commands/events. The official API also documents authenticated HTTP commands via `POST /api`; there is no need to replace the event transport simply to add browsing.
- Current authentication documentation requires a token. Keep it backend-side; record compatibility with the actual server instead of relying on older unauthenticated setups.
- Availability in MA is not availability in TuneBox. Player and provider capabilities must determine which actions the interface offers.

## Function inventory

“Existing” means implemented with mock/fixture coverage, not verified against a real server.

| User goal | MA integration evidence | TuneBox today | Proposed scope |
| --- | --- | --- | --- |
| See and control playback | `players/all`, `players/get`, `players/cmd/*`, player/queue events | Existing metadata, play/pause, next/previous, seek, volume/mute | Essential; capability-aware |
| Browse artists, albums, tracks, playlists and radio | `music/{artists,albums,tracks,playlists,radios}/library_items` and detail commands | Missing | Essential |
| Search music | `music/search`, optional media/provider filters | Missing | Essential |
| Start an album, playlist or selected track | `player_queues/play_media` with media, queue and option | Missing; playback currently controls an existing queue | Essential; distinguish replacing queue from adding |
| Use favourites | `music/favorites/add_item`, `remove_item`; newer frontend also uses `set_item` | Missing | Essential; verify installed schema |
| See recently played | `music/recently_played_items` | Missing | Candidate shortcut |
| Manage the queue | `player_queues/items`, `play_index`, `move_item`, `delete_item`, `clear` | Read-only upcoming list, capped at 25 | Play selected item, play next, add to end, remove; reorder to discuss |
| Shuffle and repeat | Queue shuffle/repeat; current frontend also supports source-aware player commands | Missing | Candidate core controls; respect source ownership |
| Choose the output | Players, capabilities and active-source state | Existing explicit player selection | Default to this TuneBox; remote outputs secondary |
| Multiroom and transfer | Group/member and queue-transfer commands | Missing | Owner requires Rivo multiroom; prove common protocol before designing group controls |
| Show actual album art | MA artwork metadata; retrieval/auth path needs separate verification | Conceptual cover | Essential; thumbnail delivery/cache investigation required |
| Lyrics/recommendations | Lyrics and recommendation commands in frontend | Missing | Later, optional and provider-dependent |
| Video Artwork | No reviewed source establishes our matching/End-Sync feature as a native MA API | Mock timing library only | Optional later; music must work without it |
| Podcasts/audiobooks | MA has media-specific library/detail methods | Missing | Owner decision |
| Power, LED ring, presence and electrical safety | TuneBox controller domain, not MA player API | Simulation only | Preserve shared model; no physical enable |

A supported provider is not a promise of account access, every catalogue item, all formats or every operation. Accounts/subscriptions and the player's actual capabilities still matter. Squeezelite and Sendspin are candidate player paths for evaluation; no player migration is selected here.

## Owner requirements recorded during discovery

- Spotify for discovery/algorithm-driven listening; Tidal for high-quality playback.
- Music and radio first. Podcasts and audiobooks are out of the initial scope.
- Multiroom with the owner's Volumio Rivo is a requirement to investigate, not a later optional extra. Confirm its installed Volumio version and enabled player plugins.

### Spotify discovery is a constraint

The current [MA Spotify guide](https://www.music-assistant.io/music-providers/spotify/) states that Spotify recommendations do not populate its Discover view. Do not promise Spotify's personalised home feed inside TuneBox. Saved playlists, search, app-driven Spotify Connect and any accessible personalised playlists are separate workflows requiring account tests. Ask whether discovery in the Spotify app followed by playback on TuneBox meets the goal.

### Tidal quality must be observed

The [MA Tidal guide](https://www.music-assistant.io/music-providers/tidal/) documents lossless/high-resolution support. Actual source, stream, resampling and output capabilities determine the resulting path. Only show quality badges backed by telemetry; no automatic Spotify-to-Tidal identical-master substitution is promised.

### Rivo multiroom requires a common playback path

[Volumio documents its own multiroom](https://help.volumio.com/en/articles/121-how-does-the-multiroom-work), while the [Rivo product page](https://shop.volumio.com/product/rivo?setCurrencyId=1) lists Squeezelite among available plugins. This suggests evaluating Squeezelite on Rivo and TuneBox under MA, but does not prove that the plugin works on the owner's current firmware or that grouping is synchronised. Do not assume native Volumio groups are MA groups or that DLNA discovery proves sync.

Before choosing: identify firmware/plugin availability, discover both endpoints, verify group capability, play together, measure relative delay/drift, change per-room volume and test rejoin after disconnect. Avoid competing audio engines. No software is installed or replaced on the Rivo by this research.

## Proposed first-release functions

1. **Now Playing**: title, artist, album, actual artwork, selected output, play/pause, next/previous, capability-aware seek, volume and mute.
2. **Library**: artists → albums → tracks, plus playlists and radio. Remember the list position when returning.
3. **Search**: query, useful result groups and explicit empty/loading/error states. Ignore late responses to an older query.
4. **Favourites**: quick access to saved music and stations.
5. **Queue**: current/next items and clearly named actions: Play now, Play next, Add to end, Remove.
6. **Secondary controls**: output selection, connection/setup, appearance and device settings.

These are functional categories, not a commitment to six tabs or a particular screen composition. Long music lists need deliberate list navigation; the owner's preference for paged settings does not automatically imply paging every music list.

Provider account setup, advanced DSP, multiroom management, diagnostics and theme editing should not dominate daily listening. Advanced configuration can remain in MA or a secondary setup path.

## Interaction and feedback requirements to agree

- Playback remains accessible while browsing, without automatically abandoning the current list.
- Back returns to the previous context and selection; returning to Now Playing is predictable.
- Every command has a distinct requested, pending, confirmed or failed outcome. Acknowledged transport is not proof of audible playback.
- A volume thumb may follow the hand immediately, while the last confirmed player value remains authoritative. Coalesce updates; do not send one request per animation frame.
- Do not replay old playback, queue or volume commands after reconnecting.
- Show unsupported controls with a clear explanation or omit them consistently.
- Distinguish “Connecting to server”, “Player unavailable”, “Loading music” and “No results”.
- For internet radio, show live state without invented duration, seek position or buffering success.
- Keep global navigation and text positions stable while data and artwork load.
- Failed artwork must not block music or menu use.
- Keep device sleep, player playback, connectivity and physical amplifier verification as separate state domains.
- Physical button single/double/long-press semantics still need owner agreement. Do not repurpose a safety/shutdown gesture silently.

## Smoothness principles and measurement plan

Apple's [motion guidance](https://developer.apple.com/design/human-interface-guidelines/motion) favours purposeful, brief feedback, optional motion and interruptible transitions. For TuneBox this suggests preserving context, avoiding animation on every repeated action and respecting reduced motion. This is inspiration, not a claim of native Apple behaviour.

Proposed engineering targets, **not measurements or Apple specifications**:

| Signal | Initial target | How to inspect |
| --- | --- | --- |
| Local input feedback | Within 100 ms at p95 | Input mark to visible feedback; browser trace |
| Simple local transition | Roughly 150–220 ms, interruptible | Trace/screenshots; reduced-motion variant |
| Command status | Pending promptly; confirmed only from appropriate response/state | Inject 0/250/1000 ms latency, rejection and dropped connection |
| Animation stability | Aim for 60 fps where target hardware permits | Frame/long-task traces; 16.7 ms frame budget is an aspiration on Pi |
| Large lists | Bounded rendering and paged fetching | 1,000/10,000-item fixtures and Pi CPU/RAM profiling |
| Search | Debounced, cancel/ignore obsolete results | Rapid queries plus out-of-order responses |

Profile production builds. Mac/cloud timing cannot certify Pi timing; use the same scenarios on Pi before setting a release performance budget. Do not animate layout-heavy properties or run unnecessary whole-page playback-clock updates without profiling.

## Current baseline review — actually executed

On 30 October 2026, Playwright drove system Chromium against the current development app at 1280 × 400. **Four selected existing browser tests passed in 12.6 seconds overall**:

- Playback, next track, mock Video Artwork and persisted settings.
- Shared testbench/product state through the same runtime.
- All eleven settings pages, swipe and keyboard navigation without tested page-body overflow.
- Keyboard volume, mute and connection settings.

These are functional checks, not a GUI 2.0 prototype, a real MA integration run or a frame-rate benchmark. Test durations include automation overhead.

Code review findings to investigate in GUI 2.0:

- `src/main.jsx` updates the product clock every 250 ms. Profile and isolate progress rendering before claiming it causes jank.
- It polls state every 1.5 seconds even with SSE active; assess fallback-only polling and races before changing it.
- `send()` has errors but no per-command pending model. Delayed commands can look unresponsive and repeated taps can issue competing requests.
- The queue normalisation keeps only simplified track fields; media URI/provider IDs, stable queue-item IDs, actual artwork and source capabilities need explicit shared contracts for browsing and queue editing.
- Settings occupy eleven pages. Agree on daily listening versus setup functions before reducing or reorganising them.

No performance regression is proven by these code observations alone.

## Repeatable browser workflow for GUI 2.0

1. Start the existing app and inspect it in Chromium with Playwright; keep the real product and separate testbench on the same backend.
2. Create journey checks from the agreed scope: find an album → play → add next → browse elsewhere → return to the same position → adjust volume.
3. Exercise empty library, failed artwork, long titles, large library, read-only access, unsupported seek, slow commands, provider failure and reconnect.
4. Save screenshots and traces for failed steps; collect navigation counts, command outcomes, console/network errors and latency separately.
5. Compare the same journeys before/after each change, in production as well as development.
6. Repeat the final journeys in WebKit, the owner's Safari and on the physical Pi.

Normal repository commands are `npm run test:ui` and `npm run test:offline` after installing Playwright Chromium. A review capture can use:

```sh
npm run test:ui -- --workers=1 --trace=on
```

This runs in an available test browser in the development environment. It does not remotely control the owner's Mac Chrome/UTM, and no owner-network connection is currently established.

## Discussion before navigation and design

Pending owner answers:

- Spotify and Tidal selected; first available test account/library still needed.
- Music/radio only confirmed; no podcasts/audiobooks initially.
- Does Spotify-app discovery followed by playback meet the algorithm requirement?
- Exact Rivo firmware and existing Squeezelite/plugin configuration.
- Is this always the local amplifier, or should switching rooms be a daily action?
- Essential queue actions and shuffle/repeat behaviour.
- Preferred library entry point: artists, albums, favourites or playlists.
- Search input on a 1280 × 400 touchscreen versus optional phone entry.
- Physical top-button behaviour and whether any additional rotary control is actually planned.

Next deliverable after discussion: agreed functions and example user journeys, then a navigation map. Visual design follows that agreement.
