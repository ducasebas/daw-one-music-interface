"""Exercise the installer in a temporary filesystem with all host actions stubbed."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class PowerInstallTests(unittest.TestCase):
    def install(self, settings=None):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        (root/'etc/systemd/system').mkdir(parents=True)
        source = root/'repo/deploy'
        source.mkdir(parents=True)
        shutil.copytree(ROOT/'deploy/power', source/'power', ignore=shutil.ignore_patterns('__pycache__'))
        text = (ROOT/'deploy/install-power.sh').read_text()
        text = '\n'.join(line for line in text.splitlines() if not line.startswith('[[ $EUID'))+'\n'
        for directory in ['/etc/', '/run/', '/var/lib/', '/usr/local/']:
            text = text.replace(directory, str(root)+directory)
        script = source/'install-power.sh'
        script.write_text(text)
        config = root/'etc/daw-one-power/settings.json'
        if settings is not None:
            config.parent.mkdir(parents=True)
            config.write_text(json.dumps(settings))
        binaries = root/'bin'; binaries.mkdir()
        for name in ['getent', 'id', 'usermod', 'useradd', 'groupadd']:
            path = binaries/name
            path.write_text('#!/bin/sh\nexit 0\n'); path.chmod(0o755)
        install = binaries/'install'
        install.write_text('''#!/usr/bin/env python3
import os,sys
args=[]; values=iter(sys.argv[1:])
for arg in values:
    if arg in ('-o','-g'): next(values)
    else: args.append(arg)
os.execv('/usr/bin/install',['install',*args])
'''); install.chmod(0o755)
        systemctl = binaries/'systemctl'
        systemctl.write_text('''#!/usr/bin/env python3
import json,os,sys
with open(os.environ['POWER_INSTALL_CALLS'],'a') as stream: stream.write(json.dumps(sys.argv[1:])+'\\n')
'''); systemctl.chmod(0o755)
        calls = root/'calls.jsonl'
        result = subprocess.run(['bash', str(script)], text=True, capture_output=True,
                                env={**os.environ, 'PATH':str(binaries)+os.pathsep+os.environ['PATH'], 'POWER_INSTALL_CALLS':str(calls)}, timeout=15)
        self.assertEqual(result.returncode, 0, result.stdout+result.stderr)
        return root, config, [json.loads(line) for line in calls.read_text().splitlines()]

    def test_fresh_install_creates_guard_units_runtime_and_disabled_policy_without_requesting_power(self):
        root, config, calls = self.install()
        settings = json.loads(config.read_text())
        self.assertFalse(settings['startup100W']); self.assertFalse(settings['startup20V'])
        self.assertFalse(settings['startupMaximum20V']); self.assertFalse(settings['voltageSenseVerified'])
        self.assertEqual(calls[0], ['daemon-reload'])
        self.assertIn(['disable', 'daw-one-pd-startup.service'], calls)
        self.assertFalse(any('start' in row or 'restart' in row or '--now' in row for row in calls))
        self.assertTrue((root/'run/daw-one-pd').is_dir())
        self.assertTrue((root/'var/lib/daw-one-power').is_dir())
        for script in ['read.py', 'pd_request.py', 'player_power_guard.py']:
            self.assertTrue((root/'usr/local/lib/daw-one-control/deploy/power'/script).is_file())
        for name in ['power', 'pd-request', 'pd-startup']:
            self.assertTrue((root/f'etc/systemd/system/daw-one-{name}.service').is_file())
        for name in ['pd-request', 'pd-startup']:
            # The worker handles unavailable I2C after journalling an authorized
            # attempt. Policy-off startup must not fail a hardware precheck.
            self.assertNotIn('ExecStartPre=/usr/bin/test', (root/f'etc/systemd/system/daw-one-{name}.service').read_text())
            self.assertIn('TimeoutStartSec=12', (root/f'etc/systemd/system/daw-one-{name}.service').read_text())
        self.assertTrue((root/'etc/systemd/system/tunebox-player.service.d/power.conf').is_file())

    def test_legacy_wiring_and_existing_startup_choice_are_preserved_without_starting_a_request(self):
        legacy = dict(ina228=True, husb238=True, currentPathVerified=True, voltageSenseVerified=False)
        for settings in [legacy, dict(legacy, startup100W=True), dict(legacy, startup20V=True), dict(legacy, startupMaximum20V=True)]:
            _, config, calls = self.install(settings)
            self.assertEqual(json.loads(config.read_text()), settings)
            action = 'enable' if any(settings.get(k) for k in ('startup100W', 'startup20V', 'startupMaximum20V')) else 'disable'
            self.assertIn([action, 'daw-one-pd-startup.service'], calls)
            self.assertFalse(any('start' in row or 'restart' in row or '--now' in row for row in calls))

    @unittest.skipUnless(shutil.which('systemd-analyze'), 'systemd-analyze is not installed')
    def test_generated_units_have_valid_ordering_and_sandbox_directives(self):
        root, _, _ = self.install()
        units = root/'etc/systemd/system'
        for name in ['tunebox-player', 'daw-one-manager']:
            (units/(name+'.service')).write_text('[Unit]\nAfter=daw-one-pd-startup.service\n[Service]\nExecStart=/bin/true\n')
        result = subprocess.run(['systemd-analyze', 'verify', '--man=no', '--generators=false',
                                 *map(str, units.glob('*.service'))], capture_output=True, text=True, timeout=15)
        self.assertEqual(result.returncode, 0, result.stdout+result.stderr)


if __name__ == '__main__': unittest.main()
