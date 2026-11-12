#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 && $# -ge 2 && $1 == --device ]] || { echo 'Usage: sudo bash deploy/install-presence.sh --device /dev/ttyAMA0 [--baud 256000]'; exit 2; }
port=$2;shift 2
baud=256000
if [[ $# == 2 && $1 == --baud ]]; then baud=$2;shift 2;fi
[[ $# == 0 && $port =~ ^/dev/(ttyAMA[0-9]+|ttyUSB[0-9]+|ttyACM[0-9]+)$ && -c $port && $baud =~ ^(9600|19200|38400|57600|115200|256000)$ ]] || { echo 'Choose an existing, verified UART and supported baud rate';exit 2; }
if python3 - "$port" <<'CHECK'
from pathlib import Path
import sys
selected=Path(sys.argv[1]).resolve()
for arg in Path('/proc/cmdline').read_text().split():
 if arg.startswith('console=') and Path('/dev/'+arg.split('=',1)[1].split(',')[0]).resolve()==selected:sys.exit(0)
sys.exit(1)
CHECK
then echo 'Move the serial console off the selected UART before installation.';exit 2;fi
repo=$(cd "$(dirname "$0")/.." && pwd)
apt-get update
apt-get install -y python3-venv
python3 -m venv /opt/daw-one-presence-env
/opt/daw-one-presence-env/bin/pip install pyserial
install -m 644 "$repo/deploy/presence/read.py" /usr/local/lib/daw-one-control/read-presence.py
cat > /etc/systemd/system/daw-one-presence.service <<UNIT
[Unit]
Description=TuneBox read-only HSP24 presence telemetry
After=systemd-udevd.service
[Service]
User=root
ExecStart=/opt/daw-one-presence-env/bin/python /usr/local/lib/daw-one-control/read-presence.py --device $port --baud $baud
RuntimeDirectory=daw-one-presence
RuntimeDirectoryMode=0755
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/run/daw-one-presence
Restart=on-failure
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now daw-one-presence.service
echo 'Presence reader enabled. Software filters are in Settings > Presence. No audio or GPIO output was enabled.'
