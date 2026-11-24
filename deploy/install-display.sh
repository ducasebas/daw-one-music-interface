#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Run with sudo'; exit 1; }
repo=$(cd "$(dirname "$0")/.." && pwd)
[[ -d /sys/class/backlight/10-0045 ]] || { echo 'Waveshare DSI backlight 10-0045 not detected; display control not installed.'; exit 0; }
install -d -m 755 /usr/local/lib/daw-one-display /etc/systemd/system/daw-one.service.d
stage=$(mktemp -d /usr/local/lib/.daw-one-display.XXXXXX)
trap 'rm -rf "$stage"' EXIT
install -d -m 755 "$stage/controller"
install -m 644 "$repo/deploy/display/control.py" "$stage/controller/control.py"
python3 "$repo/deploy/host-files.py" tree "$stage/controller" /usr/local/lib/daw-one-display --inventory controller.sha256 --display
install -d -m 755 /etc/tmpfiles.d
printf 'd /run/daw-one-display 0770 root dawone -\n' > "$stage/tmpfiles.conf"
python3 "$repo/deploy/host-files.py" file "$stage/tmpfiles.conf" /etc/tmpfiles.d/daw-one-display.conf
systemd-tmpfiles --create /etc/tmpfiles.d/daw-one-display.conf
cat > "$stage/display.service" <<'UNIT'
[Unit]
Description=TuneBox Waveshare DSI brightness and startup reveal
After=systemd-udevd.service
Before=daw-one-kiosk.service
[Service]
Type=simple
User=root
Group=dawone
ExecStartPre=/usr/bin/sha256sum --strict --check --quiet /usr/local/lib/daw-one-display/controller.sha256
ExecStartPre=/usr/bin/python3 /usr/local/lib/daw-one-display/control.py --hide
ExecStart=/usr/bin/python3 /usr/local/lib/daw-one-display/control.py
ExecStopPost=/bin/sh -c '/usr/bin/sha256sum --strict --check --quiet /usr/local/lib/daw-one-display/controller.sha256 && exec /usr/bin/python3 /usr/local/lib/daw-one-display/control.py --restore'
RuntimeDirectory=daw-one-display
RuntimeDirectoryMode=0770
RuntimeDirectoryPreserve=yes
UMask=0007
Restart=on-failure
NoNewPrivileges=yes
ProtectHome=yes
ProtectSystem=strict
PrivateTmp=yes
ReadWritePaths=-/sys/devices/platform/soc/fe205000.i2c/i2c-22/i2c-10/10-0045/backlight/10-0045 /run/daw-one-display
ReadOnlyPaths=-/run/daw-one-sensors -/var/lib/daw-one-state
[Install]
WantedBy=multi-user.target
UNIT
python3 "$repo/deploy/host-files.py" file "$stage/display.service" /etc/systemd/system/daw-one-display.service
cat > "$stage/backend.conf" <<'UNIT'
[Unit]
Wants=daw-one-display.service
After=daw-one-display.service
[Service]
ReadWritePaths=-/run/daw-one-display
UNIT
python3 "$repo/deploy/host-files.py" file "$stage/backend.conf" /etc/systemd/system/daw-one.service.d/display.conf
systemctl daemon-reload
systemctl enable daw-one-display.service
systemctl restart daw-one-display.service
if ! python3 "$repo/deploy/host-files.py" wait-display; then
  journalctl -u daw-one-display.service -n 20 --no-pager || true
  exit 1
fi
echo 'DSI backlight controller enabled. Initial firmware/kernel frames need the optional quiet-boot configuration.'
