#!/bin/bash
set -euo pipefail
# Same simulated runtime on a Pi 4 or an explicitly selected ARM64 VM.
target=pi4
prebuilt=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --target) [[ $# -ge 2 ]] || { echo 'Missing --target value' >&2; exit 2; }; target=$2; shift 2 ;;
    --prebuilt) prebuilt=true; shift ;;
    *) echo 'Usage: install.sh [--target pi4|pi3-experimental|vm] [--prebuilt]' >&2; exit 2 ;;
  esac
done
case "$target" in pi4|pi3-experimental|vm) ;; *) echo 'Unknown installation target.' >&2; exit 2 ;; esac
if [[ $target == pi3-experimental && $prebuilt != true ]]; then
  echo 'Pi 3 experimental requires --prebuilt: build/package on the Mac first. See docs/pi3-experimental.md.' >&2; exit 2
fi
if [[ $(id -u) -ne 0 ]]; then echo 'Run with sudo inside the Linux target.' >&2; exit 1; fi
repo=$(cd "$(dirname "$0")/.." && pwd)
source "$repo/deploy/install-target.sh"
model=''
if [[ -r /proc/device-tree/model ]]; then model=$(tr -d '\0' </proc/device-tree/model); fi
virtualization=none
if [[ $target == vm ]]; then virtualization=$(systemd-detect-virt --vm 2>/dev/null || true); fi
daw_validate_install_target "$target" "$(uname -m)" "$model" "$virtualization"
if [[ ! -d /run/systemd/system ]] || ! command -v apt-get >/dev/null; then
  echo 'This installer needs a Debian/Ubuntu ARM64 system running systemd, not macOS or a container.' >&2; exit 1
fi
command -v node >/dev/null || { echo 'Install a supported Node.js 22.12+ runtime first; see docs/raspberry-pi.md'; exit 1; }
node -e 'const [a,b]=process.versions.node.split(".").map(Number);if(a<22||(a===22&&b<12)||typeof WebSocket!=="function"){console.error("Install Node.js 22.12+ with native WebSocket support");process.exit(1)}'
if [[ $prebuilt == true ]]; then
  node "$repo/deploy/release-bundle.js" verify "$repo"
fi
if [[ $target == pi3-experimental ]]; then
  echo 'EXPERIMENTAL Pi 3 B+: performance, kiosk seat and hardware are NOT certified. Static artwork profile; no real hardware enable.'
fi
apt-get update
apt-get install -y --no-install-recommends cage chromium curl alsa-utils libinput-tools wlr-randr seatd dbus-user-session libpam-systemd
getent group dawone >/dev/null || groupadd --system dawone
id dawone >/dev/null 2>&1 || useradd --system --gid dawone --create-home --home-dir /var/lib/dawone --shell /usr/sbin/nologin dawone
usermod -aG video,render,input dawone
install -d -m 700 -o dawone -g dawone /var/lib/dawone/chromium
# Deliberately no gpio, dialout, i2c or audio groups for the simulation service.
cd "$repo"
if [[ $prebuilt != true ]]; then
  npm ci
  npm run check
fi
mkdir -p /opt/daw-one
cp -r dist server shared docs package.json package-lock.json /opt/daw-one/
if [[ $prebuilt == true ]]; then install -m 644 "$repo/release-manifest.json" /opt/daw-one/release-manifest.json; fi
cd /opt/daw-one
npm ci --omit=dev
chown -R root:root /opt/daw-one
install -m 644 "$repo/deploy/daw-one.service" /etc/systemd/system/
install -m 644 "$repo/deploy/daw-one-kiosk.service" /etc/systemd/system/
install -m 644 "$repo/deploy/daw-one-health.service" /etc/systemd/system/
install -m 644 "$repo/deploy/daw-one-health.timer" /etc/systemd/system/
install -m 755 "$repo/deploy/health.sh" /opt/daw-one/health.sh
install -m 755 "$repo/deploy/kiosk.sh" /opt/daw-one/kiosk.sh
install -m 755 "$repo/deploy/set-display-mode.sh" /opt/daw-one/set-display-mode.sh
printf '%s\n' "$target" > /opt/daw-one/deployment-target
systemctl daemon-reload
systemctl enable daw-one.service daw-one-health.timer
systemctl restart daw-one.service
systemctl start daw-one-health.timer
for attempt in {1..30}; do
  if curl --fail --silent --max-time 2 http://127.0.0.1:3001/api/health >/dev/null; then break; fi
  if [[ $attempt == 30 ]]; then echo 'Backend failed; inspect journalctl -u daw-one.service -b' >&2; exit 1; fi
  sleep 1
done
runuser -u dawone -- node /opt/daw-one/server/doctor.js
echo 'Application backend installed; real hardware remains disabled. Read docs/pi-first-run.md before enabling kiosk. No boot configuration changed.'
