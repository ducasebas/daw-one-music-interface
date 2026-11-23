#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Run with sudo'; exit 1; }
repo=$(cd "$(dirname "$0")/.." && pwd)
[[ -d /opt/daw-one ]] || { echo 'Install TuneBox first'; exit 1; }
getent group dawcontrol >/dev/null || groupadd --system dawcontrol
usermod -aG dawcontrol dawone
for tunebox_private_config in /etc/daw-one/music-assistant.token /etc/daw-one.env; do
  if [[ -f "$tunebox_private_config" && ! -L "$tunebox_private_config" ]]; then
    chown root:dawcontrol "$tunebox_private_config"
    chmod 640 "$tunebox_private_config"
  fi
done
install -d -m 755 /etc/tmpfiles.d
printf 'f /run/daw-one-update.lock 0600 root root -\nd /run/daw-one-dsp 0750 root dawone -\n' > /etc/tmpfiles.d/daw-one-manager.conf
install -d -m 750 -o root -g dawone /run/daw-one-dsp
touch /run/daw-one-update.lock
chmod 600 /run/daw-one-update.lock
base=/usr/local/lib/daw-one-control
install -d -m 755 "$base"/{deploy/manager,deploy/measurement,deploy/ota,shared,server,public} /var/lib/daw-one-update-status
install -d -m 700 /var/lib/daw-one-manager /var/lib/daw-one-updater /etc/daw-one-updater /etc/NetworkManager/system-connections
install -d -m 750 -o root -g dawone /etc/daw-one
# Stage the root manager first and refuse to replace it when any imported module is missing (GUI 3.16.2 shipped
# root-adapter.mjs importing ssh.mjs, which this list did not copy, so the manager and its update page stopped).
stage=$(mktemp -d /usr/local/lib/.daw-one-control.XXXXXX)
trap 'rm -rf "$stage"' EXIT
install -d -m 755 "$stage"/{deploy/manager,deploy/measurement,deploy/ota,shared,server,public}
install -m 644 "$repo"/deploy/manager/*.mjs "$repo"/deploy/manager/progress.html "$stage/deploy/manager/"
install -m 755 "$repo"/deploy/manager/{power-off.sh,reboot.sh} "$stage/deploy/manager/"
install -m 644 "$repo"/dist/{appliance.js,appliance.css} "$stage/public/"
install -m 644 "$repo"/deploy/ota/policy.mjs "$stage/deploy/ota/"
install -m 644 "$repo"/shared/*.js "$stage/shared/"
install -m 644 "$repo"/server/{update-status.js,ma-transport.js} "$stage/server/"
install -m 644 "$repo"/deploy/measurement/devices.mjs "$stage/deploy/measurement/"
install -m 644 "$repo"/deploy/{host-capacity.js,music-assistant-local.sh,music-assistant.compose.yml} "$stage/deploy/"
printf '{"type":"module"}\n' > "$stage/package.json"
node "$repo/deploy/manager/check-imports.mjs" "$stage" $(cd "$stage" && ls deploy/manager/*.mjs)
cp -a "$stage"/. "$base"/
printf '{"type":"module"}\n' > "$base/package.json"
id dawaudiotest >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin dawaudiotest
usermod -aG audio dawaudiotest
cat > /etc/systemd/system/daw-one-manager.service <<'UNIT'
[Unit]
Description=TuneBox bounded device setup and update control
After=network.target daw-one-pd-startup.service
[Service]
Type=simple
User=root
Group=dawcontrol
ExecStart=/usr/bin/env node /usr/local/lib/daw-one-control/deploy/manager/service.mjs
Restart=on-failure
RuntimeDirectory=daw-one-manager
RuntimeDirectoryMode=0750
UMask=0077
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
MemoryMax=128M
ReadWritePaths=/run/daw-one-update.lock /run/daw-one-dsp /run/daw-one-pd -/var/lib/daw-one-sync -/run/daw-one-display -/run/daw-one-bluetooth /etc/daw-one-power /etc/daw-one /etc/daw-one.env /etc/daw-one-updater /var/lib/daw-one-manager /var/lib/daw-one-updater /var/lib/daw-one-update-status /etc/NetworkManager/system-connections /var/lib/daw-one -/var/lib/daw-one-measurement
StandardOutput=journal
StandardError=journal
[Install]
WantedBy=multi-user.target
UNIT
chmod 644 /etc/systemd/system/daw-one-manager.service
install -d -m 755 /etc/systemd/system/daw-one.service.d
cat > /etc/systemd/system/daw-one.service.d/manager.conf <<'UNIT'
[Unit]
Wants=daw-one-manager.service
After=daw-one-manager.service
[Service]
EnvironmentFile=-/etc/daw-one/connection.env
SupplementaryGroups=dawcontrol
UNIT
chmod 644 /etc/systemd/system/daw-one.service.d/manager.conf
install -d -m 700 /var/lib/daw-one
cat > /etc/systemd/system/daw-one-local-ma-install.service <<'UNIT'
[Unit]
Description=TuneBox explicitly requested local Music Assistant installation
After=network-online.target docker.service
[Service]
Type=oneshot
User=root
ExecStart=/usr/bin/env node /usr/local/lib/daw-one-control/deploy/manager/local-ma-job.mjs
TimeoutStartSec=15min
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
NoNewPrivileges=yes
ReadWritePaths=/etc/daw-one /var/lib/daw-one /var/lib/daw-one-manager
StandardOutput=journal
StandardError=journal
UNIT
chmod 644 /etc/systemd/system/daw-one-local-ma-install.service
bash "$repo/deploy/install-sync.sh"
bash "$repo/deploy/install-power.sh"
systemctl daemon-reload
systemctl enable daw-one-manager.service
systemctl restart daw-one-manager.service
# The manager serves the update progress page; confirm it is answering again before reporting success.
for attempt in $(seq 1 20); do
  if curl --fail --silent --max-time 1 http://127.0.0.1:3002/status >/dev/null; then echo 'TuneBox manager running'; exit 0; fi
  sleep 1
done
journalctl -u daw-one-manager.service -n 20 --no-pager || true
echo 'The TuneBox manager did not start; see the log above.' >&2
exit 1
