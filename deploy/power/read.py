#!/usr/bin/env python3
"""INA228 and HUSB238 telemetry. Register reads only; no PD/config writes.

INA228 conversion factors: TI SLYS021A, sections 7.6.5/7.6.6/7.6.7.
HUSB238 register layout: manufacturer Register Information Rev. 1.1.
"""
import ctypes
import fcntl
import json
import math
import os
from pathlib import Path
import time

CONFIG = Path('/etc/daw-one-power/settings.json')
OUTPUT = Path('/run/daw-one-power/readings.json')
DEFAULTS = dict(ina228=False, husb238=False, currentPathVerified=False,
                voltageSenseVerified=False)
SHUNT_OHMS = 0.015  # Unmodified Adafruit 5832 R015 shunt; nominal, not lab calibration.
VOLTAGES = (5, 9, 12, 15, 18, 20)
CURRENTS = (0.5, 0.7, 1, 1.25, 1.5, 1.75, 2, 2.25,
            2.5, 2.75, 3, 3.25, 3.5, 4, 4.5, 5)
PDO_SELECTION = {1: 5, 2: 9, 3: 12, 8: 15, 9: 18, 10: 20}


def settings(value):
    if not isinstance(value, dict) or set(value)-set(DEFAULTS):
        raise ValueError('Invalid configuration')
    result = {**DEFAULTS, **value}
    if any(type(v) is not bool for v in result.values()):
        raise ValueError('Invalid configuration')
    return result


def load_settings(path=CONFIG):
    try:
        with open(path, encoding='utf-8') as stream:
            text = stream.read(4097)
        if len(text) > 4096:
            raise ValueError('Configuration too large')
        return settings(json.loads(text))
    except FileNotFoundError:
        return dict(DEFAULTS)


class I2CMessage(ctypes.Structure):
    _fields_ = [('addr', ctypes.c_uint16), ('flags', ctypes.c_uint16),
                ('len', ctypes.c_uint16), ('buf', ctypes.c_void_p)]


class I2CTransfer(ctypes.Structure):
    _fields_ = [('msgs', ctypes.POINTER(I2CMessage)), ('nmsgs', ctypes.c_uint32)]


class Bus:
    def __init__(self):
        self.fd = os.open('/dev/i2c-1', os.O_RDWR | os.O_CLOEXEC)

    def close(self):
        os.close(self.fd)

    def read(self, address, register, count):
        allowed = ({0x00, 0x01, 0x04, 0x05, 0x06, 0x0b, 0x3e, 0x3f}
                   if address == 0x40 else set(range(9)) if address == 0x08 else set())
        if register not in allowed or count not in (1, 2, 3):
            raise ValueError('Unsupported register read')
        # Respect kernel ownership; never use I2C_SLAVE_FORCE.
        fcntl.ioctl(self.fd, 0x0703, address)
        pointer = (ctypes.c_ubyte * 1)(register)
        result = (ctypes.c_ubyte * count)()
        messages = (I2CMessage * 2)(
            I2CMessage(address, 0, 1, ctypes.addressof(pointer)),
            I2CMessage(address, 1, count, ctypes.addressof(result)))
        transfer = I2CTransfer(messages, 2)
        if fcntl.ioctl(self.fd, 0x0707, transfer) != 2:
            raise OSError('Incomplete I2C transfer')
        return bytes(result)


def uint(read, address, register, count):
    value = read(address, register, count)
    if not isinstance(value, (bytes, bytearray)) or len(value) != count:
        raise ValueError('Incomplete register read')
    return int.from_bytes(value, 'big')


def decode_ina228(config, adc, diagnostic, shunt, bus, temperature):
    if adc >> 12 not in (0x0b, 0x0f):
        raise ValueError('continuous-bus-shunt-required')
    if not diagnostic & 2:
        raise ValueError('conversion-not-ready')
    if not diagnostic & 1:
        raise ValueError('device-memory-checksum')
    signed = shunt >> 4
    if signed & (1 << 19):
        signed -= 1 << 20
    if signed in (-(1 << 19), (1 << 19)-1):
        raise ValueError('shunt-saturated')
    scale = 78.125e-9 if config & 0x10 else 312.5e-9
    shunt_volts = signed * scale
    volts = (bus >> 4) * 195.3125e-6
    amps = shunt_volts / SHUNT_OHMS
    die_temperature = (temperature if temperature < 0x8000 else temperature-0x10000) * .0078125
    if not all(math.isfinite(v) for v in (volts, amps, die_temperature)) or not 0 <= volts <= 85:
        raise ValueError('measurement-out-of-range')
    return dict(volts=volts, amps=amps, watts=volts*amps,
                shuntVolts=shunt_volts, dieTemperatureC=die_temperature if adc >> 12 == 0x0f else None,
                shuntOhms=SHUNT_OHMS, calibration='nominal-shunt')


def read_ina228(read, configuration):
    if uint(read, 0x40, 0x3e, 2) != 0x5449 or uint(read, 0x40, 0x3f, 2) >> 4 != 0x228:
        raise ValueError('wrong-device-id')
    config, adc = uint(read, 0x40, 0, 2), uint(read, 0x40, 1, 2)
    value = decode_ina228(config, adc, uint(read, 0x40, 0x0b, 2),
                          uint(read, 0x40, 4, 3), uint(read, 0x40, 5, 3),
                          uint(read, 0x40, 6, 2))
    if config != uint(read, 0x40, 0, 2) or adc != uint(read, 0x40, 1, 2):
        raise ValueError('configuration-changed')
    if not configuration['currentPathVerified'] or not configuration['voltageSenseVerified']:
        return dict(status='needs-setup', source='INA228', address='0x40',
                    shuntOhms=SHUNT_OHMS, calibration='nominal-shunt')
    return dict(status='ok', source='INA228', address='0x40', **value)


def decode_husb238(status0, status1, profiles, selected):
    if (len(profiles) != 6 or status0 >> 4 > 6 or (status1 >> 3) & 7 not in (0, 1, 3, 4, 5)
            or any(raw & 0x70 for raw in profiles) or selected & 15
            or selected >> 4 not in (0, *PDO_SELECTION)):
        raise ValueError('invalid-pd-status')
    attached = bool(status1 & 0x40)
    voltage_code = status0 >> 4
    valid_voltage = 1 <= voltage_code <= 6
    volts = VOLTAGES[voltage_code-1] if attached and valid_voltage else None
    amps = CURRENTS[status0 & 15] if volts is not None else None
    return dict(status='active' if volts is not None else 'attached' if attached else 'detached',
                source='HUSB238', address='0x08', attached=attached,
                volts=volts, amps=amps, watts=volts*amps if volts is not None else None,
                responseCode=(status1 >> 3) & 7,
                selectedVolts=PDO_SELECTION.get(selected >> 4),
                profiles=[dict(volts=v, amps=CURRENTS[raw & 15], watts=v*CURRENTS[raw & 15])
                          for v, raw in zip(VOLTAGES, profiles) if raw & 0x80] if attached else [])


def read_husb238(read):
    s0, s1 = uint(read, 8, 0, 1), uint(read, 8, 1, 1)
    profiles = [uint(read, 8, register, 1) for register in range(2, 8)]
    selected = uint(read, 8, 8, 1)
    if s0 != uint(read, 8, 0, 1) or s1 != uint(read, 8, 1, 1):
        return dict(status='changing', source='HUSB238', address='0x08')
    return decode_husb238(s0, s1, profiles, selected)


def collect(configuration, open_bus=Bus, now=lambda: int(time.time()*1000)):
    result = dict(schema=2, observedAt=now(), ina228=dict(status='disabled'), pd=dict(status='disabled'))
    for enabled, key, source, sample in (
            (configuration['ina228'], 'ina228', 'INA228', lambda read: read_ina228(read, configuration)),
            (configuration['husb238'], 'pd', 'HUSB238', read_husb238)):
        if not enabled:
            continue
        bus = None
        try:
            bus = open_bus()
            result[key] = sample(bus.read)
        except (OSError, ValueError) as error:
            code = str(error) if isinstance(error, ValueError) else 'i2c-unavailable'
            result[key] = dict(status='error', source=source, error=code[:80])
        finally:
            if bus is not None:
                try:
                    bus.close()
                except OSError:
                    result[key] = dict(status='error', source=source, error='i2c-unavailable')
        result[key]['observedAt'] = now()
    result['observedAt'] = now()
    return result


def publish(value, output=OUTPUT):
    temporary = output.with_suffix('.tmp')
    with open(temporary, 'w', encoding='utf-8') as stream:
        json.dump(value, stream, allow_nan=False)
    os.chmod(temporary, 0o640)
    os.replace(temporary, output)


def main():
    while True:
        try:
            value = collect(load_settings())
        except (ValueError, OSError):
            at = int(time.time()*1000)
            value = dict(schema=2, observedAt=at,
                         ina228=dict(status='error', observedAt=at, error='configuration-unavailable'),
                         pd=dict(status='error', observedAt=at, error='configuration-unavailable'))
        publish(value)
        time.sleep(2)


if __name__ == '__main__':
    main()
