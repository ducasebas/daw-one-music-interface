import importlib.util
from pathlib import Path
import unittest
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1] / 'deploy/bluetooth'))

path = Path(__file__).resolve().parents[1] / 'deploy/bluetooth/agent.py'
spec = importlib.util.spec_from_file_location('tunebox_bluetooth_agent', path)
agent = importlib.util.module_from_spec(spec)
spec.loader.exec_module(agent)

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
