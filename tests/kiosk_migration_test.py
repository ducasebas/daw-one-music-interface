import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('kiosk_migration',Path(__file__).resolve().parents[1]/'deploy/ota/migrate-kiosk.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class KioskMigrationTests(unittest.TestCase):
    def test_migration_preserves_other_dependencies_and_all_service_settings(self):
        source='[Unit]\nAfter=daw-one.service seatd.service\nRequires=daw-one.service seatd.service\n[Service]\nUser=dawone\nPAMName=login\nExecStart=/opt/daw-one/kiosk.sh\n[Install]\nWantedBy=multi-user.target\n'
        result=module.independent_kiosk(source)
        self.assertIn('Requires=seatd.service',result)
        self.assertIn('Wants=daw-one.service',result)
        self.assertIn('[Service]\nUser=dawone\nPAMName=login\nExecStart=/opt/daw-one/kiosk.sh',result)
        self.assertEqual(module.independent_kiosk(result),result)

    def test_fresh_unit_keeps_the_progress_display_alive(self):
        source=(Path(__file__).resolve().parents[1]/'deploy/daw-one-kiosk.service').read_text()
        self.assertIn('Wants=daw-one.service',source)
        self.assertNotIn('Requires=daw-one.service',source)
