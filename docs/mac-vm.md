# Mac Apple Silicon: ARM64 VM rehearsal

This prepares the Pi's Linux application stack, not a Raspberry Pi board emulator. UTM virtualizes an ARM64 Debian guest using the Apple Silicon CPU. The real Pi's GPU, firmware, DSI, GPIO, HAT, power circuit and RP2040 are not present. Passing VM tests cannot certify them or predict Pi CPU/video performance.

## Create the VM on the Mac

1. Install the stable [UTM macOS app](https://docs.getutm.app/installation/macos/). Its official GitHub download is free; the App Store version is paid. This repository does not install or remotely control UTM on your Mac.
2. Download the **arm64 netinst ISO** for stable Debian 13 from [Debian installation downloads](https://www.debian.org/releases/stable/debian-installer/). Use its published checksum files. Do not use amd64 or a Raspberry Pi SD-card image: the latter expects Pi boot firmware, not the VM's UEFI machine.
3. In UTM choose **Create → Virtualize → Linux**, architecture **ARM64/aarch64**, and select that ISO. Use the standard QEMU virtualization backend with a graphical display; leave experimental graphics options off initially.
4. For a Mac with 16 GB, start with **2048 MiB RAM**, **4 virtual CPU cores**, **32 GB virtual disk**, shared networking and the default virtual display. These are proposed test settings. Equal RAM/core count does not make M5 CPU/GPU behavior equivalent to a Pi 4.
5. In the Debian installer create a user and hostname such as `daw-one-dev`. Leave root's password blank if you want Debian to give your first user sudo access. Install **SSH server** and **standard system utilities**. Deselect the Debian desktop environment: Cage will provide the minimal graphical session. Partition the new VM disk, not a physical disk shared from the Mac.
6. Finish installation, eject the ISO in UTM and reboot the guest. Log into its console. The VM's root disk is a disposable test disk; preserve anything you want before later deleting or recreating it.

UTM's [Linux creation guide](https://docs.getutm.app/guides/ubuntu/) illustrates the virtualization wizard (its OS example is Ubuntu). UI labels may vary by UTM version. A complete native macOS VM has not been created from this chat environment.

## Install Node and get the app inside Debian

Commands in this section run in the **Linux guest**, not the Mac terminal. Install a system-wide Node >=22.12 plus npm. Debian's default nodejs package may be older, so check before continuing. One option for a fresh ARM64 guest is the official Node 24 Linux ARM64 binary archive:

```sh
sudo apt update
sudo apt install -y git curl ca-certificates xz-utils
uname -m
```

Expect `aarch64`. Download Node from the [official downloads page](https://nodejs.org/en/download), selecting Node 24 LTS, Linux, ARM64 and the prebuilt `.tar.xz` binary. For a console-only guest, download on the Mac and transfer the archive and checksum file with `scp` to the guest; SSH must be enabled and its IP visible with `hostname -I`. Verify the published checksum and signed checksum instructions before extraction. Extract that verified archive into `/usr/local` with `--strip-components=1 --no-same-owner` as administrator. This is an explicit system installation; do not extract an unverified archive or a macOS/x64 build. Alternatively use a trusted signed package source that provides a supported version.

Check both your shell and sudo can find it:

```sh
node --version
npm --version
sudo /usr/bin/env node --version
```

Clone the private repository using your own authorized GitHub credentials, then explicitly install for the VM:

```sh
git clone https://github.com/ducasebas/daw-one-music-interface.git
cd daw-one-music-interface
git pull --ff-only
sudo bash deploy/install.sh --target vm
```

The normal installer still defaults to `pi4` and refuses a non-Pi. VM mode requires an ARM64 guest, actual virtual-machine detection and an active Debian/Ubuntu systemd environment; it does not falsify a Pi model or enable real hardware. If detection fails, inspect `systemd-detect-virt --vm` and `uname -m` rather than bypassing the check. The same install steps, production build, units, Cage launcher, backend and UI are used. `/opt/daw-one/deployment-target` records `vm` for diagnostics.

## Test in the UTM window

```sh
cd /opt/daw-one
npm run doctor
sudo /opt/daw-one/set-display-mode.sh hdmi-development
sudo systemctl enable --now daw-one-kiosk.service
```

The virtual monitor should show the actual product with a centered logical 1280 × 400 viewport. A smaller virtual monitor scales the HDMI preview down. For pixel-size tests use a 1920 × 1080 virtual output if offered by the virtual display; selecting an application mode does not change the guest's output resolution. The same six skins, mouse/keyboard controls and shared playback API are available. Real hardware remains simulated.

If Cage cannot create a renderer on the virtual GPU, inspect its journal first. A software-rendering trial can be set with `sudo systemctl edit daw-one-kiosk.service`:

```ini
[Service]
Environment=WLR_RENDERER=pixman
```

Then restart the kiosk. This fallback is a VM diagnostic option, not verified Pi video acceleration. DRM/seat configuration still needs guest validation. Keep SSH working to recover from an inaccessible local console.

## Test from Safari on the Mac

Find the guest's network address using `hostname -I`. In the **Mac terminal**, connect through SSH and keep the tunnel running:

```sh
ssh -N -L 3001:127.0.0.1:3001 YOUR_VM_USER@YOUR_VM_IP
```

Open these in Safari:

- `http://localhost:3001/` — full Test bench.
- `http://localhost:3001/?screen=1&display=hdmi-development` — production UI and letterbox preview.
- `http://localhost:3001/docs/` — local installation and MA guides.

These pages use the backend inside the Linux VM, not a disconnected Mac demo. If the host already uses port 3001, forward an unused host port such as `-L 3301:127.0.0.1:3001` and browse localhost:3301 instead. This does not expose the backend publicly.

## Acceptance, Music Assistant and shutdown

Check all six skins, keyboard/mouse playback, persistent settings, simulated fault acknowledgement, startup MP4 fallback and Video Artwork timing. Reboot the guest and check the services return. If desired, test with 4 GB temporarily to distinguish memory pressure from other failures; record that change rather than attributing the result to a 2 GB Pi.

For MA use the [first-run guide](pi-first-run.md): an actual MA server plus a registered player is required. The backend in the guest needs network access to that server; Safari running on the Mac does not itself supply that route. Start read-only. A successful connection is not a physical audio/HAT test.

For shutdown run `sudo systemctl poweroff` inside Debian and wait for the VM to stop. A stopped VM releases its CPU/RAM usage. The Mac SSH tunnel ends with Ctrl+C. Do not suspend a playing VM and assume its controller heartbeat or external player state has been preserved.
