#!/usr/bin/env bash
set -euo pipefail
player_id=''
enable_export=false
remove=false
detect=false
while [[ $# -gt 0 ]]; do
 case "$1" in
  --detect) detect=true;shift;;
  --player-id) [[ $# -ge 2 ]] || exit 2; player_id=${2,,};shift 2;;
  --enable-export) enable_export=true;shift;;
  --remove) remove=true;shift;;
  *) echo 'Usage: install-audio-analysis.sh (--detect | --player-id EXISTING_MAC) [--enable-export] | --remove' >&2;exit 2;;
 esac
done
[[ $EUID == 0 ]] || { echo 'Run with sudo';exit 1; }
repo=$(cd "$(dirname "$0")/.." && pwd)
[[ -f /etc/systemd/system/daw-one.service ]] || { echo 'Install TuneBox first';exit 1; }
override=/etc/systemd/system/tunebox-player.service.d/90-tunebox-analysis.conf
if [[ $remove == true ]]; then
 changed=false
 if [[ -f $override ]]; then rm "$override";changed=true;fi
 rm -f /etc/systemd/system/daw-one.service.d/audio-analysis.conf /etc/tmpfiles.d/daw-one-audio.conf
 systemctl daemon-reload
 if [[ $changed == true ]]; then systemctl restart tunebox-player.service;fi
 systemctl restart daw-one.service
 echo 'Measurement integration removed; original player unit restored. No ALSA/boot configuration changed.'
 exit 0
fi
if [[ $detect == true && -z $player_id ]]; then
 pid=$(systemctl show -p MainPID --value tunebox-player.service)
 player_id=$(python3 "$repo/deploy/audio/player-export.py" detect "$pid")
fi
[[ $player_id =~ ^([0-9a-f]{2}:){5}[0-9a-f]{2}$ ]] || { echo 'Specify the existing Squeezelite player MAC with --player-id';exit 2; }
[[ $(uname -m) == aarch64 || $(uname -m) == x86_64 ]] || { echo 'This reader requires a native 64-bit glibc Linux player';exit 1; }
getconf GNU_LIBC_VERSION >/dev/null || { echo 'glibc is required';exit 1; }
export_change_needed=false
if [[ $enable_export == true ]]; then
 pid=$(systemctl show -p MainPID --value tunebox-player.service)
 result=$(python3 "$repo/deploy/audio/player-export.py" check "$pid" "$player_id")
 printf '%s\n' "$result"
 [[ $result == "Export already enabled" ]] || export_change_needed=true
fi
if ! command -v cc >/dev/null || [[ ! -f /usr/include/pthread.h ]]; then
 apt-get update
 apt-get install -y --no-install-recommends gcc libc6-dev
fi
build=$(mktemp -d)
trap 'rm -rf "$build"' EXIT
cc -O2 -std=c11 -Wall -Wextra -Werror -pthread "$repo/deploy/audio/pcm-reader.c" -o "$build/pcm-reader"
install -d -m 755 /usr/local/lib/daw-one-audio /etc/systemd/system/daw-one.service.d /run/daw-one-audio-shm
install -m 755 "$build/pcm-reader" /usr/local/lib/daw-one-audio/pcm-reader
printf 'd /run/daw-one-audio-shm 0755 root root -\n' > /etc/tmpfiles.d/daw-one-audio.conf
cat > /etc/systemd/system/daw-one.service.d/audio-analysis.conf <<UNIT
[Service]
BindReadOnlyPaths=/dev/shm:/run/daw-one-audio-shm
Environment=DAW_AUDIO_READER=/usr/local/lib/daw-one-audio/pcm-reader
Environment=DAW_AUDIO_SHM_DIR=/run/daw-one-audio-shm
Environment=DAW_AUDIO_PLAYER_ID=$player_id
UNIT
if [[ $export_change_needed == true ]]; then
 python3 "$repo/deploy/audio/player-export.py" write "$pid" "$player_id"
 systemctl daemon-reload
 systemctl restart tunebox-player.service
else
 echo 'Player service unchanged. Enable upstream -v yourself if it is not already present.'
fi
systemctl daemon-reload
systemctl restart daw-one.service
printf 'PCM reader installed for %s. Measurements default off: enable in Settings > Audio analysis.\n' "$player_id"
echo 'No ALSA route, volume, player identity, server address, GPIO or boot configuration changed.'
