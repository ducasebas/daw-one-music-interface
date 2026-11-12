import importlib.util
import struct
import tempfile
import unittest
from pathlib import Path


def load(name, source):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).resolve().parents[1] / source)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


button = load('tunebox_button_test', 'deploy/button/button.py')
presence = load('tunebox_presence_test', 'deploy/presence/read.py')
cursor = load('tunebox_cursor_test', 'deploy/display/cursor-theme.py')


class SetupHardwareTests(unittest.TestCase):
    def test_button_rejects_bounce_and_a_long_hold_never_also_sends_short(self):
        b = button.Button()
        self.assertIsNone(b.edge(True, 0))
        self.assertIsNone(b.edge(False, .02))
        b.edge(True, 1)
        self.assertEqual(b.edge(False, 1.2), 'short')
        b.edge(True, 2)
        self.assertIsNone(b.tick(4.9))
        self.assertEqual(b.tick(5), 'long')
        self.assertIsNone(b.tick(6))
        self.assertIsNone(b.edge(False, 6))

    def test_uart_frame_survives_fragmentation_and_rejects_invalid_tail(self):
        body = bytes([2, 0xaa, 1, 200, 0, 55, 0, 0, 0, 200, 0, 0x55, 0])
        frame = presence.HEADER + len(body).to_bytes(2, 'little') + body + presence.FOOTER
        frames = presence.Frames()
        self.assertIsNone(frames.push(b'junk' + frame[:9]))
        value = frames.push(frame[9:])
        self.assertTrue(value['present'])
        self.assertEqual(value['distance'], 2)
        self.assertEqual(value['energy'], 55)
        self.assertFalse(value['simulated'])
        self.assertIsNone(frames.push(frame[:-1] + b'\0'))
        self.assertTrue(frames.push(frame)['present'])

    def test_original_cursor_file_is_valid_transparent_one_pixel_image(self):
        with tempfile.TemporaryDirectory() as directory:
            cursor.create_theme(directory)
            blob = (Path(directory) / 'cursors' / 'left_ptr').read_bytes()
            magic, size, version, count = struct.unpack_from('<4I', blob)
            self.assertEqual((magic, size, count), (0x72756358, 16, 1))
            kind, subtype, offset = struct.unpack_from('<3I', blob, 16)
            self.assertEqual((kind, subtype, offset), (0xfffd0002, 24, 28))
            fields = struct.unpack_from('<9I', blob, offset)
            self.assertEqual(fields[4:8], (1, 1, 0, 0))
            self.assertEqual(struct.unpack_from('<I', blob, offset + 36)[0], 0)
            self.assertEqual(blob, (Path(directory) / 'cursors' / 'pointer').read_bytes())


if __name__ == '__main__':
    unittest.main()
