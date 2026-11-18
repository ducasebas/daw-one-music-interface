#!/usr/bin/env python3
"""One fixed HUSB238 20V/5A request; the telemetry reader stays read-only.

Hynetek HUSB238 Rev. 2.0, p9: I2C-selected source PDO overrides VSET/ISET.
Register Information Rev. 1.1: SRC_PDO=0xA0, GO_COMMAND=0x01.
No voltage changes, resets, generic writes or automatic retry loop.
"""
import ctypes
import fcntl
import json
import os
from pathlib import Path
import re
import stat
import sys
import time
import uuid
from read import Bus, I2CMessage, I2CTransfer, load_settings, read_husb238

CONFIG = Path('/etc/daw-one-power/settings.json')
STATE_DIR = Path('/var/lib/daw-one-power')
RUNTIME = Path('/run/daw-one-pd')


def read_json(path, fallback=None):
    fd = None
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_size > 8192:
            return fallback
        data = os.read(fd, 8193)
        value = json.loads(data) if len(data) <= 8192 else fallback
        return value if isinstance(value, dict) else fallback
    except (OSError, ValueError):
        return fallback
    finally:
        if fd is not None:
            os.close(fd)


def atomic_json(path, value):
    temporary = path.with_name(path.name+'.'+uuid.uuid4().hex+'.tmp')
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o644)
    try:
        os.fchmod(fd, 0o644)
        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
            json.dump(value, stream, allow_nan=False)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        parent = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(parent)
        finally:
            os.close(parent)
    finally:
        if temporary.exists():
            temporary.unlink()


class RequestBus(Bus):
    def _fixed_write(self, register, value):
        if (register, value) not in ((0x08, 0xa0), (0x09, 0x01)):
            raise ValueError('Unsupported PD operation')
        fcntl.ioctl(self.fd, 0x0703, 0x08)  # Respect kernel ownership; never FORCE.
        data = (ctypes.c_ubyte * 2)(register, value)
        messages = (I2CMessage * 1)(I2CMessage(0x08, 0, 2, ctypes.addressof(data)))
        if fcntl.ioctl(self.fd, 0x0707, I2CTransfer(messages, 1)) != 1:
            raise OSError('Incomplete PD register write')

    def request_20v(self):
        self._fixed_write(0x08, 0xa0)
        self._fixed_write(0x09, 0x01)


def is_100w(value):
    return value.get('status') == 'active' and value.get('volts') == 20 and value.get('amps') == 5


def check_source(value):
    if value.get('status') != 'active' or value.get('volts') != 20:
        raise ValueError('The supply must already have an active 20 V contract')
    if not any(p.get('volts') == 20 and p.get('amps') == 5 for p in value.get('profiles', [])):
        raise ValueError('The connected supply and cable do not offer a 20 V / 5 A profile')


def negotiate(read, send, before_request=lambda: None, clock=time.monotonic, wait=time.sleep):
    value = read_husb238(read)
    check_source(value)
    if is_100w(value):
        return dict(volts=20, amps=5, watts=100, requested=False)
    before_request()  # Durable intent BEFORE a possible power interruption.
    check_source(read_husb238(read))
    send()  # Exactly one PDO selection and one GO request, never a retry loop.
    deadline, stable = clock()+4, 0
    while clock() < deadline:
        value = read_husb238(read)
        if value.get('responseCode') in (3, 4, 5):
            raise ValueError('The PD controller rejected or could not complete the request')
        if value.get('status') in ('changing', 'attached', 'detached'):
            stable = 0
        else:
            check_source(value)
            stable = stable+1 if is_100w(value) and value.get('responseCode') == 1 else 0
            if stable >= 2:
                return dict(volts=20, amps=5, watts=100, requested=True)
        wait(.1)
    raise ValueError('A 20 V / 5 A contract was not confirmed; no further request was sent')


def qualified(value):
    return (isinstance(value, dict) and value.get('qualified') is True
            and value.get('cable5AVerified') is True and value.get('phase') == 'ready'
            and value.get('source') == 'HUSB238'
            and value.get('volts') == 20 and value.get('amps') == 5)


def run(mode, configuration, state_dir=STATE_DIR, runtime=RUNTIME, open_bus=RequestBus,
        now=lambda: int(time.time()*1000), boot_id=None,
        uptime_ms=lambda: int(time.monotonic()*1000)):
    if mode not in ('manual', 'startup'):
        raise ValueError('Unsupported PD mode')
    boot_id = boot_id or Path('/proc/sys/kernel/random/boot_id').read_text().strip()
    request_id, bus, lock = None, None, None
    owns_lock, authorized = False, False
    output = runtime / ('result.json' if mode == 'manual' else 'startup.json')
    state_path = state_dir/'qualification.json'
    if mode == 'startup' and not configuration['startup100W']:
        atomic_json(output, dict(status='not-requested', observedAt=now()))
        return True
    try:
        lock = os.open(state_dir/'request.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        owns_lock = True
        previous = read_json(state_path, {})
        if mode == 'manual':
            request = read_json(runtime/'request.json', {})
            request_id = request.get('id')
            if (set(request) != {'id', 'confirmed', 'cable5AVerified', 'expiresAt'}
                    or not isinstance(request_id, str) or not re.fullmatch('[a-f0-9]{32}', request_id)
                    or request.get('confirmed') is not True or request.get('cable5AVerified') is not True
                    or type(request.get('expiresAt')) is not int or not 0 < request['expiresAt']-now() <= 30000):
                raise ValueError('Confirm the 100 W supply and 5 A cable on this device first')
            (runtime/'request.json').unlink()  # Consume one bounded confirmation.
            authorized = True
        elif not qualified(previous):
            reason = ('The previous PD request was interrupted; run the 100 W setup manually'
                      if previous.get('phase') == 'requesting' else
                      'Automatic PD setup is blocked; complete the 100 W setup manually')
            raise ValueError(reason)
        else:
            authorized = True

        def intent():
            atomic_json(state_path, dict(phase='requesting', qualified=False,
                        cable5AVerified=True, bootId=boot_id, observedAt=now()))

        bus = open_bus()
        result = negotiate(bus.read, bus.request_20v, before_request=intent)
        bus.close()
        bus = None
        value = dict(status='ready', phase='ready', source='HUSB238', qualified=True,
                     cable5AVerified=True, bootId=boot_id, observedAt=now(),
                     observedMonotonicMs=uptime_ms(), requestId=request_id, **result)
        atomic_json(state_path, value)
        atomic_json(output, value)
        if mode == 'manual':
            atomic_json(runtime/'startup.json', value)
        return True
    except (OSError, ValueError) as error:
        value = dict(status='error', phase='failed', qualified=False, bootId=boot_id,
                     observedAt=now(), requestId=request_id, error=str(error)[:240])
        # Preserve evidence of interruption/failure; startup cannot silently retry.
        if owns_lock and authorized:
            atomic_json(state_path, value)
        atomic_json(output, value)
        return False
    finally:
        if bus is not None:
            try:
                bus.close()
            except OSError:
                pass
        if lock is not None:
            os.close(lock)


if __name__ == '__main__':
    if sys.argv[1:] not in (['--manual'], ['--startup']):
        raise SystemExit('Use --manual or --startup')
    raise SystemExit(0 if run(sys.argv[1][2:], load_settings(CONFIG)) else 1)
