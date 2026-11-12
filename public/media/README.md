# TuneBox startup assets

The project owner's four-second Canva animation is the source. The high-resolution master remains at `design/brand/tunebox-cold-start-master.mp4` (3642 × 2276); these are display exports with the same composition and no audio.

| File | Encoding | Display size | Timing | Bytes | Purpose |
| --- | --- | --- | --- | --- | --- |
| `startup.webp` | Animated WebP, quality 88 | 1280 × 800 | 24 fps source, 95 stored frames, 3999 ms, one play | 438998 | Default animation |
| `startup.mp4` | H.264 Main | 1280 × 800 | 30 fps, 4 s | 150399 | First video reserve |
| `startup.webm` | VP8 | 1280 × 800 | 30 fps, 4 s | 292484 | Second video reserve |
| `startup-still.png` | PNG | 1280 × 800 | Static | 160738 | Still/end frame |

The WebP export merges identical frames. Its one-millisecond duration difference is encoding rounding. Reproduce it with FFmpeg:

```sh
ffmpeg -i design/brand/tunebox-cold-start-master.mp4 \
  -vf scale=1280:800:flags=lanczos,fps=24 \
  -c:v libwebp_anim -lossless 0 -quality 88 -compression_level 6 \
  -loop 1 -an public/media/startup.webp
```

WebP avoids the browser video-player/codec path for this short branding sequence. It is not inherently smaller or cheaper to decode than video: here MP4 is the smallest file. Auto mode retains a static image on Pi 3 and when reduced motion is requested. Explicit Animation overrides that policy; Still and Off remain available.

Loading the WebP has an eight-second deadline. A failure tries MP4, then WebM, then the identified PNG/CSS fallback. A ready screen can dismiss branding immediately; a device still booting holds the end image. Fault and shutdown have priority. Branding neither enables audio nor proves hardware readiness.

A unique image URL restarts each replay. The production service worker stores one canonical offline WebP copy and the still; it bypasses video and Range requests. It must never insert an HTTP 206 partial response into CacheStorage or replace a valid response when caching fails. Production browser tests cover these paths with the real worker active.

See [startup reliability and Pi checks](../../docs/startup-reliability.md).
