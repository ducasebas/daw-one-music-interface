#!/usr/bin/env python3
"""Validate the complete tar inventory before extracting any member."""
import sys, tarfile
from pathlib import PurePosixPath
ROOTS={'dist','server','shared','deploy','docs','package.json','package-lock.json','LICENSE','THIRD_PARTY_NOTICES.md','release-manifest.json'}
def validate(members):
    seen=set();total=0
    for i,m in enumerate(members):
        path=PurePosixPath(m.name)
        if i>=4000 or len(m.name)>300 or path.is_absolute() or '..' in path.parts or '\\' in m.name or not path.parts or path.parts[0] not in ROOTS or not (m.isfile() or m.isdir()) or str(path) in seen or m.size<0:
            raise ValueError('Unsafe OTA archive entry')
        seen.add(str(path));total+=m.size
        if total>134217728:raise ValueError('Expanded archive too large')
    if 'release-manifest.json' not in seen:raise ValueError('Missing manifest')
if __name__=='__main__':
    with tarfile.open(sys.argv[1],'r:gz') as archive:
        members=[]
        for member in archive:
            if len(members)>=4000:raise ValueError('Too many archive entries')
            members.append(member)
        validate(members)
        for m in members:
            m.uid=m.gid=0;m.uname=m.gname='';m.mode=0o755 if m.isdir() else 0o644
            archive.extract(m,sys.argv[2],set_attrs=True,filter='data')
