#!/usr/bin/env python3
"""Hide boot text while retaining the virtual/serial console and root options."""
from pathlib import Path
from datetime import datetime
import re
import shutil
import os
import tempfile

def quiet_cmdline(text):
    tokens=text.split()
    prefixes=('loglevel=','systemd.show_status=','rd.systemd.show_status=','vt.global_cursor_default=')
    tokens=[t for t in tokens if not t.startswith(prefixes) and t not in ('quiet','logo.nologo')]
    # Hiding messages must not remove the virtual console used by the kiosk seat.
    if not any(re.fullmatch(r'console=tty\d+(?:,.*)?',t) for t in tokens):
        tokens.append('console=tty1')
    return ' '.join(tokens+['quiet','loglevel=0','systemd.show_status=false','rd.systemd.show_status=false','vt.global_cursor_default=0','logo.nologo'])+'\n'

def replace_if_changed(path, text, stamp):
    """Leave unchanged FAT boot files alone; replace changed files after syncing."""
    if path.read_text()==text:return False
    shutil.copy2(path,str(path)+'.tunebox-backup-'+stamp)
    fd,name=tempfile.mkstemp(prefix='.'+path.name+'-',dir=path.parent)
    try:
        with os.fdopen(fd,'w') as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
        os.chmod(name,path.stat().st_mode&0o777)
        os.replace(name,path)
        directory=os.open(path.parent,os.O_RDONLY)
        try:os.fsync(directory)
        finally:os.close(directory)
    finally:
        if os.path.exists(name):os.unlink(name)
    return True

if __name__=='__main__':
    boot=Path('/boot/firmware');stamp=datetime.now().strftime('%Y%m%d-%H%M%S')
    cmd=boot/'cmdline.txt';config=boot/'config.txt'
    if not cmd.is_file() or not config.is_file():raise SystemExit('Raspberry Pi boot configuration not found')
    changed=replace_if_changed(cmd,quiet_cmdline(cmd.read_text()),stamp)
    text=config.read_text()
    if '# TuneBox quiet boot' not in text:
        changed=replace_if_changed(config,text.rstrip()+'\n\n[all]\n# TuneBox quiet boot; serial console and SSH remain available\ndisable_splash=1\n',stamp) or changed
    print('Quiet boot configured. Changed files were backed up; takes effect after reboot.' if changed else 'Quiet boot is already configured; boot files were left unchanged.')
