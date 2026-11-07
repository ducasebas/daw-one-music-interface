#!/bin/bash
set -euo pipefail
# Presentation selection only; no connector detection or boot-file changes.
mode=${DAW_DISPLAY_MODE:-hdmi-development}
if [[ $# -gt 0 ]]; then
  if [[ $# -ne 2 || $1 != --mode ]]; then echo 'Usage: kiosk.sh [--mode hdmi-development|dsi-production]' >&2; exit 2; fi
  mode=$2
fi
case "$mode" in
  hdmi-development|dsi-production) ;;
  *) echo "Unsupported DAW_DISPLAY_MODE: $mode" >&2; exit 2 ;;
esac
if [[ $(id -u) == 0 ]]; then echo 'Run kiosk as the dawone service user, not root.' >&2; exit 1; fi
for binary in /usr/bin/cage /usr/bin/chromium /usr/bin/dbus-run-session; do
  if [[ ! -x $binary ]]; then echo "Required kiosk executable missing: $binary" >&2; exit 1; fi
done
if [[ ! -d /var/lib/dawone/chromium || ! -w /var/lib/dawone/chromium ]]; then
  echo 'Chromium profile is not writable; rerun the installer.' >&2; exit 1
fi
url="http://127.0.0.1:3001/?gui=2&screen=1&display=$mode"
panel=${DAW_PANEL_PROFILE:-legacy-wide}
if [[ -r /opt/daw-one/panel-profile ]]; then panel=$(cat /opt/daw-one/panel-profile); fi
case "$panel" in legacy-wide|wall-16-10) ;; *) echo 'Unsupported panel profile' >&2; exit 2 ;; esac
url="$url&panel=$panel"
if [[ -r /opt/daw-one/deployment-target ]] && [[ $(cat /opt/daw-one/deployment-target) == pi3-experimental ]]; then
  url="$url&profile=pi3"
fi
# Readiness means the HTTP app responds, not that physical hardware is verified.
for attempt in {1..30}; do
  if /usr/bin/curl --fail --silent --max-time 2 http://127.0.0.1:3001/api/health >/dev/null; then break; fi
  if [[ $attempt == 30 ]]; then echo 'DAW ONE backend unavailable; kiosk not started' >&2; exit 1; fi
  sleep 1
done
if /usr/bin/curl --fail --silent --max-time 2 http://127.0.0.1:3002/status >/dev/null; then
  url="http://127.0.0.1:3002/?display=$mode&panel=$panel"
  if [[ -r /opt/daw-one/deployment-target && $(cat /opt/daw-one/deployment-target) == pi3-experimental ]]; then url="$url&profile=pi3"; fi
fi
printf 'DAW ONE kiosk: %s, logical viewport 1280x400\n' "$mode"
exec /usr/bin/dbus-run-session -- /usr/bin/cage -- /usr/bin/chromium --ozone-platform=wayland --kiosk --force-device-scale-factor=1 --no-first-run --disable-session-crashed-bubble --user-data-dir=/var/lib/dawone/chromium "$url"
