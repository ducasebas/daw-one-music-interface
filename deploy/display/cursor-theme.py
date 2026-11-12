#!/usr/bin/env python3
"""Create an original transparent Xcursor theme for the production kiosk."""
from pathlib import Path
import argparse
import struct

def create_theme(root):
    root=Path(root); cursors=root/'cursors'; cursors.mkdir(parents=True,exist_ok=True)
    image=struct.pack('<IIII',0x72756358,16,0x10000,1)+struct.pack('<III',0xfffd0002,24,28)+struct.pack('<IIIIIIIII',36,0xfffd0002,24,1,1,1,0,0,0)+struct.pack('<I',0)
    names='left_ptr default arrow top_left_arrow pointer hand hand1 hand2 text xterm cross crosshair watch wait progress help not-allowed forbidden move grab grabbing ew-resize ns-resize nesw-resize nwse-resize size_all size_hor size_ver size_bdiag size_fdiag cell vertical-text copy alias context-menu'.split()
    for name in names: (cursors/name).write_bytes(image)
    (root/'index.theme').write_text('[Icon Theme]\nName=TuneBox invisible\nComment=Transparent cursor for the physical kiosk\n')
    for p in root.rglob('*'): p.chmod(0o755 if p.is_dir() else 0o644)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',default='/usr/local/share/icons/tunebox-invisible');args=parser.parse_args();create_theme(args.output)
