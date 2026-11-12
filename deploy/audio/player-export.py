#!/usr/bin/env python3
"""Preserve systemd's original argv; Squeezelite tokenises its /proc argv in place."""
import json,os,re,subprocess,sys
from pathlib import Path

UNIT_PATH='/org/freedesktop/systemd1/unit/tunebox_2dplayer_2eservice'

def systemd_command(payload):
    if payload.get('type')!='a(sasasttttuii)':raise ValueError('Unsupported systemd ExecStartEx format')
    data=payload.get('data')
    # busctl represents the single array value with an outer message-data list.
    # Accept the direct value too, for versions that omit that wrapper.
    def command(v):return isinstance(v,list) and len(v)==10 and isinstance(v[0],str) and isinstance(v[1],list)
    if isinstance(data,list) and len(data)==1 and command(data[0]):commands=data
    elif isinstance(data,list) and len(data)==1 and isinstance(data[0],list):commands=data[0]
    else:raise ValueError('Expected one systemd player command')
    if len(commands)!=1 or not command(commands[0]):raise ValueError('Expected one direct systemd player command')
    entry=commands[0];binary,argv,flags=entry[:3]
    if not argv or not all(isinstance(a,str) and not any(ord(c)<32 or ord(c)==127 for c in a) for a in argv):raise ValueError('Invalid player arguments')
    if not isinstance(flags,list) or any(f not in ('no-env-expand',) for f in flags):raise ValueError('Unsupported ExecStart prefix; add -v to the reviewed player unit manually')
    if 'no-env-expand' not in flags and any('${' in a or re.fullmatch(r'\$[A-Za-z_][A-Za-z0-9_]*',a) for a in argv):raise ValueError('Player arguments use environment expansion; add -v to the reviewed unit manually')
    if not os.path.isabs(binary) or Path(binary).name!='squeezelite':raise ValueError('Expected a direct Squeezelite service')
    return binary,list(argv),flags,entry[7]

def running_arguments(pid,proc_root=Path('/proc'),query=subprocess.check_output):
    pid=str(pid)
    if not pid.isdecimal() or int(pid)<=1:raise ValueError('Start tunebox-player.service before configuring the visualizer')
    process=proc_root/pid
    binary=os.path.realpath(process/'exe')
    if Path(binary).name!='squeezelite':raise ValueError('Service MainPID is not Squeezelite')
    payload=json.loads(query(['busctl','--json=short','get-property','org.freedesktop.systemd1',UNIT_PATH,'org.freedesktop.systemd1.Service','ExecStartEx'],text=True,timeout=5))
    configured,argv,_flags,recorded_pid=systemd_command(payload)
    if os.path.realpath(configured)!=binary or recorded_pid not in (0,int(pid)):raise ValueError('Player unit and running process differ; review and restart the player first')
    original=b'\0'.join(a.encode('utf8') for a in argv)+b'\0'
    running=(process/'cmdline').read_bytes()
    # strtok/next_param replace separators with NUL, retaining the byte positions.
    # Compare that permitted mutation rather than reconstructing arguments by guess.
    separators=b':=,-'
    if len(original)!=len(running) or any(a!=b and not (b==0 and a in separators) for a,b in zip(original,running)):
        raise ValueError('Running player arguments differ from systemd; review and restart the player first')
    argv[0]=binary
    return argv

def existing_player_id(argv):
    if argv.count('-m')!=1:raise ValueError('The service must already have one explicit -m player MAC; identity is never guessed or changed')
    try:mac=argv[argv.index('-m')+1]
    except IndexError:raise ValueError('The existing -m player MAC is missing')
    if not re.fullmatch(r'[0-9a-fA-F]{2}(?::[0-9a-fA-F]{2}){5}',mac):raise ValueError('The configured -m value is not a complete player MAC')
    return mac.lower()

def export_arguments(argv,player_id):
    if not re.fullmatch(r'[0-9a-fA-F]{2}(?::[0-9a-fA-F]{2}){5}',player_id):raise ValueError('Use the existing player MAC')
    if not argv or not os.path.isabs(argv[0]) or Path(argv[0]).name!='squeezelite':raise ValueError('Expected a direct Squeezelite service')
    if any(a.startswith('-D') or (a.startswith('-') and not a.startswith('--') and 'D' in a[1:]) for a in argv[1:]):raise ValueError('DSD/DoP output is not supported by the PCM visualizer')
    if existing_player_id(argv)!=player_id.lower():raise ValueError('Requested player ID differs from the running service')
    return argv if '-v' in argv else argv+['-v']

def systemd_override(argv):
    def quote(value):
        if any(ord(c)<32 or ord(c)==127 for c in value):raise ValueError('Control character in player argument')
        return '"'+value.replace('\\','\\\\').replace('"','\\"').replace('%','%%')+'"'
    # ':' disables systemd environment expansion; %% prevents specifier expansion.
    return '[Service]\nExecStart=\nExecStart=:'+ ' '.join(quote(a) for a in argv)+'\n'

if __name__=='__main__':
    try:
        if len(sys.argv)<3:raise ValueError('Invalid invocation')
        action,pid=sys.argv[1:3]
        if action not in ('detect','check','write'):raise ValueError('Invalid invocation')
        argv=running_arguments(pid);binary=argv[0]
        if action=='detect':
            print(existing_player_id(argv));sys.exit(0)
        if len(sys.argv)!=4:raise ValueError('Specify the existing player MAC')
        player_id=sys.argv[3];updated=export_arguments(argv,player_id)
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
