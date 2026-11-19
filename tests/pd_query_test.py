"""HUSB238 Get_SRC_Cap and maximum-20V policy, with no live I2C access."""
import ctypes
import unittest
from unittest.mock import patch
import pd_request_test as original
import pd60_request_test as offered

pd, reader, guard = original.pd, original.reader, original.guard


class SourceQueryTests(unittest.TestCase):
    def refresh(self, frames, events=None):
        events = [] if events is None else events
        values, clock, latest = iter(frames), original.Clock(), None
        def sample(_):
            nonlocal latest
            latest = next(values, latest)
            return latest
        with patch.object(pd, 'read_husb238', side_effect=sample):
            result = pd.refresh_source(None, lambda: events.append('Get_SRC_Cap'),
                        lambda: events.append('durable-query'), clock.now, clock.wait)
        self.assertLess(clock.value, 4.1)
        return result

    def test_query_can_refresh_the_known_60w_offer_to_a_synthetic_100w_offer(self):
        before = original.frame(offered=3, response=1)
        after = original.frame(offered=5, response=1)
        events = []
        self.assertEqual(self.refresh([before, after, after], events), after)
        self.assertEqual(events, ['durable-query', 'Get_SRC_Cap'])

    def test_unchanged_60w_remains_60w_without_claiming_an_unoffered_100w(self):
        value = self.refresh([original.frame(offered=3, response=1)])
        self.assertEqual(pd.offered_20v(value), dict(volts=20, amps=3, watts=60))
        self.assertEqual(value['amps'], 1.25)  # Active contract is still 25W.

    def test_non_20v_rail_never_sends_even_the_query(self):
        for value in [original.frame(volts=5), original.frame(volts=15), dict(status='changing'), dict(status='detached')]:
            events = []
            with self.subTest(value=value), self.assertRaises(ValueError): self.refresh([value], events)
            self.assertEqual(events, [])

    def test_nonresponse_rejection_or_voltage_change_stops_after_one_query(self):
        initial = original.frame(response=1)
        for after in [original.frame(), original.frame(response=3), original.frame(response=4), original.frame(response=5),
                      original.frame(volts=5), dict(status='detached'), dict(status='changing'),
                      original.frame(offered=1.25, response=1)]:
            events = []
            with self.subTest(after=after), self.assertRaises(ValueError): self.refresh([initial, after], events)
            self.assertEqual(events, ['durable-query', 'Get_SRC_Cap'])

    def test_two_matching_samples_are_required_after_the_query(self):
        before = original.frame(response=1, offered=3)
        after = original.frame(response=1, offered=5)
        result = self.refresh([before, after, dict(status='changing'), before, after, after])
        self.assertEqual(result, after)

    def test_ambiguous_or_unknown_20v_offers_are_rejected(self):
        for profiles in [[], [dict(volts=20, amps=3), dict(volts=20, amps=5)],
                         [dict(volts=20, amps=True)], [dict(volts=20, amps=3.1)]]:
            with self.assertRaises(ValueError): pd.offered_20v(dict(status='active', volts=20, profiles=profiles))


class QueryWorkerTests(unittest.TestCase):
    def setUp(self):
        offered.OfferedProfileWorkerTests.setUp(self)
        original_bus, owner = self.Bus, self
        self.queries, self.start_amps, self.after_query_offer = [], 1.25, None
        class Bus(original_bus):
            def query_source(self):
                original_bus.query_source(self)
                owner.queries.append('Get_SRC_Cap')
                if owner.after_query_offer is not None: owner.offered = owner.after_query_offer
            def read(self, address, register, count):
                if register == 0 and not self.ready:
                    return bytes([0x60 | reader.CURRENTS.index(owner.start_amps)])
                return super().read(address, register, count)
        self.Bus = Bus

    job = offered.OfferedProfileWorkerTests.job
    run_worker = offered.OfferedProfileWorkerTests.run_worker

    def discover_job(self, **changes):
        pd.atomic_json(self.runtime/'request.json', dict(id='b'*32, operation='discover', expiresAt=11000, **changes))

    def test_discovery_uses_only_get_source_caps_and_never_qualifies_a_pdo(self):
        self.after_query_offer = 5; self.discover_job()
        self.assertTrue(self.run_worker())
        result = pd.read_json(self.runtime/'result.json')
        self.assertEqual(result['status'], 'discovered'); self.assertEqual(result['profile']['watts'], 100)
        self.assertEqual(result['pd']['amps'], 1.25)
        self.assertEqual(self.queries, ['Get_SRC_Cap']); self.assertEqual(self.sent, [])
        self.assertFalse(pd.profile_qualified(pd.read_json(self.state/'qualification.json')))
        self.assertFalse((self.runtime/'startup.json').exists())
        self.assertFalse(self.run_worker()); self.assertEqual(len(self.queries), 1)

    def test_discovery_preserves_only_a_still_matching_previous_contract_proof(self):
        self.job(strategy='maximum20v'); self.assertTrue(self.run_worker())
        proof = pd.read_json(self.state/'qualification.json'); self.start_amps = 3
        self.discover_job(); self.assertTrue(self.run_worker())
        self.assertEqual(pd.read_json(self.state/'qualification.json'), proof)
        self.start_amps = 1.25; self.discover_job(); self.assertTrue(self.run_worker())
        self.assertFalse(pd.profile_qualified(pd.read_json(self.state/'qualification.json')))

    def test_fresh_discovery_and_request_each_query_once_then_verify_actual_100w(self):
        self.after_query_offer = 5; self.discover_job(); self.assertTrue(self.run_worker())
        self.job(amps=5, cable5AVerified=True, strategy='maximum20v'); self.assertTrue(self.run_worker())
        proof = pd.read_json(self.state/'qualification.json')
        self.assertTrue(pd.maximum_qualified(proof)); self.assertEqual(proof['watts'], 100)
        self.assertEqual(self.queries, ['Get_SRC_Cap', 'Get_SRC_Cap']); self.assertEqual(self.sent, [True])

    def test_maximum_request_cannot_silently_change_the_manually_confirmed_current(self):
        self.after_query_offer = 5; self.job(strategy='maximum20v')
        self.assertFalse(self.run_worker()); self.assertEqual(self.sent, [])
        self.assertIn('changed', pd.read_json(self.runtime/'result.json')['error'])

    def test_opted_in_maximum_startup_tracks_3a_to_5a_and_back_with_cable_proof(self):
        self.job(strategy='maximum20v', cable5AVerified=True); self.assertTrue(self.run_worker())
        self.config['startupMaximum20V'] = True
        for amps in (5, 3, 4, 5):
            self.after_query_offer = amps
            self.assertTrue(self.run_worker('startup'))
            proof = pd.read_json(self.state/'qualification.json')
            self.assertEqual(proof['amps'], amps); self.assertTrue(pd.maximum_qualified(proof))
            self.assertTrue(guard.allowed(self.config, proof, proof, 9000, 'boot60'))
        self.assertEqual(len(self.sent), 5); self.assertEqual(len(self.queries), 5)

    def test_60w_cable_confirmation_cannot_authorize_future_5a_current(self):
        self.job(strategy='maximum20v'); self.assertTrue(self.run_worker())
        self.config['startupMaximum20V'] = True; self.after_query_offer = 5
        self.assertFalse(self.run_worker('startup')); self.assertEqual(self.sent, [True])
        self.assertIn('5 A e-marked', pd.read_json(self.runtime/'startup.json')['error'])
        self.assertFalse(self.run_worker('startup', open_bus=lambda: self.fail('failed setup must not retry')))

    def test_legacy_proof_cannot_enable_the_new_maximum_policy(self):
        self.job(); self.assertTrue(self.run_worker()); self.config['startupMaximum20V'] = True
        proof = pd.read_json(self.state/'qualification.json')
        self.assertFalse(guard.allowed(self.config, proof, proof, 9000, 'boot60'))
        self.assertFalse(self.run_worker('startup', open_bus=lambda: self.fail('no max proof')))

    def test_interrupted_query_is_journalled_before_go4_and_blocks_startup_retry(self):
        class PowerLost(BaseException): pass
        query = self.Bus.query_source
        def fail(bus): query(bus); raise PowerLost()
        self.job(strategy='maximum20v')
        with patch.object(self.Bus, 'query_source', fail), self.assertRaises(PowerLost): self.run_worker()
        self.assertEqual(pd.read_json(self.state/'qualification.json')['phase'], 'querying')
        self.config['startupMaximum20V'] = True
        for _ in range(2): self.assertFalse(self.run_worker('startup', open_bus=lambda: self.fail('interrupted query')))
        self.assertEqual(len(self.queries), 1); self.assertEqual(self.sent, [])

    def test_invalid_discovery_jobs_and_arbitrary_strategy_never_open_i2c(self):
        for extra in [dict(confirmed=True), dict(volts=5), dict(strategy='maximum20v'), dict(amps=5)]:
            self.discover_job(**extra)
            self.assertFalse(self.run_worker(open_bus=lambda: self.fail('invalid discovery')))
        for strategy in ['automatic', 'maximum5v', True]:
            self.job(strategy=strategy)
            self.assertFalse(self.run_worker(open_bus=lambda: self.fail('invalid strategy')))


if __name__ == '__main__': unittest.main()
