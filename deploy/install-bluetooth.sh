#!/usr/bin/env bash
# Optional hardware installation. Never invoked by an ordinary GUI/application OTA.
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Run with sudo'; exit 1; }
[[ $# == 3 && $1 == --output && $2 == plughw:CARD=LouderRaspberry,DEV=0 && $3 == --verified-output ]] || { echo 'Usage: sudo bash deploy/install-bluetooth.sh --output plughw:CARD=LouderRaspberry,DEV=0 --verified-output'; exit 2; }
repo=$(cd "$(dirname "$0")/.." && pwd)
[[ -f /etc/systemd/system/daw-one-manager.service ]] || { echo 'Install the device manager first'; exit 1; }
for unit in bluealsa.service bluealsa-aplay.service; do
  if systemctl is-active --quiet "$unit" || systemctl is-enabled --quiet "$unit"; then
    echo 'An existing BlueALSA setup is active or enabled. Review its ownership before installing another receiver.'; exit 1
  fi
done
node --input-type=module - "$repo" <<'JS'
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const {parseDsp}=await import(pathToFileURL(process.argv[2]+'/deploy/manager/dsp.mjs'));
const {bluetoothGainChanges}=await import(pathToFileURL(process.argv[2]+'/shared/bluetooth.js'));
const {controls,faults}=parseDsp(execFileSync('/usr/bin/amixer',['-c','LouderRaspberry','contents'],{encoding:'utf8'}));
if(faults.some(f=>f.active))throw Error('Resolve amplifier faults first');
bluetoothGainChanges(controls,controls,0,40);
JS
# Prevent package post-install scripts from starting an unmanaged receiver.
systemctl mask --runtime bluealsa.service bluealsa-aplay.service
trap 'systemctl unmask --runtime bluealsa.service bluealsa-aplay.service' EXIT
apt-get install -y bluez bluez-alsa-utils libasound2-plugin-bluez python3-dbus python3-gi
systemctl disable bluealsa.service bluealsa-aplay.service
bluealsa-aplay --help | grep -q -- '--volume' || { echo 'BlueALSA with explicit software volume support is required'; exit 1; }
id dawbluetooth >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin dawbluetooth
usermod -aG audio,dawone dawbluetooth
base=/usr/local/lib/daw-one-control
install -d -m 755 "$base/deploy/bluetooth" "$base/deploy/manager" "$base/shared"
install -m 644 "$repo"/deploy/bluetooth/{agent.py,control.py,approved.py,audio.mjs,recover.mjs} "$base/deploy/bluetooth/"
install -m 644 "$repo"/deploy/manager/{bluetooth.mjs,dsp.mjs,io.mjs} "$base/deploy/manager/"
install -m 644 "$repo/shared/bluetooth.js" "$base/shared/"
install -d -m 750 -o root -g dawone /run/daw-one-bluetooth
install -d -m 700 -o root -g root /var/lib/daw-one-bluetooth
cat > /etc/systemd/system/daw-one-bluetooth-agent.service <<'UNIT'
[Unit]
Description=TuneBox confirmed Bluetooth pairing
Requires=bluetooth.service
After=bluetooth.service
[Service]
Type=notify
User=root
Group=dawone
ExecStart=/usr/bin/python3 /usr/local/lib/daw-one-control/deploy/bluetooth/agent.py
RuntimeDirectory=daw-one-bluetooth
RuntimeDirectoryMode=0750
RuntimeDirectoryPreserve=yes
UMask=0027
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
ReadWritePaths=/run/daw-one-bluetooth /var/lib/daw-one-bluetooth
RestrictAddressFamilies=AF_UNIX
MemoryMax=64M
UNIT
chmod 644 /etc/systemd/system/daw-one-bluetooth-agent.service
cat > /etc/systemd/system/daw-one-bluealsa.service <<'UNIT'
[Unit]
Description=TuneBox Bluetooth A2DP sink
Requires=bluetooth.service
After=bluetooth.service
[Service]
Type=dbus
BusName=org.bluealsa.TuneBox
ExecStart=/usr/bin/bluealsa --profile=a2dp-sink --dbus=TuneBox --loglevel=warning
User=root
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
RestrictAddressFamilies=AF_UNIX AF_BLUETOOTH
MemoryMax=64M
UNIT
chmod 644 /etc/systemd/system/daw-one-bluealsa.service
cat > /etc/systemd/system/daw-one-bluetooth-audio.service <<'UNIT'
[Unit]
Description=TuneBox one-phone Bluetooth audio output
Requires=daw-one-bluealsa.service daw-one-bluetooth-agent.service
After=daw-one-bluealsa.service daw-one-bluetooth-agent.service
[Service]
User=dawbluetooth
Group=audio
SupplementaryGroups=dawone
ExecStart=/usr/bin/env node /usr/local/lib/daw-one-control/deploy/bluetooth/audio.mjs
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
RestrictAddressFamilies=AF_UNIX
MemoryMax=64M
UNIT
chmod 644 /etc/systemd/system/daw-one-bluetooth-audio.service
cat > /etc/systemd/system/daw-one-bluetooth-recover.service <<'UNIT'
[Unit]
Description=Restore TuneBox gain controls after Bluetooth source use
After=sound.target
Before=tunebox-player.service squeezelite.service daw-one.service
[Service]
Type=oneshot
User=root
Group=dawone
RuntimeDirectory=daw-one-bluetooth
RuntimeDirectoryMode=0750
RuntimeDirectoryPreserve=yes
ExecStart=/usr/bin/env node /usr/local/lib/daw-one-control/deploy/bluetooth/recover.mjs
RemainAfterExit=yes
TimeoutStartSec=60
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/var/lib/daw-one-manager /run/daw-one-bluetooth
[Install]
WantedBy=multi-user.target
UNIT
chmod 644 /etc/systemd/system/daw-one-bluetooth-recover.service
for unit in tunebox-player.service squeezelite.service; do
 if systemctl cat "$unit" >/dev/null 2>&1; then
  install -d -m 755 "/etc/systemd/system/$unit.d"
  cat > "/etc/systemd/system/$unit.d/bluetooth-recovery.conf" <<'UNIT'
[Unit]
Requires=daw-one-bluetooth-recover.service
After=daw-one-bluetooth-recover.service
UNIT
  chmod 644 "/etc/systemd/system/$unit.d/bluetooth-recovery.conf"
 fi
done
printf '{"verified":true,"output":"plughw:CARD=LouderRaspberry,DEV=0"}\n' > /etc/daw-one/bluetooth.json
chmod 644 /etc/daw-one/bluetooth.json
systemctl daemon-reload
systemctl enable daw-one-bluetooth-recover.service
echo 'Bluetooth receiver installed, still off. Refresh the approved device manager, then choose Bluetooth in Settings > Connections. Pairing requires on-screen confirmation.'
