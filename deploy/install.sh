#!/bin/bash
set -euo pipefail
# Run from a cloned repository on Raspberry Pi OS Lite. Never edits boot config.
if [[ $(id -u) -ne 0 ]]; then echo 'Run: sudo bash deploy/install.sh'; exit 1; fi
if ! tr -d '\0' </proc/device-tree/model | grep -q 'Raspberry Pi 4'; then echo 'Pi 4 not detected; refusing device installation'; exit 1; fi
command -v node >/dev/null || { echo 'Install a supported Node.js 22+ runtime first; see docs/raspberry-pi.md'; exit 1; }
node -e 'if(+process.versions.node.split(".")[0]<22)process.exit(1)'
apt-get update
apt-get install -y --no-install-recommends cage chromium curl alsa-utils libinput-tools wlr-randr seatd
id dawone >/dev/null 2>&1 || useradd --system --create-home --home-dir /var/lib/dawone --shell /usr/sbin/nologin dawone
usermod -aG video,render,input dawone
# Deliberately no gpio, dialout, i2c or audio groups for the simulation service.
repo=$(cd "$(dirname "$0")/.." && pwd)
cd "$repo"
npm ci
npm run check
mkdir -p /opt/daw-one
cp -r dist server shared package.json package-lock.json /opt/daw-one/
cd /opt/daw-one
npm ci --omit=dev
chown -R root:root /opt/daw-one
install -m 644 "$repo/deploy/daw-one.service" /etc/systemd/system/
install -m 644 "$repo/deploy/daw-one-kiosk.service" /etc/systemd/system/
install -m 644 "$repo/deploy/daw-one-health.service" /etc/systemd/system/
install -m 644 "$repo/deploy/daw-one-health.timer" /etc/systemd/system/
install -m 755 "$repo/deploy/health.sh" /opt/daw-one/health.sh
systemctl daemon-reload
systemctl enable --now daw-one.service daw-one-health.timer
echo 'Simulation backend installed. Review docs/raspberry-pi.md before enabling kiosk; no boot configuration changed.'
