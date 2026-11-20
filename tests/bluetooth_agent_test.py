import importlib.util
from pathlib import Path
import unittest
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1] / 'deploy/bluetooth'))

path = Path(__file__).resolve().parents[1] / 'deploy/bluetooth/agent.py'
spec = importlib.util.spec_from_file_location('tunebox_bluetooth_agent', path)
agent = importlib.util.module_from_spec(spec)
spec.loader.exec_module(agent)

class BluetoothLinkTest(unittest.TestCase):
    def test_transport_reports_the_real_codec_bytes_of_this_phone_only(self):
        objects = {'/org/bluez/hci0/dev_AA/fd0': {'org.bluez.MediaTransport1': {'Codec': 0, 'Configuration': [0x21, 0x15, 2, 53], 'State': 'active'}},
                   '/org/bluez/hci0/dev_BB/fd1': {'org.bluez.MediaTransport1': {'Codec': 2, 'Configuration': [0x80, 0x01, 0x8C, 0x83, 0xE8, 0x00], 'State': 'idle'}}}
        self.assertEqual(agent.transport_info(objects, '/org/bluez/hci0/dev_AA'), {'codec': 0, 'configuration': [0x21, 0x15, 2, 53], 'state': 'active'})
        self.assertIsNone(agent.transport_info(objects, '/org/bluez/hci0/dev_CC'))

    def test_link_history_counts_drops_within_the_last_hour(self):
        h = agent.LinkHistory()
        self.assertEqual(h.update('A', True, 100), {'connectedSeconds': 0, 'dropsLastHour': 0})
        self.assertEqual(h.update('A', True, 700)['connectedSeconds'], 600)
        h.update('A', False, 800); h.update('A', True, 810); h.update('A', False, 900)
        self.assertEqual(h.update('A', False, 1000)['dropsLastHour'], 2)
        self.assertEqual(h.update('A', True, 900 + 3601)['dropsLastHour'], 0)


class BluetoothPairingTest(unittest.TestCase):
    def test_window_uses_current_boot_monotonic_expiry(self):
        self.assertTrue(agent.pairing_open({'bootId': 'boot', 'expiresBootSeconds': 200}, 'boot', 100))
        self.assertFalse(agent.pairing_open({'bootId': 'old-boot', 'expiresBootSeconds': 200}, 'boot', 100))
        self.assertFalse(agent.pairing_open({'bootId': 'boot', 'expiresBootSeconds': 200}, 'boot', 201))
        self.assertFalse(agent.pairing_open({'bootId': 'boot', 'expiresBootSeconds': 1000}, 'boot', 100))

    def test_only_audio_profile_uuids_and_bounded_labels(self):
        self.assertNotIn('00001101', agent.AUDIO_SERVICES)  # Serial profile
        self.assertNotIn('0000111e', agent.AUDIO_SERVICES)  # Hands-free microphone
        self.assertEqual(agent.clean('Phone\0\n'), 'Phone')
        self.assertEqual(len(agent.clean('a' * 500)), 160)

    def test_approved_addresses_cannot_enable_wildcard_audio_capture(self):
        from approved import addresses
        self.assertEqual(addresses(['00:00:00:00:00:00','FF:FF:FF:FF:FF:FF','--pcm=other']),[])
        self.assertEqual(addresses(['AA:BB:CC:DD:EE:FF']*2),['AA:BB:CC:DD:EE:FF'])
