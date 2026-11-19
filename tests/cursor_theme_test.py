"""Load the actual cursor image and reproduce the OTA installer's private umask."""
import ctypes
import ctypes.util
import importlib.util
import os
from pathlib import Path
import stat
import struct
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('transparent_cursor', ROOT/'deploy/display/cursor-theme.py')
cursor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cursor)

class CursorThemeTests(unittest.TestCase):
    def test_private_ota_umask_keeps_theme_root_and_images_readable_by_the_service_user(self):
        with tempfile.TemporaryDirectory() as directory:
            icons = Path(directory)/'icons'
            previous = os.umask(0o077)
            try:
                subprocess.run(['install', '-d', '-m', '755', str(icons)], check=True)
                cursor.create_theme(icons/'tunebox-invisible')
            finally:
                os.umask(previous)
            for path in [icons, icons/'tunebox-invisible', icons/'tunebox-invisible/cursors']:
                self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o755, str(path))
            for path in (icons/'tunebox-invisible').rglob('*'):
                if path.is_file(): self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o644)

    def test_every_installed_cursor_is_fully_transparent_with_a_valid_hotspot(self):
        with tempfile.TemporaryDirectory() as directory:
            cursor.create_theme(directory)
            for name in ['default', 'left_ptr', 'pointer', 'text', 'wait', 'left_ptr_watch', 'grabbing', 'not-allowed', 'nw-resize', 'none']:
                data = (Path(directory)/'cursors'/name).read_bytes()
                self.assertEqual(struct.unpack_from('<4I', data), (0x72756358, 16, 0x10000, 1))
                kind, subtype, offset = struct.unpack_from('<3I', data, 16)
                self.assertEqual((kind, subtype, offset), (0xfffd0002, 24, 28))
                header, kind, subtype, version, width, height, x, y, delay = struct.unpack_from('<9I', data, offset)
                self.assertEqual((width, height, x, y), (24, 24, 0, 0))
                self.assertEqual(data[offset+header:], bytes(width*height*4))

    @unittest.skipUnless(ctypes.util.find_library('Xcursor'), 'Native libXcursor unavailable')
    def test_native_xcursor_loader_accepts_the_theme_without_a_display_server(self):
        class Image(ctypes.Structure):
            _fields_ = [('version', ctypes.c_uint32), ('size', ctypes.c_uint32), ('width', ctypes.c_uint32),
                        ('height', ctypes.c_uint32), ('xhot', ctypes.c_uint32), ('yhot', ctypes.c_uint32),
                        ('delay', ctypes.c_uint32), ('pixels', ctypes.POINTER(ctypes.c_uint32))]
        lib = ctypes.CDLL(ctypes.util.find_library('Xcursor'))
        lib.XcursorFilenameLoadImage.argtypes = [ctypes.c_char_p, ctypes.c_int]
        lib.XcursorFilenameLoadImage.restype = ctypes.POINTER(Image)
        lib.XcursorImageDestroy.argtypes = [ctypes.POINTER(Image)]
        with tempfile.TemporaryDirectory() as directory:
            cursor.create_theme(directory)
            image = lib.XcursorFilenameLoadImage(os.fsencode(Path(directory)/'cursors/default'), 24)
            self.assertTrue(image)
            try:
                self.assertEqual((image.contents.width, image.contents.height), (24, 24))
                self.assertTrue(all(image.contents.pixels[i] == 0 for i in range(24*24)))
            finally:
                lib.XcursorImageDestroy(image)

if __name__ == '__main__': unittest.main()
