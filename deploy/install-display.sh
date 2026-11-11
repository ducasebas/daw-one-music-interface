#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Run with sudo'; exit 1; }
repo=$(cd "$(dirname "$0")/.." && pwd)
[[ -d /sys/class/backlight/10-0045 ]] || { echo 'Waveshare DSI backlight 10-0045 not detected; display control not installed.'; exit 0; }
install -d -m 755 /usr/local/lib/daw-one-display /etc/systemd/system/daw-one.service.d
install -m 644 "$repo/deploy/display/control.py" /usr/local/lib/daw-one-display/control.py
cat > /etc/systemd/system/daw-one-display.service <<'UNIT'
[Unit]
Description=TuneBox Waveshare DSI brightness and startup reveal
After=systemd-udevd.service
Before=daw-one-kiosk.service
[Service]
Type=simple
User=root
Group=dawone
ExecStartPre=/usr/bin/python3 /usr/local/lib/daw-one-display/control.py --hide
ExecStart=/usr/bin/python3 /usr/local/lib/daw-one-display/control.py
ExecStopPost=/usr/bin/python3 /usr/local/lib/daw-one-display/control.py --restore
RuntimeDirectory=daw-one-display
RuntimeDirectoryMode=0770
UMask=0007
Restart=on-failure
NoNewPrivileges=yes
ProtectHome=yes
ProtectSystem=strict
PrivateTmp=yes
ReadWritePaths=/sys/devices/platform/soc/fe205000.i2c/i2c-22/i2c-10/10-0045/backlight/10-0045 /run/daw-one-display
ReadOnlyPaths=-/run/daw-one-sensors -/var/lib/daw-one-state
[Install]
WantedBy=multi-user.target
UNIT
cat > /etc/systemd/system/daw-one.service.d/display.conf <<'UNIT'
[Unit]
Wants=daw-one-display.service
After=daw-one-display.service
[Service]
ReadWritePaths=/run/daw-one-display
UNIT
systemctl daemon-reload
systemctl enable --now daw-one-display.service
echo 'DSI backlight controller enabled. Initial firmware/kernel frames need the optional quiet-boot configuration.'
