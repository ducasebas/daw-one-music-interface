"""Keep the kiosk alive while its backend restarts; retain other dependencies."""
from pathlib import Path
from datetime import datetime
import os
import shutil
import tempfile

def independent_kiosk(text):
    lines, section, changed = [], '', False
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith('[') and stripped.endswith(']'):
            section = stripped
        if section == '[Unit]' and stripped.startswith('Requires='):
            units = stripped.split('=', 1)[1].split()
            if 'daw-one.service' in units:
                units = [unit for unit in units if unit != 'daw-one.service']
                changed = True
                if units:
                    lines.append('Requires=' + ' '.join(units))
                continue
        lines.append(line)
    if not changed:
        return text
    return '\n'.join(lines).rstrip() + '\n\n[Unit]\n# Keep the independent OTA progress screen alive during backend restart.\nWants=daw-one.service\n'

if __name__ == '__main__':
    if os.geteuid() != 0:
        raise SystemExit('Run with sudo')
    path = Path('/etc/systemd/system/daw-one-kiosk.service')
    if not path.is_file():
        raise SystemExit('TuneBox kiosk unit not installed')
    original = path.read_text()
    updated = independent_kiosk(original)
    if updated != original:
        backup = str(path) + '.before-ota-' + datetime.now().strftime('%Y%m%d-%H%M%S')
        shutil.copy2(path, backup)
        with tempfile.NamedTemporaryFile('w', dir=path.parent, delete=False) as file:
            file.write(updated)
            temporary = file.name
        os.chmod(temporary, 0o644)
        os.replace(temporary, path)
        print('Kiosk dependency updated; backup:', backup)
    else:
        print('Kiosk unit already independent of backend stops')
