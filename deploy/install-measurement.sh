#!/bin/bash
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Run with sudo'; exit 1; }
[[ ${1:-} == --output && ${3:-} == --verified-output && $# == 3 ]] || { echo 'Usage: sudo bash deploy/install-measurement.sh --output plughw:CARD=Headphones,DEV=0 --verified-output'; echo 'Verify the actual amplifier, routing and a safe output level before enabling audible measurements.'; exit 2; }
output=$2
case "$output" in plughw:CARD=Headphones,DEV=0|plughw:CARD=LouderRaspberry,DEV=0) ;; *) echo 'Unsupported output'; exit 2 ;; esac
repo=$(cd "$(dirname "$0")/.." && pwd)
[[ -e /etc/systemd/system/daw-one-manager.service ]] || { echo 'Install the device manager first'; exit 1; }
aplay -L | grep -F "$output" >/dev/null || { echo 'Selected ALSA output was not detected'; exit 1; }
id dawaudiotest >/dev/null
usermod -aG audio dawaudiotest
base=/usr/local/lib/daw-one-control
install -d -m 755 "$base/deploy/measurement" "$base/shared"
install -m 644 "$repo"/deploy/measurement/{signal.mjs,capture.mjs,devices.mjs,player-state.mjs} "$base/deploy/measurement/"
install -m 644 "$repo"/shared/{room-measurement.js,room-targets.js} "$base/shared/"
install -d -m 750 -o dawaudiotest -g dawone /var/lib/daw-one-measurement
printf '{"output":"%s","verified":true}\n' "$output" > /etc/daw-one/measurement.json
chmod 644 /etc/daw-one/measurement.json
cat > /etc/systemd/system/daw-one-measurement.service <<'UNIT'
[Unit]
Description=TuneBox explicitly requested USB microphone room sweep
After=sound.target
[Service]
Type=oneshot
User=dawaudiotest
Group=dawone
SupplementaryGroups=audio
ExecStartPre=+/usr/bin/env node /usr/local/lib/daw-one-control/deploy/measurement/player-state.mjs prepare
ExecStart=/usr/bin/env node /usr/local/lib/daw-one-control/deploy/measurement/capture.mjs
ExecStopPost=+/usr/bin/env node /usr/local/lib/daw-one-control/deploy/measurement/player-state.mjs restore
TimeoutStartSec=60
TimeoutStopSec=15
MemoryMax=256M
CPUQuota=150%
UMask=0027
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
NoNewPrivileges=yes
ReadWritePaths=/var/lib/daw-one-measurement /var/lib/daw-one-manager
RestrictAddressFamilies=AF_UNIX
UNIT
systemctl daemon-reload
echo 'USB microphone sweep support installed. No sweep was started. The wizard requires explicit audible consent.'
