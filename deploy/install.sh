#!/bin/bash
set -euo pipefail
# Run from a cloned repository on Raspberry Pi OS Lite. Never edits boot config.
if [[ $(id -u) -ne 0 ]]; then echo 'Run: sudo bash deploy/install.sh'; exit 1; fi
if ! tr -d '\0' </proc/device-tree/model | grep -q 'Raspberry Pi 4'; then echo 'Pi 4 not detected; refusing device installation'; exit 1; fi
command -v node >/dev/null || { echo 'Install a supported Node.js 22.12+ runtime first; see docs/raspberry-pi.md'; exit 1; }
node -e 'const [a,b]=process.versions.node.split(".").map(Number);if(a<22||(a===22&&b<12)||typeof WebSocket!=="function"){console.error("Install Node.js 22.12+ with native WebSocket support");process.exit(1)}'
apt-get update
apt-get install -y --no-install-recommends cage chromium curl alsa-utils libinput-tools wlr-randr seatd dbus-user-session libpam-systemd
getent group dawone >/dev/null || groupadd --system dawone
id dawone >/dev/null 2>&1 || useradd --system --gid dawone --create-home --home-dir /var/lib/dawone --shell /usr/sbin/nologin dawone
usermod -aG video,render,input dawone
install -d -m 700 -o dawone -g dawone /var/lib/dawone/chromium
# Deliberately no gpio, dialout, i2c or audio groups for the simulation service.
repo=$(cd "$(dirname "$0")/.." && pwd)
cd "$repo"
npm ci
npm run check
mkdir -p /opt/daw-one
cp -r dist server shared docs package.json package-lock.json /opt/daw-one/
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
