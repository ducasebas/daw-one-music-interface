#!/usr/bin/env python3
"""Create an original transparent Xcursor theme for the production kiosk."""
from pathlib import Path
import argparse
import struct

def create_theme(root):
    root=Path(root); cursors=root/'cursors'; cursors.mkdir(parents=True,exist_ok=True)
    # A normal-sized fully transparent image works for software and DRM cursors.
    size=24
    image=struct.pack('<IIII',0x72756358,16,0x10000,1)+struct.pack('<III',0xfffd0002,size,28)+struct.pack('<IIIIIIIII',36,0xfffd0002,size,1,size,size,0,0,0)+bytes(size*size*4)
    names='left_ptr default arrow top_left_arrow pointer hand hand1 hand2 text xterm cross crosshair watch wait progress left_ptr_watch help question_arrow not-allowed forbidden no-drop crossed_circle move fleur grab grabbing closedhand openhand all-scroll ew-resize ns-resize nesw-resize nwse-resize n-resize s-resize e-resize w-resize ne-resize nw-resize se-resize sw-resize col-resize row-resize size_all size_hor size_ver size_bdiag size_fdiag top_side bottom_side left_side right_side top_left_corner top_right_corner bottom_left_corner bottom_right_corner cell vertical-text copy alias link context-menu zoom-in zoom-out up_arrow sb_h_double_arrow sb_v_double_arrow dnd-copy dnd-move dnd-link dnd-none blank none invisible'.split()
    for name in names: (cursors/name).write_bytes(image)
    (root/'index.theme').write_text('[Icon Theme]\nName=TuneBox invisible\nComment=Transparent cursor for the physical kiosk\n')
    # OTA has UMask=0077. Include the theme root itself: rglob excludes it.
    root.chmod(0o755)
    for p in root.rglob('*'): p.chmod(0o755 if p.is_dir() else 0o644)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',default='/usr/local/share/icons/tunebox-invisible');args=parser.parse_args();create_theme(args.output)
