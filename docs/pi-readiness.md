# Raspberry Pi readiness review — 1 November 2026

**Pi 3 B+ update:** use the explicit [experimental Pi 3 guide](pi3-experimental.md). It preserves the Pi 4 default and requires a prebuilt bundle. Hardware performance is still unverified. The readiness review below describes the preceding audit.

## Current hardware correction

The owner reports a **Raspberry Pi 3 Model B+**, not the previously assumed Pi 4 / 2 GB. The manufacturer's [Pi 3 B+ specification](https://www.raspberrypi.com/products/raspberry-pi-3-model-b-plus/) confirms a 1.4 GHz 64-bit Cortex-A53 CPU and **1 GB RAM**. No physical board was connected to this development environment.

At the time of this audit, the installer accepted only Pi 4 or an explicitly detected ARM64 VM. It deliberately rejects Pi 3 B+, even with a 64-bit OS. Do not bypass this by pretending it is a Pi 4 or using the VM flag on real hardware. The later opt-in implementation is documented in the guide above.

## Is there an image?

No TuneBox `.img`/`.img.xz`, image-builder configuration or GitHub Release asset is supplied. The repository contains an application installer for an existing 64-bit Raspberry Pi OS Lite installation. There is therefore no TuneBox disk image whose total size, free space, boot behaviour or package inventory has been verified.

The measured local production `dist` is approximately **776 KiB**; the development `node_modules` directory is approximately **69 MiB**. These are development-workspace measurements, not Pi runtime RAM, production dependency size or total OS-image size. Chromium, graphics dependencies and the OS dominate beyond the frontend assets.

## What is already suitably small?

- Raspberry Pi OS Lite baseline; installer does not add a complete desktop environment.
- Cage/Wayland with one Chromium kiosk, standard sandbox, unprivileged service account.
- Static Vite production output; no Vite/Playwright/development server in the installed runtime.
- `/opt/daw-one` installs npm dependencies with `--omit=dev`.
- Music Assistant is a separate NUC service, not bundled into this Pi installation.
- Bounded 500-event in-memory history and coalesced pending SSE snapshots.
- Backend runs under systemd with a 256 MiB memory ceiling. This is a configured limit, not a measured requirement or a limit for Chromium.
- No real GPIO/UART/I²C driver or amplifier enable is present.

## Gaps found

1. **Pi 3 B+ is unsupported by the installation target policy.** Its 1 GB RAM and older GPU require a dedicated trial; smooth rendering/video and compositor access cannot be inferred from Mac/VM tests.
2. Kiosk launch URL still selected GUI 1.0; the reviewed patch changes it to `gui=2` while retaining the selected HDMI/DSI mode.
3. Pi CPU/RAM/temperature, startup time, audio underruns and swap activity have not been measured.
4. Browser/compositor memory is not bounded or certified; PAM may place processes in a user-session cgroup, so service MemoryCurrent alone can under-report actual Chromium use.
5. Journal/profile/cache growth has no product-specific retention budget. Measure first; do not delete system logs or browser settings blindly.
6. Installer builds on the target, leaving the source checkout, build dependencies and npm cache outside the minimal `/opt` runtime. It is not a stripped appliance image or atomic update mechanism.
7. Health checks report failure and systemd restarts crashed processes; HTTP health does not detect every hung renderer and does not certify sound/pixels/electrical safety.
8. App display sleep/brightness and shutdown remain simulated; physical backlight, Linux shutdown integration and amplifier sequencing are not delivered.
9. Real HAT/Squeezelite, RP2040, power delivery, DSI and touch remain hardware verification tasks. No arbitrary overlays, timings or pin assignments are introduced.

## Appropriate next step for the available Pi 3

Prepare a separately labelled **experimental Pi 3 profile**, preserving the Pi 4 default and hardware safety gate. Before enabling it:

- Confirm the actual board, 64-bit OS, storage and power supply.
- Use Lite, one production kiosk tab and an ordinary HDMI monitor first.
- Keep Music Assistant on the NUC; do not add its server to the Pi 3.
- Build the static frontend off-device where practical; install only target-compatible production backend dependencies on the Pi.
- Initially use static cover artwork, reduced motion and low/no glow. Do not promise video/60 fps before testing.
- Verify Cage/DRM access and Chromium sandbox under the real OS.
- Measure cold boot, idle, navigation, artwork playback and a sustained run; record RAM, swap, CPU, thermals and errors.
- Make the install target opt-in only after the packaging/session setup is verified. Do not remove the current model check as a shortcut.

If this does not meet the interaction/resource budget, move to Pi 4 or a suitable Compute Module; no buying decision is justified solely by the cloud measurements.

## Read-only collection on a running Pi

`bash deploy/pi-audit.sh` prints model/architecture, OS, Node/npm, RAM/storage, firmware temperature/throttling when available, systemd counters and service-user process RSS. It installs nothing, restarts nothing and changes no boot/hardware configuration. Some storage/journal information may need permissions. Raw process RSS includes shared pages and must not be summed as unique RAM. Share the output for review; no token, SSID or environment dump is requested.

Real hardware phase 5 remains incomplete. There is no certified Pi 3 image or verified Pi 3 deployment yet.
