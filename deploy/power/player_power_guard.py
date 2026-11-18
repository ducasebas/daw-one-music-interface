#!/usr/bin/env python3
"""When opted in, local player startup waits for a verified PD result from this boot."""
import sys
import time
from pathlib import Path
from read import load_settings
from pd_request import read_json, qualified


def allowed(configuration, result, proof=None, uptime_ms=None, boot_id=None):
    if not configuration['startup100W']:
        return True
    uptime_ms = int(time.monotonic()*1000) if uptime_ms is None else uptime_ms
    boot_id = boot_id or Path('/proc/sys/kernel/random/boot_id').read_text().strip()
    return (qualified(result) and qualified(proof) and result == proof
            and result.get('bootId') == boot_id
            and type(result.get('observedMonotonicMs')) is int
            and 0 <= result['observedMonotonicMs'] <= uptime_ms)


if __name__ == '__main__':
    try:
        ok = allowed(load_settings(), read_json(Path('/run/daw-one-pd/startup.json'), {}),
                     read_json(Path('/var/lib/daw-one-power/qualification.json'), {}))
    except (OSError, ValueError):
        ok = False
    if not ok:
        print('100 W PD setup is not ready. Open Sensors on TuneBox to repair or disable automatic PD setup.', file=sys.stderr)
    raise SystemExit(0 if ok else 1)
