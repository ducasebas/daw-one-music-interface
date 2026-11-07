#!/bin/bash
# Browser geometry only: never edits boot configuration or display timings.
set -euo pipefail
case "${1:-}" in
  legacy-wide|wall-16-10) ;;
  *) echo 'Usage: set-panel-profile.sh legacy-wide|wall-16-10' >&2; exit 2 ;;
esac
if [[ $(id -u) != 0 ]]; then echo 'Run with sudo.' >&2; exit 1; fi
if [[ ! -f /opt/daw-one/kiosk.sh ]]; then echo 'Install TuneBox first.' >&2; exit 1; fi
printf '%s\n' "$1" > /opt/daw-one/panel-profile
chmod 644 /opt/daw-one/panel-profile
echo "Panel profile saved: $1. Restart daw-one-kiosk.service when ready. No display timing or boot changes applied."
