#!/usr/bin/env bash
set -euo pipefail
# Installed root-owned helper; no arguments or arbitrary external programs.
[[ $EUID == 0 && $# == 0 ]] || exit 1
install -d -m 750 /run/daw-one-display
touch /run/daw-one-display/power-off
# Stop only this device's audio endpoint. Never send a group-wide MA stop.
for unit in tunebox-player.service squeezelite.service daw-one-kiosk.service; do
  systemctl stop "$unit" 2>/dev/null || true
done
if [[ -w /sys/class/backlight/10-0045/brightness ]]; then
  printf '0\n' > /sys/class/backlight/10-0045/brightness
fi
# Normal systemd shutdown closes audio devices and unmounts storage safely.
exec /usr/bin/systemctl --no-block poweroff
