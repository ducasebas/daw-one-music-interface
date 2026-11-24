#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Run with sudo'; exit 1; }
repo=$(cd "$(dirname "$0")/.." && pwd)
base=/usr/local/lib/daw-one-control
install -d -m 755 "$base/deploy/sync" "$base/deploy/measurement" "$base/shared"
install -m 644 "$repo"/deploy/sync/{capture.mjs,session.mjs} "$base/deploy/sync/"
# These files are also in the manager's inventory. Never truncate them in place.
python3 "$repo/deploy/host-files.py" file "$repo/deploy/measurement/devices.mjs" "$base/deploy/measurement/devices.mjs"
for file in sync-calibration.js presentation-timing.js; do
  python3 "$repo/deploy/host-files.py" file "$repo/shared/$file" "$base/shared/$file"
done
install -d -m 750 -o dawaudiotest -g dawone /var/lib/daw-one-sync
cat > /etc/systemd/system/daw-one-sync.service <<'UNIT'
[Unit]
Description=TuneBox explicitly requested PCM and USB microphone timing calibration
After=sound.target daw-one.service
[Service]
Type=oneshot
User=dawaudiotest
Group=dawone
SupplementaryGroups=audio
ExecStart=/usr/bin/env node /usr/local/lib/daw-one-control/deploy/sync/capture.mjs
TimeoutStartSec=25
TimeoutStopSec=5
UMask=0027
MemoryMax=128M
CPUQuota=100%
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
ReadWritePaths=/var/lib/daw-one-sync
RestrictAddressFamilies=AF_INET AF_UNIX
StandardOutput=journal
StandardError=journal
UNIT
chmod 644 /etc/systemd/system/daw-one-sync.service
systemctl daemon-reload
# The manager only gets write access to optional state directories that existed when it
# started (ReadWritePaths=-/var/lib/daw-one-sync). Restart it so a fresh install is writable (EROFS otherwise).
systemctl try-restart daw-one-manager.service
echo 'On-demand USB synchronization support installed. No microphone capture was started.'
