# Real local PCM analysis

GUI 2.15 adds a real Squeezelite PCM reader, calibrated digital RMS/peak measurements and a 16/32-band spectrum. There is no microphone capture, browser audio playback, random animation or metadata-derived level fallback. The existing audio output, ALSA route and amplifier verification are not changed by measurement.

## Signal path and units

The optional upstream Squeezelite `-v` / `VISEXPORT` facility exports interleaved signed 16-bit samples to shared memory named `squeezelite-<player-mac>`. TuneBox reads that export, not the MA server or a remote Rivo player. The source ID is always shown as local. If the selected MA player cannot be matched to that source, the UI explicitly says the local measurement is not confirmed to belong to the selected player.

The analyser uses 4096 stereo frames: RMS and sample peaks per channel, full-scale sample counts, and independent left/right Hann-windowed FFT powers combined without phase cancellation. Thirty-two logarithmic bands cover 20 Hz–20 kHz; sixteen-band display combines adjacent powers. Bands without a resolvable FFT bin or above Nyquist are unknown/dim, not invented zero energy. A zero-valued active PCM window is real digital silence; idle/missing/stale export is unavailable and clears the readings.

The reference is **dBFS**, not calibrated VU, SPL, analogue voltage, speaker power, amplifier clipping or electrical safety. Full-scale sample flags do not certify analogue clipping. Upstream's export is a 16-bit best-effort copy; the actual playback stream can retain its original higher precision. Depending on the Squeezelite output path, gain/replay gain/volume/mute can affect the export differently. Do not assume that muted analogue output must produce zero export levels, or use this tap as post-amplifier feedback. No raw PCM is sent to browsers or recorded to disk.

## Install on the Pi

First install this TuneBox application release normally. The native reader is a one-time manual, opt-in integration. From the extracted release directory:

```sh
sudo bash deploy/install-audio-analysis.sh --player-id YOUR_EXISTING_PLAYER_MAC --enable-export
```

Replace the placeholder with the existing Music Assistant/Squeezelite player MAC, **not automatically the Pi 4's Ethernet MAC**. A migrated player can deliberately keep its original identity. The supported player unit is `tunebox-player.service`, with a direct Squeezelite MainPID and an explicit existing `-m` argument. The installer verifies that its MAC matches your selection and the installed binary supports `-v`. DSD/DoP `-D` output is rejected: this integration is for PCM output. It does not guess identities, rewrite a name/output/server or take over other Squeezelite services.

If export is not yet enabled, the installer preserves every running argv element and adds only `-v` using a dedicated systemd drop-in. The first player restart briefly interrupts playback; this is why export enablement is an explicit installation action. An already-enabled export does not require another player restart. The backend is restarted to apply its read-only shared-memory binding.

A 64-bit glibc Linux target is required. The small reader is compiled locally against the target's pthread/time ABI; GCC and libc development headers are installed if missing. No boot configuration, GPIO or I²C configuration is touched. No ALSA loopback device, audio daemon or FIFO is introduced. The `dawone` backend does not receive the audio/GPIO groups. Its existing private-device sandbox remains enabled, with a read-only bind of host `/dev/shm` at `/run/daw-one-audio-shm`.

If the binary does not support `-v`, installation stops with an explicit error before creating the integration. Install a compatible Squeezelite build with upstream `VISEXPORT` support, then retry. There is no silent substitution with a synthetic or different audio source. Do not enable DSD/DoP later while treating this export as PCM; the export ABI does not carry an audio-format flag.

## Enable and stop

Open **Settings → Audio analysis**:

1. Enable **Echte audiometing**. This global setting persists on the device and controls all browser clients.
2. Choose stereo dBFS meters or spectrum and 16/32 display bands. These visual preferences persist locally with the other UI settings.
3. In Now Playing, **Visualizer wisselen** cycles off → spectrum → meters → off. All skins use the existing shared colour/meter tokens and SVG rendering.

The reader starts only with master measurement enabled and an active visible client requesting data. The settings preview is also a visible client, even if the Now Playing visualizer preference is off. No viewers, a hidden browser or sleeping display stops the reader/FFT after a short lease (up to about 3.5 seconds); explicit master-off stops it immediately. Playback itself is independent. The helper emits at up to 20 Hz, browsers fetch latest summaries at up to 10 Hz and interpolate visually. Actual Pi CPU/memory and timing still require measurement; the response exposes FFT processing time and window duration, not an invented performance guarantee.

Master-off stops TuneBox's helper and analysis, but the upstream `-v` export remains installed to avoid restarting audio on every toggle. To remove this integration and restore the original unit:

```sh
sudo bash deploy/install-audio-analysis.sh --remove
```

If this installer added `-v`, removal restarts the player without its own drop-in. An originally enabled `-v` flag is not removed from an owner's original unit. Application OTA preserves these systemd drop-ins and the separately installed native reader; changed native/system integration requires a reviewed manual reinstall.

## Read-only interop and freshness

The layout was independently declared for interoperability against upstream [output_vis.c](https://github.com/ralph-irving/squeezelite/blob/cc7ee7c0d00bd2aa691a574a7d429d5cd13c858b/output_vis.c), [output.c](https://github.com/ralph-irving/squeezelite/blob/cc7ee7c0d00bd2aa691a574a7d429d5cd13c858b/output.c) and [output_alsa.c](https://github.com/ralph-irving/squeezelite/blob/cc7ee7c0d00bd2aa691a574a7d429d5cd13c858b/output_alsa.c). No Squeezelite implementation or binary is bundled; the dependency remains separately supplied under its own licence.

The native reader opens only the configured MAC's regular shared-memory file with no symlink following, maps it **read only**, checks the native structure size/capacity/index/rate, and double-copies the latest window while checking metadata. It never acquires or changes the producer's non-robust rwlock. This avoids a crashed/stopped analyser leaving a playback process blocked on an abandoned reader lock. Unstable snapshots are skipped. The export has no version/seqlock and lock-free snapshots remain best effort, not laboratory-grade capture or a guarantee of perfectly coherent windows under every producer race.

The source timestamp has one-second resolution; a stopped/crashed producer can take roughly 2–3 seconds to become stale. A stalled reader pipe is treated as stale after 750 ms. Missing export, incompatible ABI, stale data, busy snapshots or a reader failure clear values; there is never a fallback to invented signal. The exact installed Squeezelite build/ABI and read-only mount still need validation on the actual Pi.

## API and diagnostics

`GET /api/audio` returns capability, master state, explicit source identity/status and the latest measurement (or null). `?watch=1` renews the short capture lease only when measurement is enabled and the device display is awake. Responses are not cached.

`POST /api/audio/settings` accepts exactly `{ "enabled": true|false }` with the existing same-origin `X-TuneBox-Control` token. It can only enable/disable the preconfigured reader; no binary path, MAC, ALSA device or source URL can be supplied by the browser. Settings are kept in the service state directory. State changes enter the shared event timeline; no raw audio enters that log. Measurement never grants amplifier enable or modifies safety state.

```sh
curl -fsS http://127.0.0.1:3001/api/audio
sudo journalctl -u daw-one.service -b --no-pager -n 60
sudo systemctl status tunebox-player.service --no-pager
```

On a Mac, `npm run package:pi` runs the native fixture tests too; install Apple's Command Line Tools if `cc` is missing. Automated tests use controlled PCM fixtures and mocked browser API frames. They validate arithmetic, framing, real helper transport and shutdown behaviour; they do not claim a physical Pi/headphone/HAT measurement has already been performed.
