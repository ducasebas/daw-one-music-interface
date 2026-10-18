#!/bin/bash
set -euo pipefail
# This deliberately does not edit config.txt/cmdline.txt or enable a display driver.
if [[ $# != 1 ]]; then echo 'Usage: set-display-mode.sh hdmi-development|dsi-production' >&2; exit 2; fi
case "$1" in hdmi-development|dsi-production) ;; *) echo 'Unknown display mode' >&2; exit 2 ;; esac
if [[ $(id -u) != 0 ]]; then echo 'Run this command with sudo on the installed Pi.' >&2; exit 1; fi
printf 'DAW_DISPLAY_MODE=%s\n' "$1" > /etc/daw-one-display.env
chmod 644 /etc/daw-one-display.env
if systemctl is-active --quiet daw-one-kiosk.service; then systemctl restart daw-one-kiosk.service; fi
printf 'Display mode saved: %s. Backend and playback have not been restarted.\n' "$1"
