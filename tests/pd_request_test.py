"""Fixed-PDO requests, interruption recovery and player startup; no hardware."""
import ctypes
import fcntl
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT/path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


reader = module('pd_reader_fixture', 'deploy/power/read.py')
with patch.dict('sys.modules', {'read': reader}):
    pd = module('pd_fixture', 'deploy/power/pd_request.py')
    with patch.dict('sys.modules', {'pd_request': pd}):
        guard = module('pd_guard_fixture', 'deploy/power/player_power_guard.py')


def frame(volts=20, amps=1.25, response=0, offered=5, **changes):
    return dict(status='active', volts=volts, amps=amps, responseCode=response,
                profiles=[dict(volts=20, amps=offered)], **changes)


class Clock:
    def __init__(self): self.value = 0
    def now(self): return self.value
    def wait(self, seconds): self.value += seconds


class PdNegotiationTests(unittest.TestCase):
    def request(self, frames, send=None, before=None):
        clock = Clock()
        values = iter(frames)
        latest = None

        def read(_):
            nonlocal latest
            latest = next(values, latest)
            return latest

        with patch.object(pd, 'read_husb238', side_effect=read):
            return pd.negotiate(None, send or (lambda: None), before or (lambda: None), clock.now, clock.wait)

    def test_25_watt_startup_becomes_100_only_after_two_successful_readbacks(self):
        events = []
        result = self.request([frame(), frame(), frame(amps=5, response=1), frame(amps=5, response=1)],
                              lambda: events.append('request'), lambda: events.append('durable-intent'))
        self.assertEqual(events, ['durable-intent', 'request'])
        self.assertEqual(result, dict(volts=20, amps=5, watts=100, requested=True))

    def test_existing_100_watt_contract_is_idempotent(self):
        result = self.request([frame(amps=5)], lambda: self.fail('no request needed'), lambda: self.fail('no intent needed'))
        self.assertFalse(result['requested'])

    def test_lower_voltage_or_lower_offered_current_never_sends_request(self):
        for value in [frame(volts=5), frame(volts=15), frame(offered=3), dict(status='detached'), dict(status='changing')]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                self.request([value], lambda: self.fail('must not request'))

    def test_source_is_checked_again_immediately_before_writing(self):
        with self.assertRaises(ValueError):
            self.request([frame(), frame(offered=3)], lambda: self.fail('source changed'))

    def test_acknowledgement_without_100_watt_readback_is_not_success(self):
        for value in [frame(response=1), frame(amps=5, response=0), dict(status='changing')]:
            events = []
            with self.subTest(value=value), self.assertRaisesRegex(ValueError, 'not confirmed'):
                self.request([frame(), frame(), value], lambda: events.append('request'))
            self.assertEqual(events, ['request'])

    def test_a_single_100_watt_sample_or_interrupted_sequence_is_not_stable(self):
        with self.assertRaisesRegex(ValueError, 'not confirmed'):
            self.request([frame(), frame(), frame(amps=5, response=1), frame(response=1)])

    def test_transient_attachment_changes_can_settle_without_sending_another_request(self):
        sent = []
        result = self.request([frame(), frame(), dict(status='detached'), dict(status='attached'),
                               frame(amps=5, response=1), dict(status='changing'),
                               frame(amps=5, response=1), frame(amps=5, response=1)],
                              lambda: sent.append(1))
        self.assertEqual(result['watts'], 100)
        self.assertEqual(sent, [1])

    def test_every_failure_response_stops_without_a_reset_or_retry(self):
        for response in (3, 4, 5):
            sent = []
            with self.subTest(response=response), self.assertRaisesRegex(ValueError, 'rejected'):
                self.request([frame(), frame(), frame(response=response)], lambda: sent.append(1))
            self.assertEqual(sent, [1])

    def test_only_source_query_fixed_20v_selection_and_go_writes_are_possible(self):
        writes, commands = [], []

        def ioctl(fd, command, value):
            commands.append(command)
            if command == 0x0703:
                self.assertEqual(value, 8)
            elif command == 0x0707:
                self.assertEqual(value.nmsgs, 1)
                message = value.msgs[0]
                self.assertEqual((message.addr, message.flags, message.len), (8, 0, 2))
                writes.append(ctypes.string_at(message.buf, 2))
                return 1

        with patch.object(pd.os, 'open', return_value=7), patch.object(pd.os, 'close'), patch.object(pd.fcntl, 'ioctl', side_effect=ioctl):
            bus = pd.RequestBus()
            bus.query_source()
            bus.request_20v()
            for register, value in [(9, 0x10), (9, 2), (8, 0x10), (0, 0), (8, 0xa1)]:
                with self.assertRaises(ValueError): bus._fixed_write(register, value)
            bus.close()
        self.assertEqual(writes, [b'\x09\x04', b'\x08\xa0', b'\x09\x01'])
        self.assertNotIn(0x0706, commands)  # I2C_SLAVE_FORCE is forbidden.

    def test_partial_write_stops_before_go(self):
        for completed in (0, 2):
            commands = []
            def ioctl(fd, command, value):
                commands.append(command)
                return completed
            with patch.object(pd.os, 'open', return_value=7), patch.object(pd.os, 'close'), patch.object(pd.fcntl, 'ioctl', side_effect=ioctl):
                bus = pd.RequestBus()
                with self.assertRaisesRegex(OSError, 'Incomplete'): bus.request_20v()
                self.assertEqual(commands, [0x0703, 0x0707])
                bus.close()


class PdWorkerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.state, self.runtime = Path(self.temp.name)/'state', Path(self.temp.name)/'runtime'
        self.state.mkdir(); self.runtime.mkdir()
        self.config = dict(reader.DEFAULTS, husb238=True)
        self.sent, self.closed = [], []
        owner = self

        class Bus:
            def __init__(self): self.ready = False; self.queried = False
            def read(self, address, register, count):
                owner.assertEqual(address, 8)
                return {0: b'\x6f' if self.ready else b'\x63', 1: b'\x48' if self.ready or self.queried else b'\x40',
                        2:b'\x8a', 3:b'\0', 4:b'\0', 5:b'\0', 6:b'\0', 7:b'\x8f', 8:b'\xa0'}[register]
            def query_source(self):
                owner.assertEqual(pd.read_json(owner.state/'qualification.json')['phase'], 'querying')
                self.queried = True
            def request_20v(self):
                owner.assertEqual(pd.read_json(owner.state/'qualification.json')['phase'], 'requesting')
                owner.sent.append(1)
                self.ready = True
            def close(self): owner.closed.append(1)
        self.Bus = Bus

    def job(self, **changes):
        value = dict(id='a'*32, confirmed=True, cable5AVerified=True, expiresAt=11000)
        pd.atomic_json(self.runtime/'request.json', dict(value, **changes))

    def run_worker(self, mode='manual', **changes):
        args = dict(state_dir=self.state, runtime=self.runtime, open_bus=self.Bus,
                    now=lambda: 10000, boot_id='boot-1', uptime_ms=lambda: 3000)
        args.update(changes)
        return pd.run(mode, self.config, **args)

    def test_manual_confirmation_is_consumed_and_verified_state_is_persisted(self):
        self.job()
        self.assertTrue(self.run_worker())
        self.assertEqual(self.sent, [1]); self.assertEqual(self.closed, [1])
        self.assertFalse((self.runtime/'request.json').exists())
        value = pd.read_json(self.runtime/'result.json')
        self.assertTrue(pd.qualified(value)); self.assertEqual(value['requestId'], 'a'*32)
        self.assertEqual(value, pd.read_json(self.state/'qualification.json'))
        self.assertEqual(value, pd.read_json(self.runtime/'startup.json'))
        self.assertFalse(self.run_worker())  # No reusable job.
        self.assertEqual(self.sent, [1])
        self.assertEqual(pd.read_json(self.state/'qualification.json'), value)

    def test_unconfirmed_stale_expired_and_arbitrary_manual_jobs_do_not_open_bus(self):
        for changes in [dict(confirmed=False), dict(cable5AVerified=False), dict(expiresAt=9999), dict(expiresAt=41000), dict(expiresAt=True), dict(id='../etc/passwd'), dict(volts=20)]:
            self.job(**changes)
            self.assertFalse(self.run_worker(open_bus=lambda: self.fail('invalid job')))
            self.assertFalse((self.state/'qualification.json').exists())

    def test_power_loss_during_request_blocks_every_automatic_retry(self):
        class PowerLost(BaseException): pass
        original = self.Bus.request_20v
        def fail(bus):
            original(bus)
            raise PowerLost()
        self.job()
        with patch.object(self.Bus, 'request_20v', fail), self.assertRaises(PowerLost):
            self.run_worker()
        self.assertEqual(pd.read_json(self.state/'qualification.json')['phase'], 'requesting')
        self.config['startup100W'] = True
        for _ in range(2):
            self.assertFalse(self.run_worker('startup', open_bus=lambda: self.fail('interrupted request must not retry')))
        self.assertEqual(pd.read_json(self.state/'qualification.json')['phase'], 'requesting')
        self.assertEqual(self.sent, [1])
        self.job()
        self.assertTrue(self.run_worker())  # A fresh explicit manual confirmation can recover.

    def test_startup_policy_is_off_by_default_and_never_opens_bus(self):
        self.assertTrue(self.run_worker('startup', open_bus=lambda: self.fail('policy is off')))
        self.assertEqual(pd.read_json(self.runtime/'startup.json')['status'], 'not-requested')

    def test_first_automatic_request_requires_previously_verified_hardware(self):
        self.config['startup100W'] = True
        self.assertFalse(self.run_worker('startup', open_bus=lambda: self.fail('not qualified')))
        self.job(); self.assertTrue(self.run_worker())
        self.assertTrue(self.run_worker('startup'))
        self.assertEqual(self.sent, [1, 1])  # One request per explicitly authorized invocation.

    def test_i2c_error_invalidates_qualification_and_is_not_retried(self):
        self.job(); self.assertTrue(self.run_worker())
        def missing(): raise OSError('device not present')
        self.config['startup100W'] = True
        self.assertFalse(self.run_worker('startup', open_bus=missing))
        self.assertFalse(pd.qualified(pd.read_json(self.state/'qualification.json')))
        self.assertFalse(self.run_worker('startup', open_bus=lambda: self.fail('failed setup is blocked')))

    def test_concurrent_worker_does_not_overwrite_qualification_or_request(self):
        self.job(); before = dict(phase='requesting', qualified=False)
        pd.atomic_json(self.state/'qualification.json', before)
        with open(self.state/'request.lock', 'w') as lock:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            self.assertFalse(self.run_worker(open_bus=lambda: self.fail('busy')))
        self.assertEqual(pd.read_json(self.state/'qualification.json'), before)
        self.assertTrue((self.runtime/'request.json').exists())

    def test_bounded_json_rejects_symlinks_nonobjects_directories_and_oversized_files(self):
        path = self.runtime/'file'; path.write_text('{}')
        link = self.runtime/'link'; link.symlink_to(path)
        for invalid in [link, self.runtime, self.runtime/'missing']:
            self.assertIsNone(pd.read_json(invalid))
        for text in ['[]', 'null', 'false', '{', 'x'*8193]:
            path.write_text(text); self.assertIsNone(pd.read_json(path))
        pd.atomic_json(path, dict(volts=20))
        self.assertEqual(pd.read_json(path), dict(volts=20))
        self.assertEqual(path.stat().st_mode & 0o777, 0o644)
        self.assertEqual(list(self.runtime.glob('*.tmp')), [])

    def test_player_guard_needs_same_boot_proof_only_when_policy_is_on(self):
        self.assertTrue(guard.allowed(self.config, {}))
        self.job(); self.assertTrue(self.run_worker())
        self.config['startup100W'] = True
        value = pd.read_json(self.runtime/'startup.json')
        # Later player restarts must still work; wall-clock/NTP changes are irrelevant.
        self.assertTrue(guard.allowed(self.config, value, value, 900000, 'boot-1'))
        for changes in [dict(bootId='previous-boot'), dict(qualified=False), dict(source='fake'), dict(phase='requesting'), dict(observedMonotonicMs=900001), dict(observedMonotonicMs=-1), dict(observedMonotonicMs=True), dict(amps=1.25)]:
            self.assertFalse(guard.allowed(self.config, dict(value, **changes), value, 900000, 'boot-1'))
        # A subsequent failed or interrupted request must invalidate the old
        # same-boot startup file, including a crash between the two file writes.
        for proof in [None, {}, dict(value, phase='requesting'), dict(value, phase='failed'), dict(value, requestId='b'*32)]:
            self.assertFalse(guard.allowed(self.config, value, proof, 900000, 'boot-1'))

    def test_failed_manual_reconfiguration_cannot_reuse_an_old_successful_player_proof(self):
        self.job(); self.assertTrue(self.run_worker())
        old_result = pd.read_json(self.runtime/'startup.json')
        self.job()
        def missing(): raise OSError('i2c device disappeared')
        self.assertFalse(self.run_worker(open_bus=missing))
        self.config['startup100W'] = True
        self.assertFalse(guard.allowed(self.config, old_result, pd.read_json(self.state/'qualification.json'), 900000, 'boot-1'))


if __name__ == '__main__': unittest.main()
