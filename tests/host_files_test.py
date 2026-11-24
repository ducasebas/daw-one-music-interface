"""Real filesystem faults and controller-process checks; no Pi or power experiments."""
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('host_files', ROOT/'deploy/host-files.py')
host = importlib.util.module_from_spec(spec)
spec.loader.exec_module(host)


class HostFilesTests(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.root = Path(folder.name)
        self.source, self.target = self.root/'source', self.root/'installed'
        self.source.mkdir(); self.target.mkdir()
        self.program = (ROOT/'deploy/display/control.py').read_bytes()

    def controller(self, data=None):
        (self.source/'control.py').write_bytes(self.program if data is None else data)
        return self.target/'control.py'

    def check(self):
        return subprocess.run(['sha256sum', '--strict', '--check', '--status',
                               str(self.target/'controller.sha256')], capture_output=True)

    def assert_no_temporary_files(self):
        self.assertEqual(list(self.target.rglob('.*-install-*')), [])

    def test_empty_python_exits_success_but_installer_refuses_it_and_preserves_old_controller(self):
        path = self.controller(b'')
        path.write_bytes(self.program)
        self.assertEqual(subprocess.run([sys.executable, str(self.source/'control.py')]).returncode, 0)
        with self.assertRaisesRegex(ValueError, 'nonempty'):
            host.install_tree(self.source, self.target, 'controller.sha256', display=True)
        self.assertEqual(path.read_bytes(), self.program)
        self.assertFalse((self.target/'controller.sha256').exists())
        self.assert_no_temporary_files()

    def test_valid_python_fragment_without_main_entrypoint_is_refused(self):
        path = self.controller(b'def loop():\n    pass\n')
        path.write_bytes(self.program)
        with self.assertRaisesRegex(ValueError, 'entry point'):
            host.install_tree(self.source, self.target, 'controller.sha256', display=True)
        self.assertEqual(path.read_bytes(), self.program)

    def test_syntax_error_missing_source_and_symlink_are_refused(self):
        for data in [b'def unfinished(', b'\0']:
            self.controller(data)
            with self.assertRaises(SyntaxError):
                host.install_tree(self.source, self.target, 'controller.sha256', display=True)
        (self.source/'control.py').unlink()
        with self.assertRaises(ValueError):
            host.install_tree(self.source, self.target, 'controller.sha256', display=True)
        (self.source/'control.py').symlink_to(ROOT/'deploy/display/control.py')
        with self.assertRaises(ValueError):
            host.install_tree(self.source, self.target, 'controller.sha256', display=True)

    def test_existing_empty_controller_is_repaired_and_coreutils_verifies_actual_installed_bytes(self):
        path = self.controller(); path.write_bytes(b'')
        self.assertEqual(host.install_tree(self.source, self.target, 'controller.sha256', display=True), 1)
        self.assertEqual(path.read_bytes(), self.program)
        self.assertEqual(path.stat().st_mode & 0o777, 0o644)
        self.assertEqual(self.check().returncode, 0)
        path.write_bytes(b'')
        self.assertNotEqual(self.check().returncode, 0)
        self.assert_no_temporary_files()

    def test_byte_change_missing_file_and_empty_inventory_fail_the_same_startup_check(self):
        path = self.controller()
        for operation in ['changed', 'missing', 'inventory']:
            host.install_tree(self.source, self.target, 'controller.sha256', display=True)
            if operation == 'changed': path.write_bytes(self.program.replace(b'80', b'81', 1))
            elif operation == 'missing': path.unlink()
            else: (self.target/'controller.sha256').write_bytes(b'')
            self.assertNotEqual(self.check().returncode, 0, operation)

    def test_failure_staging_second_file_leaves_every_old_file_and_inventory_intact(self):
        self.controller(); (self.source/'second.js').write_text('export const answer=42;\n')
        old = self.target/'control.py'; old.write_bytes(b'previous controller\n')
        inventory = self.target/'controller.sha256'; inventory.write_bytes(b'previous inventory\n')
        original, count = host.prepare, 0
        def no_space(*args):
            nonlocal count
            count += 1
            if count == 2: raise OSError('No space left on device')
            return original(*args)
        with patch.object(host, 'prepare', side_effect=no_space), self.assertRaisesRegex(OSError, 'No space'):
            host.install_tree(self.source, self.target, 'controller.sha256', display=True)
        self.assertEqual(old.read_bytes(), b'previous controller\n')
        self.assertEqual(inventory.read_bytes(), b'previous inventory\n')
        self.assertFalse((self.target/'second.js').exists())
        self.assert_no_temporary_files()

    def test_short_write_or_corruption_of_staged_bytes_is_detected_before_replacement(self):
        path = self.controller(); path.write_bytes(b'old\n')
        original = host.prepare
        def truncate(*args):
            temp = original(*args)
            if args[0].name == 'control.py': temp.write_bytes(b'partial\n')
            return temp
        with patch.object(host, 'prepare', side_effect=truncate), self.assertRaisesRegex(ValueError, 'Staged file checksum'):
            host.install_tree(self.source, self.target, 'controller.sha256', display=True)
        self.assertEqual(path.read_bytes(), b'old\n')
        self.assert_no_temporary_files()

    def test_file_sync_failure_cannot_truncate_the_live_controller(self):
        path = self.controller(); path.write_bytes(b'old\n')
        with patch.object(host.os, 'fsync', side_effect=OSError('sync failed')), self.assertRaises(OSError):
            host.install_tree(self.source, self.target, 'controller.sha256', display=True)
        self.assertEqual(path.read_bytes(), b'old\n')
        self.assert_no_temporary_files()

    def test_abrupt_process_exit_during_staging_never_opens_the_live_file_for_writing(self):
        path = self.controller(); path.write_bytes(b'old\n')
        code = '''import importlib.util,os,sys
from pathlib import Path
spec=importlib.util.spec_from_file_location('host',sys.argv[1]);host=importlib.util.module_from_spec(spec);spec.loader.exec_module(host)
original=host.prepare
def stop(*args):
    original(*args)
    os._exit(99)
host.prepare=stop
host.install_tree(Path(sys.argv[2]),Path(sys.argv[3]),'controller.sha256',display=True)
'''
        result = subprocess.run([sys.executable, '-c', code, str(ROOT/'deploy/host-files.py'),
                                 str(self.source), str(self.target)], capture_output=True, timeout=5)
        self.assertEqual(result.returncode, 99, result.stderr)
        self.assertEqual(path.read_bytes(), b'old\n')
        self.assertFalse((self.target/'controller.sha256').exists())
        host.install_tree(self.source, self.target, 'controller.sha256', display=True)
        self.assertEqual(self.check().returncode, 0)

    def test_directory_sync_failure_after_rename_reports_failure_without_committing_new_inventory(self):
        self.controller()
        with patch.object(host, 'sync_directory', side_effect=OSError('directory sync failed')), self.assertRaises(OSError):
            host.install_tree(self.source, self.target, 'controller.sha256', display=True)
        self.assertFalse((self.target/'controller.sha256').exists())
        self.assert_no_temporary_files()

    def test_replacement_failure_retains_old_file_and_cleans_staging_files(self):
        path = self.controller(); path.write_bytes(b'old\n')
        with patch.object(host.os, 'replace', side_effect=OSError('replace failed')), self.assertRaises(OSError):
            host.install_tree(self.source, self.target, 'controller.sha256', display=True)
        self.assertEqual(path.read_bytes(), b'old\n')
        self.assert_no_temporary_files()

    def test_successful_rename_does_not_hide_corruption_in_the_installed_copy(self):
        path = self.controller(); original = host.os.replace
        def corrupt(source, target):
            original(source, target)
            if target.name == 'control.py': target.write_bytes(b'corrupt\n')
        with patch.object(host.os, 'replace', side_effect=corrupt), self.assertRaisesRegex(ValueError, 'Installed file checksum'):
            host.install_tree(self.source, self.target, 'controller.sha256', display=True)
        self.assertFalse((self.target/'controller.sha256').exists())

    def test_interruption_between_files_cannot_pass_old_inventory_and_rerun_repairs_the_batch(self):
        self.controller(); second = self.source/'second.js'; second.write_text('export const value=1;\n')
        host.install_tree(self.source, self.target, 'controller.sha256', display=True)
        self.controller(self.program+b'\n# revision\n'); second.write_text('export const value=2;\n')
        original, count = host.os.replace, 0
        def interrupt(*args):
            nonlocal count
            count += 1
            if count == 2: raise InterruptedError('simulated interrupted batch')
            return original(*args)
        with patch.object(host.os, 'replace', side_effect=interrupt), self.assertRaises(InterruptedError):
            host.install_tree(self.source, self.target, 'controller.sha256', display=True)
        self.assertNotEqual(self.check().returncode, 0)
        host.install_tree(self.source, self.target, 'controller.sha256', display=True)
        self.assertEqual(self.check().returncode, 0)
        self.assert_no_temporary_files()

    def test_file_and_parent_directory_are_synced_and_inventory_committed_last(self):
        path = self.controller(); events = []
        replace, sync = host.os.replace, host.os.fsync
        def record_sync(fd):
            events.append(('sync', os.readlink(f'/proc/self/fd/{fd}'))); return sync(fd)
        def record_replace(a, b):
            events.append(('replace', str(b))); return replace(a, b)
        with patch.object(host.os, 'fsync', side_effect=record_sync), patch.object(host.os, 'replace', side_effect=record_replace):
            host.install_tree(self.source, self.target, 'controller.sha256', display=True)
        replaces = [event for event in events if event[0] == 'replace']
        self.assertEqual(replaces, [('replace', str(path)), ('replace', str(self.target/'controller.sha256'))])
        self.assertTrue(any(kind == 'sync' and '-install-' in name for kind, name in events[:events.index(replaces[0])]))
        self.assertEqual(events[events.index(replaces[0])+1], ('sync', str(self.target)))

    def test_identical_reinstall_keeps_inodes_and_executable_modes_and_allows_spaces(self):
        script = self.source/'helper name.sh'; script.write_text('#!/bin/sh\nexit 0\n'); script.chmod(0o755)
        host.install_tree(self.source, self.target, 'controller.sha256')
        target = self.target/script.name; inode = target.stat().st_ino
        host.install_tree(self.source, self.target, 'controller.sha256')
        self.assertEqual(target.stat().st_ino, inode)
        self.assertEqual(target.stat().st_mode & 0o777, 0o755)
        self.assertEqual(self.check().returncode, 0)

    def test_link_destinations_and_inventory_injection_do_not_touch_external_file(self):
        self.controller(); outside = self.root/'outside'; outside.write_text('keep\n')
        (self.target/'control.py').symlink_to(outside)
        with self.assertRaises(ValueError): host.install_tree(self.source, self.target, 'controller.sha256', display=True)
        (self.target/'control.py').unlink(); self.target.rmdir(); self.target.symlink_to(self.root)
        with self.assertRaises(ValueError): host.install_tree(self.source, self.target, 'controller.sha256', display=True)
        self.assertEqual(outside.read_text(), 'keep\n')
        with self.assertRaises(ValueError): host.install_tree(self.source, self.root, '../unsafe')

    def test_stale_unavailable_other_process_or_frozen_status_never_passes_as_a_live_controller(self):
        path = self.root/'status.json'
        for patch_value in [dict(observedAt=0), dict(supported=False), dict(pid=43), {}]:
            value = dict(pid=42, supported=True, observedAt=int(time.time()*1000))
            value.update(patch_value); path.write_text(json.dumps(value))
            with patch.object(host.subprocess, 'check_output', return_value='42\n'), \
                 patch.object(host.subprocess, 'run'), self.assertRaises(RuntimeError):
                host.wait_display(path, timeout=.55)
        for value in [[], None, 'invalid']:
            path.write_text(json.dumps(value))
            with patch.object(host.subprocess, 'check_output', return_value='42\n'), \
                 patch.object(host.subprocess, 'run'), self.assertRaises(RuntimeError):
                host.wait_display(path, timeout=.3)

    def test_actual_controller_loop_reports_its_pid_and_advancing_status_without_hardware(self):
        backlight, runtime = self.root/'backlight', self.root/'runtime'
        backlight.mkdir(); runtime.mkdir()
        (backlight/'brightness').write_text('31'); (backlight/'max_brightness').write_text('255')
        (runtime/'ready.json').write_text('{"ready":true}')
        launcher = self.root/'launch.py'
        launcher.write_text('''import importlib.util,sys
from pathlib import Path
spec=importlib.util.spec_from_file_location('control',sys.argv[1])
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
m.BACKLIGHT=Path(sys.argv[2]);m.STATE=Path(sys.argv[3]);m.loop()
''')
        log = self.root/'controller.log'
        with log.open('w') as stream:
            process = subprocess.Popen([sys.executable, str(launcher), str(ROOT/'deploy/display/control.py'),
                                        str(backlight), str(runtime/'status.json')], stdout=stream, stderr=stream)
        def cleanup():
            if process.poll() is None: process.send_signal(signal.SIGTERM)
            process.wait(timeout=3)
        self.addCleanup(cleanup)
        with patch.object(host.subprocess, 'check_output', return_value=str(process.pid)+'\n'), patch.object(host.subprocess, 'run'):
            host.wait_display(runtime/'status.json', timeout=3)
        self.assertIsNone(process.poll(), log.read_text())
        self.assertEqual(json.loads((runtime/'status.json').read_text())['pid'], process.pid)


if __name__ == '__main__': unittest.main()
