#!/usr/bin/env bash
# One complete device refresh, then signed OTA can maintain this same host layer.
set -euo pipefail
[[ ${1:-} == --check || ${1:-} == --apply ]] || { echo 'Usage: sudo bash deploy/update-appliance.sh --check|--apply'; exit 2; }
[[ $EUID == 0 ]] || { echo 'Run with sudo'; exit 1; }
if [[ $1 == --apply && ${TUNEBOX_APPLIANCE_LOCKED:-0} != 1 ]]; then
  exec 9>/run/daw-one-update.lock
  flock -w 30 9
fi
repo=$(cd "$(dirname "$0")/.." && pwd -P)
[[ -f /opt/daw-one/deployment-target && -f "$repo/release-manifest.json" ]] || { echo 'Install a verified TuneBox release first.'; exit 1; }
target=$(cat /opt/daw-one/deployment-target)
[[ $target == pi4 || $target == pi3-experimental ]] || { echo 'This refresh is for the installed Pi appliance.'; exit 1; }
# A device refresh accepts only the immutable, root-owned installed release tree.
python3 - "$repo" <<'PYTHON'
from pathlib import Path
import os, stat, sys
p=Path(sys.argv[1])
for q in [p,*p.parents,p/'release-manifest.json']:
    s=q.lstat()
    if stat.S_ISLNK(s.st_mode) or s.st_uid!=0 or s.st_mode&0o022:
        raise SystemExit('The installed release and its parents must be root-owned and not writable by other users: '+str(q))
for root in ('deploy','dist','server','shared'):
    for q in [p/root,*(p/root).rglob('*')]:
        s=q.lstat()
        if stat.S_ISLNK(s.st_mode) or s.st_uid!=0 or s.st_mode&0o022:
            raise SystemExit('Device update payload must be root-owned and not writable by other users: '+str(q))
PYTHON
node --input-type=module - "$repo" <<'JS'
import {pathToFileURL} from 'node:url';
import {readFileSync} from 'node:fs';
const root=process.argv[2],manifest=JSON.parse(readFileSync(root+'/release-manifest.json'));
const {verifyTree}=await import(pathToFileURL(root+'/deploy/ota/verify-tree.mjs'));
verifyTree(root,manifest.release);
console.log('Verified device update:',manifest.release);
JS
if [[ $1 == --check ]]; then
  echo 'Ready: Chromium appliance policy, kiosk launcher, display service, quiet boot with virtual console, bounded boot logs and OTA host maintenance.'
  exit 0
fi
node --input-type=module - "$repo" <<'JS'
import {pathToFileURL} from 'node:url';
const root=process.argv[2];
const {localHttp}=await import(pathToFileURL(root+'/deploy/ota/local-http.mjs'));
const {canUpdate}=await import(pathToFileURL(root+'/deploy/ota/policy.mjs'));
const response=await localHttp('/api/state');
if(!response.ok||!canUpdate(JSON.parse(response.body)))throw Error('Pause music and finish device changes before the complete device update.');
JS
# Existing managers already block shutdown/update requests while request.json exists.
# Exclusive creation prevents overwriting a request that arrived during preflight.
maintenance_id="appliance-$$-$(date +%s)"
python3 - "$maintenance_id" <<'PYTHON'
from pathlib import Path
import json, sys
p=Path('/var/lib/daw-one-updater/request.json')
p.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
with p.open('x') as f:json.dump({'action':'device-maintenance','maintenanceId':sys.argv[1]},f)
p.chmod(0o600)
PYTHON
cleanup_request() {
  python3 - "$maintenance_id" <<'PYTHON'
from pathlib import Path
import json, sys
p=Path('/var/lib/daw-one-updater/request.json')
try:
    if json.loads(p.read_text()).get('maintenanceId')==sys.argv[1]:p.unlink()
except (FileNotFoundError,ValueError):pass
PYTHON
}
trap cleanup_request EXIT
python3 "$repo/deploy/chromium/configure.py"
python3 "$repo/deploy/display/cursor-theme.py"
install -m 755 "$repo/deploy/kiosk.sh" "$repo/kiosk.sh"
install -m 755 "$repo/deploy/set-panel-profile.sh" "$repo/set-panel-profile.sh"
if [[ $target == pi4 ]]; then
  bash "$repo/deploy/install-display.sh"
  python3 "$repo/deploy/display/quiet-boot.py"
fi
install -d -m 755 /etc/systemd/journald.conf.d
cat > /etc/systemd/journald.conf.d/tunebox-boot.conf <<'JOURNAL'
[Journal]
Storage=persistent
SystemMaxUse=64M
SystemKeepFree=256M
RuntimeMaxUse=16M
JOURNAL
systemctl restart systemd-journald.service
journalctl --flush
if [[ -f /etc/daw-one-updater/public.pem && -f /etc/daw-one-updater/config.json ]]; then
  read -r channel mode < <(node --input-type=module <<'JS'
import {readFileSync} from 'node:fs';
const c=JSON.parse(readFileSync('/etc/daw-one-updater/config.json'));
if(!['preview','stable'].includes(c.channel)||!['auto','notify','paused'].includes(c.policy?.mode))throw Error('Invalid OTA policy');
console.log(c.channel,c.policy.mode);
JS
)
  bash "$repo/deploy/install-ota.sh" /etc/daw-one-updater/public.pem "$channel" "$mode"
  node --input-type=module <<'JS'
import {readFileSync,writeFileSync,renameSync} from 'node:fs';
const p='/etc/daw-one-updater/config.json',c=JSON.parse(readFileSync(p));
writeFileSync(p+'.tmp',JSON.stringify({...c,applianceUpdates:true})+'\n',{mode:0o600});renameSync(p+'.tmp',p);
JS
else
  bash "$repo/deploy/install-manager.sh"
fi
node --input-type=module - "$repo" <<'JS'
import {readFileSync,writeFileSync,renameSync} from 'node:fs';
const m=JSON.parse(readFileSync(process.argv[2]+'/release-manifest.json'));
const p='/var/lib/daw-one-manager/appliance.json';
writeFileSync(p+'.tmp',JSON.stringify({schema:1,revision:1,release:m.release,installedAt:new Date().toISOString()})+'\n',{mode:0o600});renameSync(p+'.tmp',p);
JS
systemctl daemon-reload
# The OTA caller keeps its progress screen alive until the candidate is healthy.
if [[ ${TUNEBOX_APPLIANCE_OTA:-0} != 1 ]]; then
  systemctl restart daw-one-kiosk.service
fi
echo 'Complete device update applied. Quiet boot takes effect after the next restart. Network, Music Assistant, PCM and audio routing were preserved.'
