# DAW ONE startup assets

Supplied by the project owner, used without visual edits:

- `startup.mp4`: H.264, 1280 × 400, 30 fps, 2.800 seconds, no audio stream, 49,817 bytes.
- `startup-still.png`: 1280 × 400 fallback/end image, 34,141 bytes.

The React startup layer is branding, not a firmware/OS boot screen. It does not enable hardware or mark services ready. It shows the still if video loading/autoplay fails; a booting device holds the still after the clip until its real application state changes. Fault/shutdown take priority. `Replay startup` in the workbench replays branding in the same product iframe without changing backend state. The still is included in the offline shell cache; video caching depends on successful prior requests and is not required for offline startup.

With reduced motion enabled, only the still is shown. Any pointer/keyboard input on a ready screen dismisses branding immediately; animation does not delay controls or hardware readiness.

`startup.webm` is a VP8 transcode of the owner-supplied MP4, retaining 1280×400, 30 fps and the same animation. It is preferred by the browser to avoid relying on H.264 availability in Linux Chromium. The MP4 is retained as an alternate source. Playback timing starts on actual video playback, with a 8-second load deadline. If media cannot play, a CSS fade/scale of the supplied PNG provides a clearly identified fallback renderer. Reduced-motion uses the static PNG. No hardware readiness or amplifier state is inferred from branding.
