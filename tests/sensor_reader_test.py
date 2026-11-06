"""No hardware, venv, bus or third-party imports required for decode tests."""
import sys
sys.dont_write_bytecode = True
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('reader', Path(__file__).resolve().parents[1] / 'deploy/sensors/read.py')
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)

class SensorReaderTests(unittest.TestCase):
    def test_positive_and_negative_temperature(self):
        self.assertEqual(reader.pct_temperature([0x13, 0x80]), 19.5)
        self.assertEqual(reader.pct_temperature([0xF5, 0x80]), -10.5)
        with self.assertRaises(ValueError):
            reader.pct_temperature([0])
    def test_failed_or_saturated_measurement_is_not_zero(self):
        for value in (None, float('nan'), float('inf')):
            self.assertEqual(reader.sample(lambda: value)['status'], 'error')
            self.assertIsNone(reader.sample(lambda: value)['value'])
    def test_independent_sensor_reads(self):
        def broken():
            raise OSError('fixture')
        self.assertEqual(reader.sample(broken)['status'], 'error')
        self.assertEqual(reader.sample(lambda: 485.74848)['value'], 485.74848)

if __name__ == '__main__':
    unittest.main()
