import importlib.util,pathlib,sys,unittest
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('player_export',pathlib.Path(__file__).parents[1]/'deploy/audio/player-export.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class AudioExportTests(unittest.TestCase):
    def test_preserves_all_player_arguments(self):
        argv=['/usr/bin/squeezelite','-n','DAW TuneBox v1','-m','02:00:00:00:00:01','-o','plughw:CARD=Headphones,DEV=0','-s','10.0.0.1:3483','-r','44100']
        result=module.export_arguments(argv,'02:00:00:00:00:01')
        self.assertEqual(result,argv+['-v']);self.assertEqual(module.export_arguments(result,'02:00:00:00:00:01'),result)
    def test_does_not_guess_identity_or_accept_dsd(self):
        for argv in [['/usr/bin/squeezelite'],['/usr/bin/squeezelite','-m','02:00:00:00:00:02'],['/usr/bin/squeezelite','-m','02:00:00:00:00:01','-D','dop']]:
            with self.assertRaises(ValueError):module.export_arguments(argv,'02:00:00:00:00:01')
    def test_systemd_special_characters_are_literal(self):
        value=module.systemd_override(['/usr/bin/squeezelite','-n','My $room %n "test"'])
        self.assertIn('ExecStart=:',value);self.assertIn('%%n',value);self.assertIn('$room',value);self.assertIn('\\"test\\"',value)
        with self.assertRaises(ValueError):module.systemd_override(['/usr/bin/squeezelite','bad\nExecStart=evil'])
if __name__=='__main__':unittest.main()
