"""Run the real display installer and controller in a temporary host filesystem."""
import json
import os
from pathlib import Path
import shlex
import shutil
import signal
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class DisplayInstallTests(unittest.TestCase):
    def fixture(self, program=None, detected=True):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        source = root/'repo/deploy'
        (source/'display').mkdir(parents=True)
        def rewrite(text):
            for prefix in ['/usr/local/', '/etc/', '/run/', '/sys/', '/var/lib/']:
                text = text.replace(prefix, str(root)+prefix)
            return text
        for name in ['install-display.sh', 'host-files.py']:
            text = (ROOT/'deploy'/name).read_text()
            text = '\n'.join(line for line in text.splitlines() if not line.startswith('[[ $EUID'))+'\n'
            (source/name).write_text(rewrite(text))
        program = (ROOT/'deploy/display/control.py').read_text() if program is None else program
        (source/'display/control.py').write_text(rewrite(program))
        backlight = root/'sys/class/backlight/10-0045'
        if detected:
            backlight.mkdir(parents=True)
            (backlight/'brightness').write_text('31')
            (backlight/'max_brightness').write_text('255')
        runtime = root/'run/daw-one-display'; runtime.mkdir(parents=True)
        (runtime/'ready.json').write_text('{"ready":true}')
        binaries = root/'bin'; binaries.mkdir()
        systemctl = binaries/'systemctl'
        systemctl.write_text('''#!/usr/bin/env python3
import json,os,signal,subprocess,sys
from pathlib import Path
root=Path(os.environ['DISPLAY_TEST_ROOT']);args=sys.argv[1:]
with (root/'calls.jsonl').open('a') as f:f.write(json.dumps(args)+'\\n')
pidfile=root/'pid'
if args[0]=='restart':
    if pidfile.exists():
        try:os.kill(int(pidfile.read_text()),signal.SIGTERM)
        except ProcessLookupError:pass
    with (root/'process.log').open('a') as log:
        p=subprocess.Popen([sys.executable,str(root/'usr/local/lib/daw-one-display/control.py')],stdout=log,stderr=log,start_new_session=True)
    pidfile.write_text(str(p.pid))
elif 'show' in args:
    print(pidfile.read_text() if pidfile.exists() else '0')
elif args[0]=='is-active':
    try:
        pid=int(pidfile.read_text());os.kill(pid,0)
        if Path('/proc/'+str(pid)+'/stat').read_text().split()[2]=='Z':sys.exit(3)
    except (OSError,ValueError):sys.exit(3)
''')
        systemctl.chmod(0o755)
        for name in ['systemd-tmpfiles', 'journalctl']:
            path = binaries/name; path.write_text('#!/bin/sh\nexit 0\n'); path.chmod(0o755)
        def stop():
            pid = root/'pid'
            if pid.exists():
                try: os.kill(int(pid.read_text()), signal.SIGTERM)
                except ProcessLookupError: pass
        self.addCleanup(stop)
        return root, source, {**os.environ, 'PATH':str(binaries)+os.pathsep+os.environ['PATH'], 'DISPLAY_TEST_ROOT':str(root)}

    def run_install(self, source, env):
        return subprocess.run(['bash', str(source/'install-display.sh')], env=env, text=True,
                              capture_output=True, timeout=20)

    def test_empty_installed_controller_is_repaired_and_service_must_publish_live_status(self):
        root, source, env = self.fixture()
        controller = root/'usr/local/lib/daw-one-display/control.py'
        controller.parent.mkdir(parents=True); controller.write_bytes(b'')
        result = self.run_install(source, env)
        self.assertEqual(result.returncode, 0, result.stdout+result.stderr)
        self.assertIn('fresh backlight status', result.stdout)
        self.assertGreater(controller.stat().st_size, 5000)
        status = json.loads((root/'run/daw-one-display/status.json').read_text())
        self.assertTrue(status['supported'])
        self.assertEqual(status['pid'], int((root/'pid').read_text()))
        unit = (root/'etc/systemd/system/daw-one-display.service').read_text()
        guard = next(line.split('=', 1)[1] for line in unit.splitlines() if 'ExecStartPre=/usr/bin/sha256sum' in line)
        self.assertEqual(subprocess.run(shlex.split(guard)).returncode, 0)
        controller.write_bytes(b'')
        self.assertNotEqual(subprocess.run(shlex.split(guard), capture_output=True).returncode, 0)
        # An explicit reinstall repairs the bytes and starts a new process, including on an already active service.
        result = self.run_install(source, env)
        self.assertEqual(result.returncode, 0, result.stdout+result.stderr)
        self.assertNotEqual(int((root/'pid').read_text()), status['pid'])
        calls = [json.loads(line) for line in (root/'calls.jsonl').read_text().splitlines()]
        self.assertEqual(calls.count(['restart', 'daw-one-display.service']), 2)

    def test_invalid_payload_cannot_replace_the_previous_controller_or_start_a_service(self):
        for program in ['', 'def broken(', 'def loop():\n    pass\n']:
            with self.subTest(program=program):
                root, source, env = self.fixture(program)
                controller = root/'usr/local/lib/daw-one-display/control.py'
                controller.parent.mkdir(parents=True); controller.write_bytes(b'old working copy\n')
                result = self.run_install(source, env)
                self.assertNotEqual(result.returncode, 0, result.stdout+result.stderr)
                self.assertEqual(controller.read_bytes(), b'old working copy\n')
                self.assertFalse((root/'calls.jsonl').exists())

    def test_zero_exit_after_start_is_a_failed_install_not_a_success(self):
        program = (ROOT/'deploy/display/control.py').read_text().replace('def loop():\n', 'def loop():\n    return\n', 1)
        root, source, env = self.fixture(program)
        result = self.run_install(source, env)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('did not produce live backlight status', result.stderr)
        self.assertNotIn('DSI backlight controller enabled', result.stdout)

    def test_stop_hook_cannot_execute_a_controller_rejected_by_its_inventory(self):
        root, source, env = self.fixture()
        result = self.run_install(source, env)
        self.assertEqual(result.returncode, 0, result.stdout+result.stderr)
        marker = root/'unverified-controller-ran'
        controller = root/'usr/local/lib/daw-one-display/control.py'
        controller.write_text('from pathlib import Path\nPath('+repr(str(marker))+').write_text("ran")\n')
        unit = (root/'etc/systemd/system/daw-one-display.service').read_text()
        stop = next(line.split('=', 1)[1] for line in unit.splitlines() if line.startswith('ExecStopPost='))
        result = subprocess.run(shlex.split(stop), capture_output=True, text=True, timeout=5)
        self.assertFalse(marker.exists(), 'A failed startup check must not be bypassed by ExecStopPost')
        self.assertNotEqual(result.returncode, 0)

    def test_host_without_this_panel_skips_installation(self):
        root, source, env = self.fixture(detected=False)
        result = self.run_install(source, env)
        self.assertEqual(result.returncode, 0, result.stdout+result.stderr)
        self.assertIn('not detected', result.stdout)
        self.assertFalse((root/'usr/local/lib/daw-one-display/control.py').exists())

    @unittest.skipUnless(shutil.which('systemd-analyze'), 'systemd-analyze is not installed')
    def test_installed_display_unit_is_valid_systemd_configuration(self):
        root, source, env = self.fixture()
        result = self.run_install(source, env)
        self.assertEqual(result.returncode, 0, result.stdout+result.stderr)
        result = subprocess.run(['systemd-analyze', 'verify', '--man=no', '--generators=false',
                                 str(root/'etc/systemd/system/daw-one-display.service')], text=True, capture_output=True, timeout=15)
        self.assertEqual(result.returncode, 0, result.stdout+result.stderr)


if __name__ == '__main__': unittest.main()
