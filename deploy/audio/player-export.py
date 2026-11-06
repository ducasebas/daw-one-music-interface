#!/usr/bin/env python3
"""Preserve the running player's exact argv; add only upstream visualizer export."""
import os,re,subprocess,sys
from pathlib import Path

def export_arguments(argv,player_id):
    if not re.fullmatch(r'[0-9a-fA-F]{2}(?::[0-9a-fA-F]{2}){5}',player_id):raise ValueError('Use the existing player MAC')
    if not argv or not os.path.isabs(argv[0]) or Path(argv[0]).name!='squeezelite':raise ValueError('Expected a direct Squeezelite service')
    if any(a.startswith('-D') or (a.startswith('-') and not a.startswith('--') and 'D' in a[1:]) for a in argv[1:]):raise ValueError('DSD/DoP output is not supported by the PCM visualizer')
    try:mac=argv[argv.index('-m')+1]
    except (ValueError,IndexError):raise ValueError('The service must already have an explicit -m player MAC; identity is never guessed or changed')
    if mac.lower()!=player_id.lower():raise ValueError('Requested player ID differs from the running service')
    return argv if '-v' in argv else argv+['-v']

def systemd_override(argv):
    def quote(value):
        if any(ord(c)<32 or ord(c)==127 for c in value):raise ValueError('Control character in player argument')
        return '"'+value.replace('\\','\\\\').replace('"','\\"').replace('%','%%')+'"'
    # ':' disables systemd environment expansion; %% prevents specifier expansion.
    return '[Service]\nExecStart=\nExecStart=:'+ ' '.join(quote(a) for a in argv)+'\n'

if __name__=='__main__':
    try:
        action,pid,player_id=sys.argv[1:4]
        if action not in ('check','write') or not pid.isdecimal() or int(pid)<=1:raise ValueError('Invalid invocation')
        argv=Path('/proc/'+pid+'/cmdline').read_bytes().rstrip(b'\0').decode('utf8').split('\0')
        binary=os.path.realpath('/proc/'+pid+'/exe')
        if Path(binary).name!='squeezelite':raise ValueError('Service MainPID is not Squeezelite')
        argv[0]=binary;updated=export_arguments(argv,player_id)
        help_result=subprocess.run([binary,'-?'],capture_output=True,text=True,timeout=5)
        help_text=help_result.stdout+help_result.stderr
        if not re.search(r'(?m)^\s+-v\s+.*[Vv]isualizer',help_text):raise ValueError('This Squeezelite build has no -v visualizer support; install a VISEXPORT-enabled build first')
        if action=='write' and updated!=argv:
            target=Path('/etc/systemd/system/tunebox-player.service.d/90-tunebox-analysis.conf')
            target.parent.mkdir(parents=True,exist_ok=True)
            target.write_text(systemd_override(updated));target.chmod(0o600)
        print('Export already enabled' if updated==argv else 'Export supported; only -v is added')
    except Exception as error:
        print(str(error),file=sys.stderr);sys.exit(1)
