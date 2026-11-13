import importlib.util
import json
import os
from pathlib import Path
import re
import stat
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('chromium_policy', ROOT/'deploy/chromium/configure.py')
policy_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy_module)
CONTRACT = json.loads((ROOT/'tests/fixtures/chromium-policy-contract.json').read_text())

def check_schema(value, schema):
    kind = schema.get('type')
    if kind == 'boolean': assert isinstance(value,bool)
    if kind == 'integer': assert isinstance(value,int) and not isinstance(value,bool)
    if kind == 'string': assert isinstance(value,str)
    if kind == 'array':
        assert isinstance(value,list)
        for item in value:check_schema(item,schema['items'])
    if kind == 'object':
        assert isinstance(value,dict)
        for name in schema.get('required',[]):assert name in value
        for name,item in value.items():check_schema(item,schema['properties'][name])
    if 'enum' in schema: assert value in schema['enum']

class ChromiumPolicyTests(unittest.TestCase):
    def test_policies_match_upstream_linux_types_ranges_and_values(self):
        for major in (103,120,128,132,138,153,154,156):
            with self.subTest(major=major):
                for name,value in policy_module.policy_for_major(major).items():
                    definition = CONTRACT[name]
                    supported=False
                    for item in definition['supported_on']:
                        match=re.fullmatch(r'chrome\.(?:\*|linux):(\d+)-(\d*)',item)
                        if match and int(match[1])<=major and (not match[2] or major<=int(match[2])):supported=True
                    self.assertTrue(supported,name)
                    check_schema(value,definition['schema'])
    def test_current_pi_blocks_saving_and_filling_secrets_and_all_autofill(self):
        policy=policy_module.policy_for_major(156)
        self.assertFalse(policy['TranslateEnabled'])
        self.assertFalse(policy['PasswordManagerEnabled'])
        self.assertEqual(policy['PasswordManagerBlocklist'],['*'])
        self.assertEqual(policy['AutofillSettings'],[{'url_pattern':'*','blocked_types':['all']}])
        self.assertNotIn('AutofillAddressEnabled',policy)
        self.assertNotIn('RelaunchNotification',policy)
        for key in ['DefaultNotificationsSetting','DefaultGeolocationSetting','DefaultWebUsbGuardSetting','DefaultClipboardSetting']:
            self.assertEqual(policy[key],2)
    def test_installer_retains_other_policy_and_rejects_conflicts_before_replacing_ours(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);path=root/'daw-one-appliance.json';other=root/'other.json'
            other.write_text('{"TranslateEnabled":false,"UnrelatedPolicy":true}')
            policy=policy_module.policy_for_major(156)
            self.assertTrue(policy_module.install_policy(policy,path))
            original=path.read_text()
            self.assertFalse(policy_module.install_policy(policy,path))
            other.write_text('{"TranslateEnabled":true}')
            with self.assertRaisesRegex(ValueError,'Conflicting'):policy_module.install_policy(policy,path)
            self.assertEqual(path.read_text(),original)
            self.assertEqual(json.loads(other.read_text()),{'TranslateEnabled':True})
    def test_private_umask_does_not_hide_policy_from_the_kiosk_user(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'policies/managed/daw-one-appliance.json'
            previous=os.umask(0o077)
            try:policy_module.install_policy(policy_module.policy_for_major(156),path)
            finally:os.umask(previous)
            self.assertEqual(stat.S_IMODE(path.stat().st_mode),0o644)
            for directory in [path.parent,path.parent.parent]:self.assertEqual(stat.S_IMODE(directory.stat().st_mode),0o755)
    def test_changed_own_policy_has_an_independent_backup(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'daw-one-appliance.json';path.write_text('{"TranslateEnabled":true}')
            policy_module.install_policy(policy_module.policy_for_major(156),path)
            backups=list(path.parent.glob('*.before-*'))
            self.assertEqual(len(backups),1)
            self.assertEqual(json.loads(backups[0].read_text()),{'TranslateEnabled':True})

if __name__=='__main__':unittest.main()
