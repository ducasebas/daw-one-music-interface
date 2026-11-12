#!/usr/bin/env python3
"""Bounded DSI backlight controller. No GPIO, audio or amplifier controls."""
import argparse
import json
import math
import os
from pathlib import Path
import time

BACKLIGHT = Path('/sys/class/backlight/10-0045')
STATE = Path('/run/daw-one-display/status.json')
DEFAULTS = {'brightnessMode':'manual','brightness':80,'minimum':12,'maximum':100}

def read_json(path):
    try:
        text = Path(path).read_text()
        return json.loads(text) if len(text) <= 8192 else {}
    except (OSError, ValueError):
        return {}

def target(settings, telemetry, now):
    s = {**DEFAULTS, **{k:v for k,v in settings.items() if k in DEFAULTS}}
    if s['brightnessMode'] not in ('manual','auto') or not all(isinstance(s[k],(int,float)) and not isinstance(s[k],bool) and math.isfinite(s[k]) and 5 <= s[k] <= 100 for k in ('brightness','minimum','maximum')) or s['minimum'] > s['maximum']:
        s = DEFAULTS.copy()
    fresh = telemetry.get('schema') == 1 and isinstance(telemetry.get('observedAt'),(int,float)) and -1000 <= now*1000-telemetry['observedAt'] <= 15000
    light = telemetry.get('lux',{})
    lux = light.get('value')
    valid = fresh and light.get('status') == 'ok' and isinstance(lux,(int,float)) and not isinstance(lux,bool) and math.isfinite(lux) and 0 <= lux <= 10000000
    if s['brightnessMode'] == 'auto' and valid:
        fraction = max(0,min(1,math.log10(1+lux)/math.log10(1001)))
        return round(s['minimum']+fraction*(s['maximum']-s['minimum'])), 'auto', lux
    return round(s['brightness']), 'sensor-unavailable' if s['brightnessMode'] == 'auto' else 'manual', None

def write_status(value):
    STATE.parent.mkdir(parents=True,exist_ok=True)
    temp = STATE.with_suffix('.tmp')
    temp.write_text(json.dumps(value)+'\n')
    temp.chmod(0o644)
    temp.replace(STATE)

def set_level(percent):
    maximum = int((BACKLIGHT/'max_brightness').read_text())
    if not 1 <= maximum <= 65535:
        raise ValueError('Unsupported backlight range')
    (BACKLIGHT/'brightness').write_text(str(round(maximum*percent/100)))

def loop():
    current = None
    was_revealed = False
    while True:
        now = time.time()
        preferences = read_json('/var/lib/daw-one-state/preferences.json')
        settings = preferences.get('display', read_json('/var/lib/daw-one-state/display.json'))
        activity = read_json('/run/daw-one-display/activity.json')
        fresh_activity = isinstance(activity.get('observedAt'),(int,float)) and -1000 <= now*1000-activity['observedAt'] <= 5000
        screen_off = fresh_activity and activity.get('awake') is False and preferences.get('prefs',{}).get('screen',{}).get('mode') == 'black'
        target_level, mode, lux = target(settings,read_json('/run/daw-one-sensors/readings.json'),now)
        ready = read_json('/run/daw-one-display/ready.json')
        # A local kiosk handshake reveals the decoded first frame. Fail open after
        # 90 seconds, so a broken browser cannot leave the display permanently dark.
        uptime = float(Path('/proc/uptime').read_text().split()[0])
        powering_off = Path('/run/daw-one-display/power-off').exists()
        reveal = not powering_off and not screen_off and (ready.get('ready') is True or uptime > 90)
        wanted = target_level if reveal else 0
        if current is None:
            try: current = int((BACKLIGHT/'brightness').read_text())/int((BACKLIGHT/'max_brightness').read_text())*100
            except (OSError,ValueError): current = wanted
        # Approx. two-second smoothing; a sudden light change never flickers.
        current = wanted if not reveal or not was_revealed else current + max(-3,min(3,(wanted-current)*.22))
        was_revealed = reveal
        try:
            set_level(current)
            write_status({'supported':True,'mode':mode,'brightness':round(current),'target':wanted,'lux':lux,'revealed':reveal,'observedAt':int(now*1000)})
        except (OSError,ValueError):
            write_status({'supported':False,'mode':'unavailable','observedAt':int(now*1000)})
        time.sleep(.25)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--hide',action='store_true'); parser.add_argument('--restore',action='store_true'); args=parser.parse_args()
    if args.hide or args.restore:
        try: set_level(0 if args.hide or Path('/run/daw-one-display/power-off').exists() else 80)
        except (OSError,ValueError): pass
    else:
        loop()
