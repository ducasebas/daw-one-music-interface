#!/usr/bin/env python3
"""Hide boot-console output; preserve serial console, root and network options."""
from pathlib import Path
from datetime import datetime
import re
import shutil

def quiet_cmdline(text):
    tokens=text.split()
    prefixes=('loglevel=','systemd.show_status=','rd.systemd.show_status=','vt.global_cursor_default=')
    tokens=[t for t in tokens if not re.fullmatch(r'console=tty\d+(?:,.*)?',t) and not t.startswith(prefixes) and t not in ('quiet','logo.nologo')]
    return ' '.join(tokens+['quiet','loglevel=0','systemd.show_status=false','rd.systemd.show_status=false','vt.global_cursor_default=0','logo.nologo'])+'\n'

if __name__=='__main__':
    boot=Path('/boot/firmware');stamp=datetime.now().strftime('%Y%m%d-%H%M%S')
    cmd=boot/'cmdline.txt';config=boot/'config.txt'
    if not cmd.is_file() or not config.is_file():raise SystemExit('Raspberry Pi boot configuration not found')
    shutil.copy2(cmd,str(cmd)+'.tunebox-backup-'+stamp)
    shutil.copy2(config,str(config)+'.tunebox-backup-'+stamp)
    cmd.write_text(quiet_cmdline(cmd.read_text()))
    text=config.read_text()
    if '# TuneBox quiet boot' not in text:
        config.write_text(text.rstrip()+'\n\n[all]\n# TuneBox quiet boot; serial console and SSH remain available\ndisable_splash=1\n')
    print('Quiet boot configured. Boot-file backups created; takes effect after reboot.')
