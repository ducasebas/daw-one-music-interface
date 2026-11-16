"""Only phones explicitly confirmed by this appliance may feed its A2DP output."""
import json
import os
from pathlib import Path
import re
STORE = Path('/var/lib/daw-one-bluetooth/approved.json')
def addresses(value):
    return sorted(set(v for v in value if isinstance(v, str) and re.fullmatch(r'(?:[A-F0-9]{2}:){5}[A-F0-9]{2}', v) and v not in ('00:00:00:00:00:00','FF:FF:FF:FF:FF:FF')))[:16] if isinstance(value,list) else []
def load():
    try:
        raw=STORE.read_text()
        return addresses(json.loads(raw)) if len(raw)<4096 else []
    except (OSError,ValueError):return []
def save(value):
    path=STORE.with_suffix('.tmp')
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
    with os.fdopen(fd,'w') as output:json.dump(addresses(value),output)
    path.replace(STORE)
