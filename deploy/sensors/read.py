#!/usr/bin/env python3
"""Opt-in I2C telemetry only. No amplifier/GPIO/backlight writes."""
import json, os, time
from pathlib import Path

def pct_temperature(data):
    if len(data) != 2:
        raise ValueError('Expected two temperature bytes')
    return int.from_bytes(bytes(data), 'big', signed=True) / 256

def sample(read):
    try:
        value = read()
        if value is None or not isinstance(value, (int, float)):
            raise ValueError('Measurement unavailable')
        import math
        if not math.isfinite(value):
            raise ValueError('Non-finite measurement')
        return {'status': 'ok', 'value': value}
    except Exception as error:
        return {'status': 'error', 'value': None, 'error': type(error).__name__}

def main():
    from smbus2 import SMBus, i2c_msg
    from adafruit_extended_bus import ExtendedI2C
    import adafruit_tsl2591
    output = Path('/run/daw-one-sensors/readings.json')
    while True:
        def temperature():
            with SMBus(1) as bus:
                request = i2c_msg.write(0x37, [0x00])
                response = i2c_msg.read(0x37, 2)
                bus.i2c_rdwr(request, response)
                return pct_temperature(list(response))
        def light():
            bus = ExtendedI2C(1)
            try:
                return adafruit_tsl2591.TSL2591(bus).lux
            finally:
                bus.deinit()
        data = {'schema': 1, 'observedAt': int(time.time()*1000),
                'temperatureC': sample(temperature), 'lux': sample(light)}
        temporary = output.with_suffix('.tmp')
        with open(temporary, 'w', encoding='utf-8') as stream:
            json.dump(data, stream, allow_nan=False)
        os.chmod(temporary, 0o640)
        os.replace(temporary, output)
        time.sleep(3)

if __name__ == '__main__':
    main()
