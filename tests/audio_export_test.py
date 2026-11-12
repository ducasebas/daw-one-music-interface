import importlib.util,json,pathlib,sys,tempfile,unittest
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

    def fixture(self,root):
        executable=root/'bin'/'squeezelite';executable.parent.mkdir();executable.write_text('fixture')
        process=root/'proc'/'1234';process.mkdir(parents=True);(process/'exe').symlink_to(executable)
        argv=[str(executable),'-n','DAW TuneBox v1','-m','02:00:00:00:00:01','-s','10.0.0.1:3483','-o','plughw:CARD=Headphones,DEV=0','-d','slimproto=info','-r','44100']
        entry=[str(executable),argv,[],0,0,0,0,1234,0,0]
        payload={'type':'a(sasasttttuii)','data':[[entry]]}
        raw=b'\0'.join(a.encode() for a in argv)+b'\0'
        (process/'cmdline').write_bytes(raw)
        return process,argv,payload,raw

    def test_recovers_original_mac_server_and_debug_options_after_squeezelite_tokenises_argv(self):
        with tempfile.TemporaryDirectory() as d:
            root=pathlib.Path(d);process,argv,payload,raw=self.fixture(root)
            # Squeezelite strtok changes separators to NUL in its argv storage.
            (process/'cmdline').write_bytes(raw.replace(b':',b'\0').replace(b'=',b'\0'))
            fields=(process/'cmdline').read_bytes().split(b'\0')
            self.assertEqual(fields[fields.index(b'-m')+1],b'02')
            actual=module.running_arguments('1234',root/'proc',lambda *a,**kw:json.dumps(payload))
            self.assertEqual(actual,argv)
            self.assertEqual(module.existing_player_id(actual),'02:00:00:00:00:01')
            updated=module.export_arguments(actual,'02:00:00:00:00:01')
            self.assertEqual(updated,argv+['-v'])
            self.assertIn('"10.0.0.1:3483"',module.systemd_override(updated))
            self.assertIn('"slimproto=info"',module.systemd_override(updated))

    def test_rejects_unit_reload_or_running_arguments_that_do_not_match(self):
        with tempfile.TemporaryDirectory() as d:
            root=pathlib.Path(d);process,argv,payload,raw=self.fixture(root)
            (process/'cmdline').write_bytes(raw.replace(b'44100',b'48000'))
            with self.assertRaisesRegex(ValueError,'arguments differ'):
                module.running_arguments('1234',root/'proc',lambda *a,**kw:json.dumps(payload))
            (process/'cmdline').write_bytes(raw);payload['data'][0][0][7]=4321
            with self.assertRaisesRegex(ValueError,'process differ'):
                module.running_arguments('1234',root/'proc',lambda *a,**kw:json.dumps(payload))

    def test_systemd_command_rejects_ambiguous_or_unexpanded_configuration(self):
        argv=['/usr/bin/squeezelite','-m','02:00:00:00:00:01']
        entry=['/usr/bin/squeezelite',argv,[],0,0,0,0,1234,0,0]
        payload={'type':'a(sasasttttuii)','data':[[entry]]}
        self.assertEqual(module.systemd_command(payload)[1],argv)
        self.assertEqual(module.systemd_command({**payload,'data':[entry]})[1],argv)
        with self.assertRaises(ValueError):module.systemd_command({**payload,'data':[[entry,entry]]})
        expanded=[*entry];expanded[1]=[*argv,'$PLAYER_OPTIONS']
        with self.assertRaisesRegex(ValueError,'environment expansion'):
            module.systemd_command({**payload,'data':[[expanded]]})
        expanded[2]=['no-env-expand']
        self.assertEqual(module.systemd_command({**payload,'data':[[expanded]]})[1][-1],'$PLAYER_OPTIONS')
        flags=[*entry];flags[2]=['full-privileges']
        with self.assertRaises(ValueError):module.systemd_command({**payload,'data':[[flags]]})
if __name__=='__main__':unittest.main()
