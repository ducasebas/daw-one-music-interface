#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 && $# == 2 && $1 == --gpio && $2 =~ ^(5|6|16|17|22|23|24|25|26|27)$ ]] || { echo 'Usage: sudo bash deploy/install-button.sh --gpio VERIFIED_FREE_BCM_GPIO';exit 2; }
repo=$(cd "$(dirname "$0")/.." && pwd)
apt-get update
apt-get install -y python3-venv
python3 -m venv /opt/daw-one-button-env
/opt/daw-one-button-env/bin/pip install 'gpiod>=2.2.2,<3'
install -m 644 "$repo/deploy/button/button.py" /usr/local/lib/daw-one-control/button.py
cat > /etc/systemd/system/daw-one-button.service <<UNIT
[Unit]
Description=TuneBox physical short/long button
After=daw-one.service
Requires=daw-one.service
[Service]
User=root
Group=dawone
ExecStart=/opt/daw-one-button-env/bin/python /usr/local/lib/daw-one-control/button.py --gpio $2
RuntimeDirectory=daw-one-button
RuntimeDirectoryMode=0750
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/run/daw-one-button
Restart=on-failure
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now daw-one-button.service
echo 'Button actions enabled. This free-GPIO input alone does not wake a halted Pi. GPIO3 wake needs separate I2C-compatible wiring.'
