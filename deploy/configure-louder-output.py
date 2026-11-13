from pathlib import Path
from datetime import datetime
import json, os, runpy, shutil, subprocess

helper = runpy.run_path('/opt/daw-one/deploy/audio/player-export.py')
query = ['busctl', '--json=short', 'get-property', 'org.freedesktop.systemd1',
         '/org/freedesktop/systemd1/unit/tunebox_2dplayer_2eservice',
         'org.freedesktop.systemd1.Service', 'ExecStartEx']
def command():
    payload = json.loads(subprocess.check_output(query, text=True, timeout=10))
    return helper['systemd_command'](payload)[1]

def with_louder(argv):
    if any(a.startswith(option) for a in argv[1:] for option in ('-V', '-O', '-U')):
        raise ValueError('Speciale mixerinstelling gevonden; eerst de bestaande route controleren.')
    if argv.count('-o') != 1 or argv.index('-o') + 1 >= len(argv):
        raise ValueError('Geen uniek los -o uitgangsargument; eerst de bestaande route controleren.')
    updated = list(argv)
    updated[updated.index('-o') + 1] = 'plughw:CARD=LouderRaspberry,DEV=0'
    return helper['export_arguments'](updated, helper['existing_player_id'](argv))

if __name__ == '__main__':
    os.umask(0o077)
    if 'LouderRaspberry' not in Path('/proc/asound/cards').read_text():
        raise SystemExit('De Louder-geluidskaart is niet beschikbaar.')
    argv = with_louder(command())
    target = Path('/etc/systemd/system/tunebox-player.service.d/99-tunebox-louder.conf')
    previous = target.read_bytes() if target.exists() else None
    if previous is not None:
        shutil.copy2(target, str(target) + '.before-' + datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix('.conf.tmp')
    temporary.write_text(helper['systemd_override'](argv))
    temporary.chmod(0o600)
    temporary.replace(target)
    try:
        subprocess.run(['systemctl', 'daemon-reload'], check=True)
        if command() != argv:
            raise RuntimeError('Een andere service-instelling overschrijft deze uitgang.')
        subprocess.run(['systemctl', 'restart', 'tunebox-player.service'], check=True)
    except Exception:
        if previous is None:
            target.unlink()
        else:
            target.write_bytes(previous)
            target.chmod(0o600)
        subprocess.run(['systemctl', 'daemon-reload'], check=True)
        subprocess.run(['systemctl', 'restart', 'tunebox-player.service'], check=False)
        raise
    print('Uitgang: plughw:CARD=LouderRaspberry,DEV=0 · PCM-export aan')
