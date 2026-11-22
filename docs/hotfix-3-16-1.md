# GUI 3.16.1 · HOTFIX: scope

Release `2026.11.22-hotfix.1`, service-worker cache 68, on top of GUI 3.16.0. It combines two pieces of work on separate branches:

- **Screen rest and power widget fixes:** this branch (`claude/...`).
- **Pi 4 + Louder HAT stability tuning:** branch `hotfix/tas58xx-audio-stability`, built by another agent with the owner and merged here unchanged apart from the shared release bump.

Publishing needs the owner's separate approval (see `AGENTS.md`).

## Screen rest and power widget (owner report, 22 November 2026)

| Report | Change |
|---|---|
| Screen rest returns after about a second without a touch | **Stray touch:** screen rest ignores input for 0.9 s after it starts. A touch panel can report a stray touch or bounce right after the tap; on the old code such a touch 250 ms later woke the screen (`wall.spec.js` reproduces it). The rest screen shows `data-armed` once it accepts a wake tap.<br>• **Late report:** the starting tap no longer sends a delayed activity report.<br>• **Rejected:** a server-side guard was tried and dropped, because it also swallowed a real wake from another device. |
| The power widget sometimes shows no information | It judged freshness with the once-a-minute widget clock, so a reading newer than that clock counted as "not current". It now uses the real time and keeps the last good reading for up to a minute (`powerHoldMs`). |
| systemd "marked world-inaccessible" warnings | The player drop-in written by `player-export.py` was 0600. It is now 0644, and `update-appliance.sh` makes the existing player drop-ins readable. |

## Pi 4 + Louder HAT stability (merged branch)

| Area | Change |
|---|---|
| Squeezelite (`player-export.py`) | When the visualizer override is written: removes `-C` (close-on-idle) so the ALSA device stays open; adds `-r 44100-96000` when a LouderRaspberry/tas58xx card is present and no `-r` is set; sets `TimeoutStopSec=5`. |
| Player stop | `TimeoutStopSec=5` also via `power.conf` and a new `10-timeout.conf` drop-in. |
| Automatic DSP | Waits 2 s for the track to settle before an unforced EQ change and checks that track and source are unchanged; ramp steps 600 ms instead of 180 ms. |
| Visualizer PCM reader | Polls every 16 ms instead of 50 ms (about 60 fps). |
| Kiosk | Chromium starts with `--disable-gpu` against v3d ring-buffer hangs on the Pi 4. |
| System (`install.sh`, `update-appliance.sh`) | Wi-Fi power saving off (NetworkManager and `iw`); systemd hardware watchdog (3 min runtime, 5 min reboot); apt-daily, man-db and e2scrub timers disabled; 0644 on installed units and drop-ins. |

## Review notes

The other agent's choices were kept as made. To check on the Pi:

- **`--disable-gpu`:** Chromium then renders in software. The blurred backgrounds, the visualizer and animations cost more CPU. Watch for stutter on Now Playing and the rest views; Pi 3 low-power mode already avoids blur.
- **Close-on-idle (`-C`):** removing it keeps the device open. Squeezelite's `-C <seconds>` closes the output after that many idle seconds; it does not keep it open. The owner's own `zzz-stability.conf` drop-in (with `-C 30`) sorts after `90-tunebox-analysis.conf` and still decides the player arguments. Neither update removes it.
- **CPU:** the 16 ms PCM poll triples the reader's wake-ups. It is cheap per poll, but worth a glance in Developer → Status.

## Host-helper refresh

The stop timeout, DSP pacing, kiosk flag, Wi-Fi power saving, watchdog and timers take effect only after `sudo bash /opt/daw-one/deploy/update-appliance.sh --apply`. That script restarts the kiosk; the watchdog applies after a reboot.

Two things it does not do:
- **The new PCM reader** is compiled by `install-audio-analysis.sh`, which `update-appliance.sh` does not run.
- **The Squeezelite argument changes** (`-C` removed, `-r`) are written only when that script runs with `--enable-export` and the arguments differ. On the owner's Pi, the `zzz-stability.conf` drop-in still decides them.

The GUI fixes arrive with OTA.
