import importlib.util
from pathlib import Path
import unittest

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
        self.assertNotIn('console=tty1',value)
        self.assertEqual(quiet.quiet_cmdline(value),value)
