#!/bin/bash
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Run with sudo on the installed Pi.' >&2; exit 1; }
repo=$(cd "$(dirname "$0")/.." && pwd)
base=/usr/local/lib/daw-one-control
getent group dawsensors >/dev/null || groupadd --system dawsensors
id dawpower >/dev/null 2>&1 || useradd --system --gid dawsensors --no-create-home --shell /usr/sbin/nologin dawpower
if getent group i2c >/dev/null; then usermod -aG i2c dawpower; fi
usermod -aG dawsensors dawone
install -d -m 755 "$base/deploy/power" /etc/daw-one-power
install -m 644 "$repo/deploy/power/read.py" "$base/deploy/power/read.py"
if [[ ! -e /etc/daw-one-power/settings.json ]]; then
  printf '{"ina228":false,"husb238":false,"currentPathVerified":false,"voltageSenseVerified":false}\n' > /etc/daw-one-power/settings.json
fi
chmod 644 /etc/daw-one-power/settings.json
cat > /etc/systemd/system/daw-one-power.service <<'UNIT'
[Unit]
Description=TuneBox INA228 and HUSB238 power telemetry (register reads only)
After=systemd-udevd.service
[Service]
Type=simple
User=dawpower
Group=dawsensors
SupplementaryGroups=i2c
ExecStartPre=/usr/bin/test -c /dev/i2c-1
ExecStart=/usr/bin/python3 /usr/local/lib/daw-one-control/deploy/power/read.py
Restart=on-failure
RestartSec=5
RuntimeDirectory=daw-one-power
RuntimeDirectoryMode=0750
UMask=0027
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
RestrictAddressFamilies=AF_UNIX
DevicePolicy=closed
DeviceAllow=/dev/i2c-1 rw
MemoryMax=64M
CPUQuota=10%
StandardOutput=journal
StandardError=journal
[Install]
WantedBy=multi-user.target
UNIT
install -d -m 755 /etc/systemd/system/daw-one.service.d
cat > /etc/systemd/system/daw-one.service.d/power.conf <<'UNIT'
[Service]
SupplementaryGroups=dawsensors
UNIT
systemctl daemon-reload
if [[ -c /dev/i2c-1 ]] && python3 - <<'PY'
import json
from pathlib import Path
value=json.loads(Path('/etc/daw-one-power/settings.json').read_text())
raise SystemExit(0 if value.get('ina228') is True or value.get('husb238') is True else 1)
PY
then
  systemctl enable daw-one-power.service
  systemctl restart daw-one-power.service
fi
echo 'Power telemetry installed. Enable the connected boards under Settings > System > Sensors.'
