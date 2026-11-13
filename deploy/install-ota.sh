#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Run with sudo'; exit 1; }
key=${1:?Usage: install-ota.sh PUBLIC_KEY [preview|stable] [auto|notify|paused]}
channel=${2:-preview}
mode=${3:-notify}
[[ $mode == auto || $mode == notify || $mode == paused ]] || exit 1
repo=$(cd "$(dirname "$0")/.." && pwd)
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
if [[ $(readlink -f "$key") != /etc/daw-one-updater/public.pem ]]; then install -m 600 "$key" /etc/daw-one-updater/public.pem; fi
node --input-type=module - "$channel" "$mode" <<'JS'
import {writeFileSync,readFileSync} from 'node:fs';
const path='/etc/daw-one-updater/config.json';let previous={};try{previous=JSON.parse(readFileSync(path,'utf8'));}catch{}
writeFileSync(path,JSON.stringify({...previous,channel:process.argv[2],policy:{mode:process.argv[3],windowEnabled:false,start:'02:00',end:'05:00',timeZone:'Europe/Amsterdam',...previous.policy,mode:process.argv[3]}})+'\n',{mode:0o600});
JS
install -m 644 "$repo"/deploy/ota/{update.mjs,policy.mjs,appliance.mjs,prepare-runtime.mjs,local-http.mjs,releases.mjs,verify-tree.mjs,safe-extract.py} /usr/local/lib/daw-one-updater/
install -m 644 "$repo/shared/update-settings.js" /usr/local/lib/daw-one-updater/settings.mjs
if [[ -f /etc/systemd/system/daw-one-kiosk.service ]]; then python3 "$repo/deploy/ota/migrate-kiosk.py"; fi
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
bash "$repo/deploy/install-manager.sh"
systemctl daemon-reload
systemctl enable --now daw-one-update.timer
echo 'Signed OTA enabled. Checks every 15 minutes; playback defers updates. No GPIO/boot changes.'
