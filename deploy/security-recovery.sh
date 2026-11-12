#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 && $# == 1 && $1 == --clear-pin ]] || { echo 'Usage: sudo bash /opt/daw-one/deploy/security-recovery.sh --clear-pin'; exit 1; }
security_file=/var/lib/daw-one-state/security.json
if [[ -f $security_file ]]; then
  install -d -m 700 /var/lib/daw-one-security-backups
  cp -p "$security_file" "/var/lib/daw-one-security-backups/security-$(date +%s).json"
fi
printf '{}\n' > "$security_file"
chown dawone:dawone "$security_file"
chmod 600 "$security_file"
systemctl restart daw-one.service
echo 'PIN cleared by the local administrator. Set a new PIN on the TuneBox.'
