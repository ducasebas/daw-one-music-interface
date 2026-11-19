#!/usr/bin/env python3
"""One offered fixed-20V HUSB238 PDO request; telemetry stays read-only.

Hynetek HUSB238 Rev. 2.0, p9: I2C-selected source PDO overrides VSET/ISET.
Register Information Rev. 1.1: Get_SRC_Cap=0x04; SRC_PDO=0xA0, request=0x01.
Only an already active 20V rail is supported. No other PDOs, resets or retry loop.
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
REQUEST_AMPS = (3, 3.25, 3.5, 4, 4.5, 5)


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
        if (register, value) not in ((0x08, 0xa0), (0x09, 0x01), (0x09, 0x04)):
            raise ValueError('Unsupported PD operation')
        fcntl.ioctl(self.fd, 0x0703, 0x08)  # Respect kernel ownership; never FORCE.
        data = (ctypes.c_ubyte * 2)(register, value)
        messages = (I2CMessage * 1)(I2CMessage(0x08, 0, 2, ctypes.addressof(data)))
        if fcntl.ioctl(self.fd, 0x0707, I2CTransfer(messages, 1)) != 1:
            raise OSError('Incomplete PD register write')

    def request_20v(self):
        self._fixed_write(0x08, 0xa0)
        self._fixed_write(0x09, 0x01)

    def query_source(self):
        self._fixed_write(0x09, 0x04)


def is_contract(value, amps):
    return value.get('status') == 'active' and value.get('volts') == 20 and value.get('amps') == amps


def check_source(value, amps=5):
    if type(amps) not in (int, float) or amps not in REQUEST_AMPS:
        raise ValueError('Unsupported 20 V power profile')
    if value.get('status') != 'active' or value.get('volts') != 20:
        raise ValueError('The supply must already have an active 20 V contract')
    if not any(p.get('volts') == 20 and p.get('amps') == amps for p in value.get('profiles', [])):
        raise ValueError('The connected supply and cable do not offer a 20 V / 5 A profile' if amps == 5 else
                         'The selected 20 V power profile is no longer offered; reopen power setup')


def offered_20v(value):
    if value.get('status') != 'active' or value.get('volts') != 20:
        raise ValueError('The supply must already have an active 20 V contract')
    profiles = [p for p in value.get('profiles', []) if p.get('volts') == 20]
    if (len(profiles) != 1 or type(profiles[0].get('amps')) not in (int, float)
            or profiles[0]['amps'] not in REQUEST_AMPS):
        raise ValueError('No supported 20 V profile of at least 60 W is offered')
    amps = profiles[0]['amps']
    return dict(volts=20, amps=amps, watts=20*amps)


def refresh_source(read, send_query, before_query=lambda: None,
                   clock=time.monotonic, wait=time.sleep):
    """One Get_SRC_Cap, then bounded stable register readback, never a PDO request.

    The chip does not expose a response generation counter. A stable success
    code is useful readback, but cannot prove that an unchanged offer was stale.
    """
    value = read_husb238(read)
    if value.get('status') != 'active' or value.get('volts') != 20:
        raise ValueError('The supply must already have an active 20 V contract')
    before_query()  # An interrupted query must not be repeated at every boot.
    send_query()
    deadline, previous = clock()+4, None
    wait(.2)
    while clock() < deadline:
        value = read_husb238(read)
        if value.get('responseCode') in (3, 4, 5):
            raise ValueError('The PD controller rejected the source-capability query')
        if value.get('status') == 'changing':
            previous = None
        elif value.get('status') != 'active' or value.get('volts') != 20:
            raise ValueError('The 20 V rail changed during source discovery; no power request was sent')
        elif value.get('responseCode') == 1:
            offered_20v(value)
            if previous == value:
                return value
            previous = value
        else:
            previous = None
        wait(.1)
    raise ValueError('Source capabilities were not confirmed; no power request was sent')


def negotiate(read, send, before_request=lambda: None, clock=time.monotonic, wait=time.sleep, target_amps=5):
    value = read_husb238(read)
    check_source(value, target_amps)
    existing = is_contract(value, target_amps)
    if not existing:
        before_request()  # Durable intent BEFORE a possible power interruption.
        check_source(read_husb238(read), target_amps)
        send()  # Exactly one PDO selection and one GO request, never a retry loop.
    deadline, stable = clock()+4, 0
    while clock() < deadline:
        value = read_husb238(read)
        if value.get('responseCode') in (3, 4, 5):
            raise ValueError('The PD controller rejected or could not complete the request')
        if value.get('status') in ('changing', 'attached', 'detached'):
            stable = 0
        else:
            check_source(value, target_amps)
            stable = stable+1 if is_contract(value, target_amps) and (existing or value.get('responseCode') == 1) else 0
            if stable >= 2:
                return dict(volts=20, amps=target_amps, watts=20*target_amps, requested=not existing)
        wait(.1)
    raise ValueError('A 20 V / 5 A contract was not confirmed; no further request was sent' if target_amps == 5 else
                     'The selected 20 V power contract was not confirmed; no further request was sent')


def profile_qualified(value):
    return (isinstance(value, dict) and value.get('status') == 'ready' and value.get('qualified') is True
            and type(value.get('cable5AVerified')) is bool and value.get('phase') == 'ready'
            and value.get('source') == 'HUSB238'
            and value.get('volts') == 20 and type(value.get('amps')) in (int, float)
            and value.get('amps') in REQUEST_AMPS and value.get('watts') == 20*value['amps']
            and (value['amps'] == 3 or value['cable5AVerified']))


def qualified(value):
    """Legacy 100W clients must never treat a 60W result as 100W proof."""
    return profile_qualified(value) and value['amps'] == 5


def maximum_qualified(value):
    return (profile_qualified(value) and value.get('strategy') == 'maximum20v'
            and value.get('sourceCapabilitiesQueried') is True)


def run(mode, configuration, state_dir=STATE_DIR, runtime=RUNTIME, open_bus=RequestBus,
        now=lambda: int(time.time()*1000), boot_id=None,
        uptime_ms=lambda: int(time.monotonic()*1000)):
    if mode not in ('manual', 'startup'):
        raise ValueError('Unsupported PD mode')
    boot_id = boot_id or Path('/proc/sys/kernel/random/boot_id').read_text().strip()
    request_id, bus, lock = None, None, None
    target_amps, cable_verified, strategy, discovery = 5, True, 'exact', False
    owns_lock, authorized = False, False
    output = runtime / ('result.json' if mode == 'manual' else 'startup.json')
    state_path = state_dir/'qualification.json'
    if mode == 'startup' and not any(configuration.get(k, False) for k in ('startup100W', 'startup20V', 'startupMaximum20V')):
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
            discovery = request.get('operation') == 'discover'
            target_amps = request.get('amps', 5)
            cable_verified = request.get('cable5AVerified')
            strategy = request.get('strategy', 'exact')
            keys = {'id', 'confirmed', 'cable5AVerified', 'expiresAt'}
            valid_id = (isinstance(request_id, str) and re.fullmatch('[a-f0-9]{32}', request_id)
                        and type(request.get('expiresAt')) is int and 0 < request['expiresAt']-now() <= 30000)
            valid_operation = discovery and set(request) == {'id', 'expiresAt', 'operation'}
            # Keep request validation explicit: query jobs carry no cable/profile
            # authority, and maximum requests still need a confirmed exact offer.
            if not discovery:
                valid_operation = (set(request) in (keys, keys | {'amps'}, keys | {'amps', 'strategy'})
                    and request.get('confirmed') is True and type(cable_verified) is bool
                    and type(target_amps) in (int, float) and target_amps in REQUEST_AMPS
                    and (target_amps == 3 or cable_verified) and strategy in ('exact', 'maximum20v'))
            if not valid_id or not valid_operation:
                raise ValueError('Confirm the selected power profile and a suitable USB-C cable on this device first')
            (runtime/'request.json').unlink()  # Consume one bounded confirmation.
            authorized = True
        elif not (qualified(previous) if configuration['startup100W'] else maximum_qualified(previous)
                  if configuration.get('startupMaximum20V', False) else profile_qualified(previous)):
            reason = ('The previous PD request was interrupted; run power setup manually'
                      if previous.get('phase') in ('requesting', 'querying') else
                      'Automatic PD setup is blocked; complete power setup manually')
            raise ValueError(reason)
        else:
            authorized = True
            target_amps, cable_verified = previous['amps'], previous['cable5AVerified']
            strategy = 'maximum20v' if configuration.get('startupMaximum20V', False) else 'exact'

        def query_intent():
            atomic_json(state_path, dict(phase='querying', qualified=False, bootId=boot_id, observedAt=now()))

        def intent():
            atomic_json(state_path, dict(phase='requesting', qualified=False,
                        cable5AVerified=cable_verified, volts=20, amps=target_amps,
                        bootId=boot_id, observedAt=now()))

        bus = open_bus()
        source = refresh_source(bus.read, bus.query_source, before_query=query_intent)
        offer = offered_20v(source)
        if discovery:
            # Discovery is not qualification. Preserve prior proof only if the
            # active contract is still exactly the previously verified contract.
            if profile_qualified(previous) and is_contract(source, previous['amps']):
                atomic_json(state_path, previous)
            else:
                atomic_json(state_path, dict(phase='unqualified', qualified=False, observedAt=now()))
            atomic_json(output, dict(status='discovered', sourceCapabilitiesQueried=True,
                        bootId=boot_id, observedAt=now(), requestId=request_id, pd=source, profile=offer))
            return True
        if strategy == 'maximum20v':
            if mode == 'manual' and offer['amps'] != target_amps:
                raise ValueError('The offered profile changed. Reopen power setup and confirm the new profile')
            target_amps = offer['amps']
            if target_amps > 3 and not cable_verified:
                raise ValueError('A 5 A e-marked cable must be confirmed before requesting more than 60 W')
        result = negotiate(bus.read, bus.request_20v, before_request=intent, target_amps=target_amps)
        bus.close()
        bus = None
        value = dict(status='ready', phase='ready', source='HUSB238', qualified=True,
                     cable5AVerified=cable_verified, bootId=boot_id, observedAt=now(),
                     observedMonotonicMs=uptime_ms(), requestId=request_id, strategy=strategy,
                     sourceCapabilitiesQueried=True, **result)
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
