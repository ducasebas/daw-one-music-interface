import importlib.util
from pathlib import Path
import unittest
import tempfile

def load(name,path):
    spec=importlib.util.spec_from_file_location(name,Path(__file__).resolve().parents[1]/path)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

control=load('display_control','deploy/display/control.py')
quiet=load('quiet_boot','deploy/display/quiet-boot.py')

class DisplayControlTests(unittest.TestCase):
    def test_auto_follows_light_and_stale_readings_use_manual_fallback(self):
        s={'brightnessMode':'auto','brightness':60,'minimum':10,'maximum':90}
        data={'schema':1,'observedAt':100000,'lux':{'status':'ok','value':0}}
        self.assertEqual(control.target(s,data,100),(10,'auto',0))
        data['lux']['value']=1000
        self.assertEqual(control.target(s,data,100),(90,'auto',1000))
        self.assertEqual(control.target(s,data,200),(60,'sensor-unavailable',None))
        data['lux']['value']=float('nan')
        self.assertEqual(control.target(s,data,100),(60,'sensor-unavailable',None))

    def test_quiet_boot_preserves_root_network_and_serial_console(self):
        source='console=serial0,115200 console=tty1 root=PARTUUID=abc rootwait cfg80211.ieee80211_regdom=NL loglevel=7\n'
        value=quiet.quiet_cmdline(source)
        self.assertIn('console=serial0,115200',value)
        self.assertIn('root=PARTUUID=abc',value)
        self.assertIn('cfg80211.ieee80211_regdom=NL',value)
        self.assertIn('console=tty1',value)
        self.assertEqual(quiet.quiet_cmdline(value),value)

    def test_quiet_boot_restores_a_virtual_console_to_the_previous_serial_only_configuration(self):
        source='console=serial0,115200 root=PARTUUID=96c5ce73-02 rootfstype=ext4 rootwait cfg80211.ieee80211_regdom=NL quiet loglevel=0\n'
        value=quiet.quiet_cmdline(source)
        self.assertIn('console=tty1',value.split())
        self.assertIn('console=serial0,115200',value.split())
        self.assertIn('root=PARTUUID=96c5ce73-02',value.split())
        self.assertEqual(quiet.quiet_cmdline(value),value)

    def test_quiet_boot_retains_explicit_virtual_console_and_unrelated_boot_flags(self):
        source='console=tty3 console=serial0,115200 root=/dev/mmcblk0p2 fsck.repair=yes systemd.mask=example.service\n'
        value=quiet.quiet_cmdline(source).split()
        for token in source.split():self.assertIn(token,value)
        self.assertEqual(value.count('console=tty3'),1)

    def test_a_warm_kiosk_restart_waits_for_its_new_frame_not_the_original_boot_deadline(self):
        self.assertFalse(control.ready_to_reveal({'ready':False,'startedUptime':500},501))
        self.assertTrue(control.ready_to_reveal({'ready':False,'startedUptime':500},591))
        self.assertTrue(control.ready_to_reveal({'ready':True,'startedUptime':500},501))
        self.assertFalse(control.ready_to_reveal({},12))
        self.assertTrue(control.ready_to_reveal({},91))

    def test_boot_replacement_is_idempotent_and_keeps_the_original_backup(self):
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'cmdline.txt'
            path.write_text('console=serial0,115200 root=PARTUUID=abc\n')
            original=path.read_text()
            updated=quiet.quiet_cmdline(original)
            self.assertTrue(quiet.replace_if_changed(path,updated,'first'))
            self.assertEqual(path.read_text(),updated)
            self.assertEqual(Path(str(path)+'.tunebox-backup-first').read_text(),original)
            inode=path.stat().st_ino
            self.assertFalse(quiet.replace_if_changed(path,updated,'second'))
            self.assertEqual(path.stat().st_ino,inode)
            self.assertFalse(Path(str(path)+'.tunebox-backup-second').exists())
            self.assertEqual(list(Path(d).glob('.cmdline.txt-*')),[])
