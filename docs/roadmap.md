# Roadmap after GUI 3.9.2 (owner feedback, 19 November 2026)

## Queued separately: native higher sample rates

The current interface update does not change the DAC/I²S driver, Squeezelite arguments or Music Assistant output format. The TAS5825M accepts up to 32-bit/192 kHz input, but the pinned manufacturer driver (`ac10e740533bd1330aa210ddd227d51bbcb6607d`, `tas58xx.c` DAI definition) advertises only 48 kHz and S32_LE. Squeezelite itself supports higher rates. First read the installed driver's actual ALSA capabilities and current `hw_params`; then review driver clocks and the DSP processing flow before a separate driver candidate. Prefer native source rates; forcing every source to 192 kHz does not add detail. Keep the owner's player drop-in and channel gains untouched. Physical playback, stability and DSP acceptance remain required.

Primary references: [TI TAS5825M datasheet](https://www.ti.com/lit/ds/symlink/tas5825m.pdf), [pinned driver](https://github.com/sonocotta/tas5805m-driver-for-raspbian/blob/ac10e740533bd1330aa210ddd227d51bbcb6607d/tas58xx.c#L1557-L1566), [Squeezelite manual](https://ralph-irving.github.io/squeezelite.html).

Owner feedback after installing 3.9.1/3.9.2, split into separately testable and publishable updates. Each update still needs the owner's explicit publication approval (see `AGENTS.md`). Build one update per session: "Build 3.10 POLISH per docs/roadmap.md".

## Owner decisions (19 November 2026)

- Now Playing background: **blurred, enlarged album art**, darkened for legibility, cross-fading per track.
- Guest/party remote: pairing requires **the same PIN as the settings PIN** when one is set; without a PIN, pairing stays as in 3.9.0 (QR on screen).
- "Keep the music playing" (Music Assistant radio/"don't stop the music" when the queue ends): **on by default**, switch in Settings → Playback.
- Widgets: **on Now Playing**, user-selectable (Settings → Display). Proposed set: Power (PD contract + measured consumption once VBUS is verified), Temperature, Wi-Fi, Source & quality, Up next, Rooms, Party (QR + paired phones), Clock.

## 3.10 · POLISH (quick UI fixes)

2. Startup animation shows the update name and version (e.g. "Security · GUI 3.10.0").
3. Search suggestions: start at 3 characters, debounce (~250 ms), cancel stale requests, cache per prefix, show results above the on-screen keyboard (never hidden behind it).
4. Now Playing: remove the scrollbar; revert the 3.9.0 volume rail to the previous footer volume, but larger and more prominent; thicker button outlines (≥ 3 px on the DSI panel to avoid grainy edges).
6. Settings: restyle the topic list inside a section to match the attractive settings overview.
10. Notification centre lifecycle: a notification is removed when its condition is resolved, or replaced by an outcome notice ("Update installed" / "Update failed") — starting with update notifications.
11. Wizards follow the active skin (colours, fonts, radii).
12. Music Assistant wizard keeps previously saved URL/player fields when the connection drops (token stays server-side; never re-display it).
13. Developer: useful controls such as Reboot (with confirmation, idle gate) and Restart TuneBox service.
14. Settings: hide the main header to gain space; keep the top-right status icons visible in a compact overlay.
15. VU visualizer: proper scale ticks/labels (dB marks) like an analogue VU meter; verify with screenshots.
17. Track progress bar: positioning and scrubbing work (drag preview, single seek on release), where the source supports seek.
18. "Settings are up to date" bar only when relevant (unsaved changes, saving, error).

## 3.11 · LIVELY

5. Dynamic Now Playing background (decision above). Respect low-power/Pi 3 mode (static fallback).
1. Widgets on Now Playing (decision above), compact tiles, keyboard/touch friendly, live values, "not available" states honest (no invented readings).

## 3.12 · PARTY

16. Party mode: remote QR directly visible in a party wizard/widget; "keep the music playing" (decision above), automatically when a search starts playback with an empty queue; pairing PIN = settings PIN (decision above); multiroom awareness.

## 3.13 · OFFLINE

9. When Wi-Fi/internet or Music Assistant is unavailable, pause and volume must still work locally (e.g. local output mute/pause and ALSA hardware volume within the saved limit), with clear state on screen.
7. Music Assistant server on the TuneBox itself when hardware capacity allows (an initial local-MA installer exists under Developer → Services; finish, guide and test it). Combined with 9 this removes the dependency on another server.

## 3.14 · SOUND

19. DSP overhaul: a simple layer (preset, bass, treble, loudness, room correction on/off) with an Advanced section for the full Louder controls; every control explains what it does in one line; keep safety (headroom, reversible changes).

## Separate, careful

8. Cold boot still shows brief Linux text on the DSI panel: adjust kernel/console/boot settings (quiet, console blanking, framebuffer/splash order) with a tested recovery path; never risk an unbootable device.

## Not yet specified

20. (empty in the owner's list)
