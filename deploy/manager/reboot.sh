#!/usr/bin/env bash
set -euo pipefail
# Installed root-owned helper; no arguments or arbitrary external programs.
[[ $EUID == 0 && $# == 0 ]] || exit 1
install -d -m 750 /run/daw-one-display
touch /run/daw-one-display/rebooting
# Stop only this device's audio endpoint before the restart. Never send a group-wide MA stop.
for unit in tunebox-player.service squeezelite.service; do
  systemctl stop "$unit" 2>/dev/null || true
done
# Normal systemd reboot closes audio devices and unmounts storage safely.
exec /usr/bin/systemctl --no-block reboot
