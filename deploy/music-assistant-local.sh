#!/bin/bash
set -euo pipefail
# No Docker bootstrap, boot changes, credentials or automatic client migration.
mode=${1:---offer}
target=${2:-}
case "$mode" in --offer|--install|--assess) ;; *) echo 'Usage: music-assistant-local.sh --offer|--install|--assess pi4|pi3-experimental|vm' >&2; exit 2 ;; esac
repo=$(cd "$(dirname "$0")/.." && pwd)
if ! node "$repo/deploy/host-capacity.js" "$target"; then
  echo 'Keep Music Assistant on your existing server/NUC.'
  [[ $mode != --install ]] && exit 0
  exit 1
fi
[[ $mode != --assess ]] || exit 0
if [[ $mode == --offer ]]; then
  if [[ ! -t 0 ]]; then echo 'Non-interactive install: local MA skipped. Use --music-assistant install explicitly if intended.'; exit 0; fi
  echo 'Optional: run an additional Music Assistant server on this Pi using existing Docker/Compose?'
  echo 'This uses host networking and persistent storage; it does not replace your NUC or migrate accounts. Default: no.'
  read -r -p 'Install local MA server? [y/N] ' answer
  case "$answer" in y|Y|yes|YES) ;; *) echo 'Local MA skipped.'; exit 0 ;; esac
fi
[[ $(id -u) == 0 ]] || { echo 'Use sudo for explicit local server installation.' >&2; exit 1; }
command -v docker >/dev/null && docker compose version >/dev/null && docker info >/dev/null || { echo 'Install and configure Docker Engine + Compose using its official instructions first; no remote bootstrap is run.' >&2; exit 1; }
if docker container inspect daw-one-music-assistant >/dev/null 2>&1; then
  echo 'Named container already exists; leaving its configuration/data unchanged.'
  echo 'Inspect it with: sudo docker logs --tail 50 daw-one-music-assistant'
  exit 0
fi
# Refuse a new instance when another process owns the web port. Do not stop it.
node --input-type=module -e 'import net from "node:net";const s=net.createServer();s.on("error",()=>{console.error("Port 8095 unavailable; existing server left untouched");process.exitCode=1;});s.listen(8095,"0.0.0.0",()=>s.close());'
mkdir -p /etc/daw-one
install -d -m 700 /var/lib/daw-one/music-assistant
if [[ -e /etc/daw-one/music-assistant.compose.yml ]]; then
  echo 'Compose configuration already exists; refusing to overwrite it. Inspect it manually.' >&2; exit 1
fi
install -m 644 "$repo/deploy/music-assistant.compose.yml" /etc/daw-one/music-assistant.compose.yml
docker compose -p daw-one-ma -f /etc/daw-one/music-assistant.compose.yml up -d
for attempt in {1..30}; do
  if curl --fail --silent --max-time 2 http://127.0.0.1:8095/ >/dev/null; then
    echo 'MA web endpoint responds on port 8095. Complete onboarding, add providers/player and configure TuneBox separately.'
    echo 'This is not a verified audio or hardware test. Existing /etc/daw-one.env remains unchanged.'
    exit 0
  fi
  sleep 2
done
echo 'Container started but web readiness was not confirmed; inspect sudo docker logs --tail 80 daw-one-music-assistant' >&2
exit 1
