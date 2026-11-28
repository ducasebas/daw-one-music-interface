"""Actual observed 3A source, fixed 20V requests and startup limits; register fixtures only."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import pd_request_test as original
pd, reader, guard = original.pd, original.reader, original.guard

class OfferedProfileNegotiationTests(unittest.TestCase):
    def request(self, frames, amps=3, events=None):
        clock=original.Clock();values=iter(frames);latest=None
        def read(_):
            nonlocal latest
            latest=next(values,latest);return latest
        events=[] if events is None else events
        with patch.object(pd,'read_husb238',side_effect=read):
            return pd.negotiate(None,lambda:events.append('request'),lambda:events.append('intent'),clock.now,clock.wait,target_amps=amps)

    def test_each_offered_profile_is_verified_exactly_and_60w_needs_no_100w_offer(self):
        for amps in pd.REQUEST_AMPS:
            with self.subTest(amps=amps):
                before=original.frame(offered=amps);after=original.frame(amps=amps,offered=amps,response=1);events=[]
                result=self.request([before,before,after,after],amps,events)
                self.assertEqual(result,dict(volts=20,amps=amps,watts=20*amps,requested=True))
                self.assertEqual(events,['intent','request'])

    def test_a_different_offer_before_or_after_go_never_escalates_the_confirmed_target(self):
        before=original.frame(offered=3);changed=original.frame(offered=5)
        for frames in [[changed],[before,changed],[before,before,changed]]:
            events=[]
            with self.assertRaises(ValueError):self.request(frames,events=events)
            self.assertLessEqual(events.count('request'),1)
            if len(frames)<3:self.assertNotIn('request',events)

    def test_ack_only_and_one_success_sample_cannot_claim_60w(self):
        before=original.frame(offered=3)
        for frames in [[before,before,original.frame(offered=3,response=1)],
                       [before,before,original.frame(offered=3,amps=3,response=0)],
                       [before,before,original.frame(offered=3,amps=3,response=1),before]]:
            events=[]
            with self.assertRaisesRegex(ValueError,'not confirmed'):self.request(frames,events=events)
            self.assertEqual(events,['intent','request'])

    def test_existing_60w_contract_is_read_twice_without_any_new_request(self):
        events=[];result=self.request([original.frame(amps=3,offered=3,response=1)],events=events)
        self.assertFalse(result['requested']);self.assertEqual(events,[])

    def test_only_20v_and_the_documented_supported_currents_are_allowed(self):
        for amps in [1.25,2,3.1,6,'3',True,float('nan')]:
            events=[]
            with self.assertRaises(ValueError):self.request([original.frame(offered=amps)],amps,events)
            self.assertEqual(events,[])
    def test_upgrade_from_15v_to_20v_60w_succeeds(self):
        events=[]
        result=self.request([original.frame(volts=15,amps=3,offered=3,response=1),
                             original.frame(volts=15,amps=3,offered=3,response=1),
                             original.frame(volts=20,amps=3,offered=3,response=1),
                             original.frame(volts=20,amps=3,offered=3,response=1)],3,events)
        self.assertEqual(result,dict(volts=20,amps=3,watts=60,requested=True))
        self.assertEqual(events,['intent','request'])

class OfferedProfileWorkerTests(unittest.TestCase):
    def setUp(self):
        temp=tempfile.TemporaryDirectory();self.addCleanup(temp.cleanup)
        self.state=Path(temp.name)/'state';self.runtime=Path(temp.name)/'runtime';self.state.mkdir();self.runtime.mkdir()
        self.config={**reader.DEFAULTS,'husb238':True};self.sent=[];self.offered=3;owner=self
        class Bus:
            def __init__(self):self.ready=False
            def read(self,address,register,count):
                owner.assertEqual(address,8);owner.assertEqual(count,1)
                current=reader.CURRENTS.index(owner.offered)
                return bytes([{0:0x60|current if self.ready else 0x63,1:0x4f,2:0x8a,3:0x8a,4:0,5:0x8a,6:0,7:0x80|current,8:0xa0}[register]])
            def query_source(self):
                owner.assertEqual(pd.read_json(owner.state/'qualification.json')['phase'],'querying')
            def request_20v(self):
                owner.assertEqual(pd.read_json(owner.state/'qualification.json')['phase'],'requesting');owner.sent.append(True);self.ready=True
            def close(self):pass
        self.Bus=Bus
    def job(self,**changes):
        pd.atomic_json(self.runtime/'request.json',{**dict(id='b'*32,confirmed=True,cable5AVerified=False,expiresAt=11000,amps=3),**changes})
    def run_worker(self,mode='manual',**changes):
        args=dict(state_dir=self.state,runtime=self.runtime,open_bus=self.Bus,now=lambda:10000,boot_id='boot60',uptime_ms=lambda:3000);args.update(changes)
        return pd.run(mode,self.config,**args)
    def test_manual_60w_qualification_is_persisted_without_claiming_100w_or_vbus_wiring(self):
        self.job();self.assertTrue(self.run_worker());p=pd.read_json(self.state/'qualification.json')
        self.assertTrue(pd.profile_qualified(p));self.assertFalse(pd.qualified(p));self.assertFalse(p['cable5AVerified']);self.assertEqual(p['watts'],60)
        self.assertNotIn('voltageSenseVerified',p);self.assertEqual(self.sent,[True])
        self.assertFalse(self.run_worker());self.assertEqual(self.sent,[True])
    def test_legacy_100w_jobs_never_downgrade_to_the_60w_offer(self):
        pd.atomic_json(self.runtime/'request.json',dict(id='b'*32,confirmed=True,cable5AVerified=True,expiresAt=11000))
        self.assertFalse(self.run_worker());self.assertEqual(self.sent,[])
    def test_more_than_3a_requires_the_separate_5a_cable_confirmation(self):
        for amps in [3.25,3.5,4,4.5,5]:
            pd.atomic_json(self.runtime/'request.json',dict(id='b'*32,confirmed=True,cable5AVerified=False,expiresAt=11000,amps=amps))
            self.assertFalse(self.run_worker(open_bus=lambda:self.fail('not confirmed')))
        self.assertEqual(self.sent,[])
    def test_startup_requires_opt_in_and_repeats_only_the_verified_60w_profile(self):
        self.assertTrue(self.run_worker('startup',open_bus=lambda:self.fail('policy off')))
        self.job();self.assertTrue(self.run_worker());self.config['startup20V']=True
        self.assertTrue(self.run_worker('startup'));p=pd.read_json(self.state/'qualification.json')
        self.assertEqual(p['watts'],60);self.assertEqual(self.sent,[True,True])
        self.assertTrue(guard.allowed(self.config,p,p,9000,'boot60'))
        self.config['startup20V']=False;self.config['startup100W']=True
        self.assertFalse(guard.allowed(self.config,p,p,9000,'boot60'))
        self.assertFalse(self.run_worker('startup',open_bus=lambda:self.fail('60W is not 100W')))
    def test_a_changed_source_blocks_startup_before_any_request_and_invalidates_the_old_player_proof(self):
        self.job();self.assertTrue(self.run_worker());old=pd.read_json(self.runtime/'startup.json');self.config['startup20V']=True;self.offered=5
        self.assertFalse(self.run_worker('startup'));self.assertEqual(self.sent,[True])
        self.assertFalse(guard.allowed(self.config,old,pd.read_json(self.state/'qualification.json'),9000,'boot60'))
    def test_interruption_cannot_cause_a_startup_retry_loop(self):
        class PowerLost(BaseException):pass
        send=self.Bus.request_20v
        def interrupt(bus):send(bus);raise PowerLost()
        self.job()
        with patch.object(self.Bus,'request_20v',interrupt),self.assertRaises(PowerLost):self.run_worker()
        self.config['startup20V']=True
        for _ in range(2):self.assertFalse(self.run_worker('startup',open_bus=lambda:self.fail('interrupted')))
        self.assertEqual(self.sent,[True]);self.assertEqual(pd.read_json(self.state/'qualification.json')['phase'],'requesting')
    def test_legacy_settings_default_to_new_policy_off_and_conflicting_policies_are_rejected(self):
        legacy=dict(ina228=True,husb238=True,currentPathVerified=True,voltageSenseVerified=False,startup100W=True)
        self.assertFalse(reader.settings(legacy)['startup20V'])
        with self.assertRaises(ValueError):reader.settings({**legacy,'startup20V':True})
        for changes in [dict(watts=100),dict(amps=5),dict(status='error'),dict(phase='failed')]:
            self.job();self.assertTrue(self.run_worker());p=pd.read_json(self.state/'qualification.json')
            self.assertFalse(pd.profile_qualified({**p,**changes}))

if __name__=='__main__':unittest.main()
