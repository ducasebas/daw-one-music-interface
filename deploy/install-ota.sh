#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Run with sudo'; exit 1; }
key=${1:?Usage: install-ota.sh PUBLIC_KEY [preview|stable]}
channel=${2:-preview}
[[ $channel == preview || $channel == stable ]] || exit 1
[[ -d /opt/daw-one && -f /etc/daw-one.env ]] || { echo 'Install TuneBox first'; exit 1; }
node --input-type=module - "$key" <<'JS'
import {readFileSync} from 'node:fs';import {createPublicKey} from 'node:crypto';
if(createPublicKey(readFileSync(process.argv[2])).asymmetricKeyType!=='ed25519')throw Error('Ed25519 public key required');
JS
command -v flock >/dev/null
command -v python3 >/dev/null
python3 -c 'import tarfile; assert hasattr(tarfile, "data_filter"), "Install Python with tarfile data-filter support first"'
id dawupdatebuild >/dev/null 2>&1 || useradd --system --create-home --home-dir /var/lib/daw-one-update-build --shell /usr/sbin/nologin dawupdatebuild
install -d -m 700 /etc/daw-one-updater /var/lib/daw-one-updater
install -d -m 755 /usr/local/lib/daw-one-updater /var/lib/daw-one-update-status /opt/daw-one-releases
install -m 600 "$key" /etc/daw-one-updater/public.pem
printf '{"channel":"%s"}\n' "$channel" > /etc/daw-one-updater/config.json
install -m 644 "$(dirname "$0")"/ota/{update.mjs,policy.mjs,verify-tree.mjs,safe-extract.py} /usr/local/lib/daw-one-updater/
cat > /etc/systemd/system/daw-one-update.service <<'UNIT'
[Unit]
Description=TuneBox signed release update (idle only)
After=network-online.target daw-one.service
Wants=network-online.target
[Service]
Type=oneshot
ExecStart=/usr/bin/flock -n /run/daw-one-update.lock /usr/bin/node /usr/local/lib/daw-one-updater/update.mjs
TimeoutStartSec=10min
Nice=10
UMask=0077
ProtectHome=yes
PrivateTmp=yes
UNIT
cat > /etc/systemd/system/daw-one-update.timer <<'UNIT'
[Unit]
Description=Check TuneBox signed update channel
[Timer]
OnBootSec=5min
OnUnitActiveSec=15min
RandomizedDelaySec=60
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now daw-one-update.timer
echo 'Signed OTA enabled. Checks every 15 minutes; playback defers updates. No GPIO/boot changes.'
