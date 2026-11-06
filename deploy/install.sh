#!/bin/bash
set -euo pipefail
# One simulated hardware runtime: auto-detected Pi3 B+/Pi4, or explicit ARM64 VM.
target=auto
prebuilt=false
ma_mode=ask
updates_mode=ask
update_key=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --updates) [[ $# -ge 2 ]] || exit 2; updates_mode=$2; shift 2 ;;
    --update-key) [[ $# -ge 2 ]] || exit 2; update_key=$2; shift 2 ;;
    --target) [[ $# -ge 2 ]] || { echo 'Missing --target value' >&2; exit 2; }; target=$2; shift 2 ;;
    --prebuilt) prebuilt=true; shift ;;
    --music-assistant) [[ $# -ge 2 ]] || { echo "Missing --music-assistant value" >&2; exit 2; }; ma_mode=$2; shift 2 ;;
    *) echo 'Usage: install.sh [--target auto|pi4|pi3-experimental|vm] [--prebuilt] [--music-assistant ask|skip|install] [--updates ask|auto|notify|skip] [--update-key PATH]' >&2; exit 2 ;;
  esac
done
case "$target" in auto|pi4|pi3-experimental|vm) ;; *) echo 'Unknown installation target.' >&2; exit 2 ;; esac
case "$updates_mode" in ask|auto|notify|skip) ;; *) echo "Invalid --updates choice" >&2; exit 2 ;; esac
case "$ma_mode" in ask|skip|install) ;; *) echo "Invalid --music-assistant choice" >&2; exit 2 ;; esac
if [[ $target == pi3-experimental && $prebuilt != true ]]; then
  echo 'Pi 3 experimental requires --prebuilt: build/package on the Mac first. See docs/pi3-experimental.md.' >&2; exit 2
fi
if [[ $(id -u) -ne 0 ]]; then echo 'Run with sudo inside the Linux target.' >&2; exit 1; fi
if [[ -L /opt/daw-one ]]; then echo "OTA slot installation detected. Disable OTA and follow docs/ota-updates.md before a manual reinstall." >&2; exit 2; fi
repo=$(cd "$(dirname "$0")/.." && pwd)
source "$repo/deploy/install-target.sh"
if [[ -z $update_key ]]; then
  if [[ -f "$repo/deploy/ota/public.pem" ]]; then update_key="$repo/deploy/ota/public.pem";
  elif [[ -f /etc/daw-one-updater/public.pem ]]; then update_key=/etc/daw-one-updater/public.pem; fi
fi
if [[ $updates_mode == ask ]]; then
  updates_mode=skip
  if [[ -n $update_key && -t 0 ]]; then
    read -r -p 'Software updates: automatic, notify only, or skip? [auto/notify/skip, default notify] ' update_answer
    updates_mode=${update_answer:-notify}
    case "$updates_mode" in auto|notify|skip) ;; *) echo 'Invalid update choice' >&2; exit 2 ;; esac
  else echo 'OTA not enabled automatically: non-interactive installation or project public key missing.'; fi
fi
if [[ $updates_mode != skip ]]; then
  [[ -f $update_key ]] || { echo 'No project signing key. Use --update-key PATH or bundle deploy/ota/public.pem; see docs/ota-updates.md.' >&2; exit 2; }
  update_key=$(readlink -f "$update_key")
  node --input-type=module - "$update_key" <<'JS'
import {readFileSync} from 'node:fs';import {createPublicKey} from 'node:crypto';
if(createPublicKey(readFileSync(process.argv[2])).asymmetricKeyType!=='ed25519')throw Error('Ed25519 public key required');
JS
fi

model=''
if [[ -r /proc/device-tree/model ]]; then model=$(tr -d '\0' </proc/device-tree/model); fi
if [[ $target == auto ]]; then target=$(daw_detect_install_target "$model"); fi
echo "Detected/selected TuneBox target: $target"
if [[ $target == pi3-experimental && $prebuilt != true ]]; then
  echo 'Pi 3 experimental requires --prebuilt: build/package on the Mac first.' >&2; exit 2
fi
virtualization=none
if [[ $target == vm ]]; then virtualization=$(systemd-detect-virt --vm 2>/dev/null || true); fi
daw_validate_install_target "$target" "$(uname -m)" "$model" "$virtualization"
if [[ ! -d /run/systemd/system ]] || ! command -v apt-get >/dev/null; then
  echo 'This installer needs a Debian/Ubuntu ARM64 system running systemd, not macOS or a container.' >&2; exit 1
fi
command -v node >/dev/null || { echo 'Install a supported Node.js 22.12+ runtime first; see docs/raspberry-pi.md'; exit 1; }
node -e 'const [a,b]=process.versions.node.split(".").map(Number);if(a<22||(a===22&&b<12)||typeof WebSocket!=="function"){console.error("Install Node.js 22.12+ with native WebSocket support");process.exit(1)}'
if [[ $prebuilt == true ]]; then
  node "$repo/deploy/release-bundle.js" verify "$repo"
fi
if [[ $target == pi3-experimental ]]; then
  echo 'EXPERIMENTAL Pi 3 B+: performance, kiosk seat and hardware are NOT certified. Static artwork profile; no real hardware enable.'
fi
if [[ $ma_mode == install ]]; then
  # Refuse an unsuitable co-host before changing the app installation.
  node "$repo/deploy/host-capacity.js" "$target"
fi
apt-get update
apt-get install -y --no-install-recommends cage chromium curl alsa-utils libinput-tools wlr-randr seatd dbus-user-session libpam-systemd
getent group dawone >/dev/null || groupadd --system dawone
id dawone >/dev/null 2>&1 || useradd --system --gid dawone --create-home --home-dir /var/lib/dawone --shell /usr/sbin/nologin dawone
usermod -aG video,render,input dawone
install -d -m 700 -o dawone -g dawone /var/lib/dawone/chromium
# Deliberately no gpio, dialout, i2c or audio groups for the simulation service.
cd "$repo"
if [[ $prebuilt != true ]]; then
  npm ci
  npm run check
fi
mkdir -p /opt/daw-one
cp -r dist server shared deploy docs package.json package-lock.json LICENSE THIRD_PARTY_NOTICES.md /opt/daw-one/
if [[ $prebuilt == true ]]; then install -m 644 "$repo/release-manifest.json" /opt/daw-one/release-manifest.json; fi
cd /opt/daw-one
npm ci --omit=dev --ignore-scripts
chown -R root:root /opt/daw-one
# An owner's restrictive umask must not leave public runtime code unreadable by dawone.
chmod 755 /opt/daw-one
chmod -R a+rX /opt/daw-one/{dist,server,shared,deploy,docs,node_modules}
chmod 644 /opt/daw-one/{package.json,package-lock.json,LICENSE,THIRD_PARTY_NOTICES.md}
if [[ -f /opt/daw-one/release-manifest.json ]]; then chmod 644 /opt/daw-one/release-manifest.json; fi
install -m 644 "$repo/deploy/daw-one.service" /etc/systemd/system/
install -m 644 "$repo/deploy/daw-one-kiosk.service" /etc/systemd/system/
install -m 644 "$repo/deploy/daw-one-health.service" /etc/systemd/system/
install -m 644 "$repo/deploy/daw-one-health.timer" /etc/systemd/system/
install -m 755 "$repo/deploy/health.sh" /opt/daw-one/health.sh
install -m 755 "$repo/deploy/kiosk.sh" /opt/daw-one/kiosk.sh
install -m 755 "$repo/deploy/set-display-mode.sh" /opt/daw-one/set-display-mode.sh
printf '%s\n' "$target" > /opt/daw-one/deployment-target
if [[ ! -f /etc/daw-one.env ]]; then
  printf 'DAW_PLAYBACK_MODE=simulation\nMA_ALLOW_CONTROL=false\nMA_VOLUME_LIMIT=40\n' > /etc/daw-one.env
  chown root:dawone /etc/daw-one.env
  chmod 640 /etc/daw-one.env
fi
bash "$repo/deploy/install-manager.sh"
if [[ $updates_mode != skip ]]; then bash "$repo/deploy/install-ota.sh" "$update_key" preview "$updates_mode"; fi
systemctl daemon-reload
systemctl enable daw-one.service daw-one-health.timer
systemctl restart daw-one.service
systemctl start daw-one-health.timer
for attempt in {1..30}; do
  if curl --fail --silent --max-time 2 http://127.0.0.1:3001/api/health >/dev/null; then break; fi
  if [[ $attempt == 30 ]]; then echo 'Backend failed; inspect journalctl -u daw-one.service -b' >&2; exit 1; fi
  sleep 1
done
runuser -u dawone -- node /opt/daw-one/server/doctor.js
echo 'Application backend installed; real hardware remains disabled. Read docs/pi-first-run.md before enabling kiosk. No boot configuration changed.'

if [[ $ma_mode != skip ]]; then
  ma_action=--offer
  [[ $ma_mode != install ]] || ma_action=--install
  if ! bash "$repo/deploy/music-assistant-local.sh" "$ma_action" "$target"; then
    echo 'TuneBox installed, but optional local Music Assistant setup failed. Check its output; existing MA client settings remain unchanged.' >&2
    [[ $ma_mode != install ]] || exit 1
  fi
fi
