#!/bin/bash
# Read-only first-run inventory. No installs, restarts, boot edits or hardware writes.
set -uo pipefail
printf 'TuneBox Pi inventory (read-only; not hardware certification)\n'
if [[ -r /proc/device-tree/model ]]; then tr -d '\0' </proc/device-tree/model; printf '\n'; else printf 'Pi model: not detected\n'; fi
uname -m
if [[ -r /etc/os-release ]]; then sed -n '/^PRETTY_NAME=/p' /etc/os-release; fi
command -v node >/dev/null && node --version || true
command -v npm >/dev/null && npm --version || true
free -m
findmnt -no FSTYPE / 2>/dev/null || true
df -h / /opt/daw-one 2>/dev/null || df -h /
for path in /opt/daw-one/dist /opt/daw-one/node_modules /var/lib/dawone/chromium /var/log/journal; do
  if [[ -d $path ]]; then du -sh "$path" 2>/dev/null || printf '%s: needs permission to measure\n' "$path"; fi
done
if command -v vcgencmd >/dev/null; then vcgencmd measure_temp; vcgencmd get_throttled; else printf 'Pi firmware measurements: unavailable\n'; fi
if command -v journalctl >/dev/null; then journalctl --disk-usage 2>/dev/null || true; fi
if [[ -d /run/systemd/system ]]; then
  for service in daw-one.service daw-one-kiosk.service daw-one-health.timer; do
    printf '\n%s\n' "$service"
    systemctl show "$service" -p ActiveState -p SubState -p MemoryCurrent -p MemoryPeak -p TasksCurrent -p NRestarts 2>/dev/null || true
  done
else printf 'systemd: not active on this host\n'; fi
if id dawone >/dev/null 2>&1; then
  printf '\nService-user processes: raw RSS KiB can include shared pages; do not sum as unique RAM.\n'
  ps -u dawone -o comm,pcpu,rss 2>/dev/null || true
fi
if command -v aplay >/dev/null; then aplay -l 2>&1 || true; else printf 'ALSA inventory tool unavailable\n'; fi
printf '\nReal GPIO/amplifier enable remains unimplemented; this report cannot approve electrical safety.\n'
