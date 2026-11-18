"""Golden register vectors and bus-protocol tests; no hardware is accessed."""
import ctypes
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('power_reader',Path(__file__).resolve().parents[1]/'deploy/power/read.py')
reader=importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)
CONFIG=dict(ina228=True,husb238=True,currentPathVerified=True,voltageSenseVerified=True,startup100W=False)


def ina_registers(amps=2,volts=20,low_range=False):
    scale=78.125e-9 if low_range else 312.5e-9
    shunt=round(amps*.015/scale)&0xfffff
    return {0x3e:(0x5449).to_bytes(2,'big'),0x3f:(0x2281).to_bytes(2,'big'),
            0:(0x10 if low_range else 0).to_bytes(2,'big'),1:(0xfb68).to_bytes(2,'big'),
            0x0b:(3).to_bytes(2,'big'),4:(shunt<<4).to_bytes(3,'big'),
            5:(round(volts/195.3125e-6)<<4).to_bytes(3,'big'),6:(3200).to_bytes(2,'big')}


def bus_fixture(ina=None,pd=None,missing=()):
    trace=[]
    class Bus:
        def read(self,address,register,count):
            trace.append((address,register,count))
            if address in missing:raise OSError('not connected')
            return (ina if address==0x40 else pd)[register]
        def close(self):pass
    return Bus,trace


def pd_registers():
    return {0:b'\x6f',1:b'\x40',2:b'\x8a',3:b'\x8a',4:b'\x00',
            5:b'\x8a',6:b'\x00',7:b'\x8f',8:b'\xa0'}


class PowerReaderTests(unittest.TestCase):
    def test_ina228_20_volt_2_amp_consumption_is_40_watts(self):
        registers=ina_registers()
        registers.update({4:b'\x17\x70\x00',5:b'\x19\x00\x00',6:b'\x0c\x80'})
        bus,_=bus_fixture(registers,pd_registers())
        value=reader.read_ina228(bus().read,CONFIG)
        self.assertEqual(value['status'],'ok')
        self.assertAlmostEqual(value['volts'],20)
        self.assertAlmostEqual(value['amps'],2)
        self.assertAlmostEqual(value['watts'],40)
        self.assertAlmostEqual(value['dieTemperatureC'],25)

    def test_signed_current_and_both_adc_ranges(self):
        for low_range in (False,True):
            for amps in (-2,0,2):
                bus,_=bus_fixture(ina_registers(amps=amps,low_range=low_range),pd_registers())
                value=reader.read_ina228(bus().read,CONFIG)
                self.assertAlmostEqual(value['amps'],amps)
                self.assertAlmostEqual(value['watts'],20*amps)

    def test_wrong_chip_is_not_treated_as_an_ina228(self):
        for register,value in [(0x3e,b'\0\0'),(0x3f,b'\x23\x81')]:
            registers=ina_registers();registers[register]=value
            bus,_=bus_fixture(registers,pd_registers())
            with self.assertRaisesRegex(ValueError,'wrong-device-id'):
                reader.read_ina228(bus().read,CONFIG)

    def test_shutdown_unconverted_memory_error_and_saturation_are_unavailable(self):
        for register,value in [(1,b'\0\0'),(0x0b,b'\0\x01'),(0x0b,b'\0\x02'),
                               (4,b'\x7f\xff\xf0'),(4,b'\x80\0\0')]:
            registers=ina_registers();registers[register]=value
            bus,_=bus_fixture(registers,pd_registers())
            with self.assertRaises(ValueError):reader.read_ina228(bus().read,CONFIG)

    def test_unverified_current_or_voltage_path_does_not_fabricate_zero(self):
        bus,_=bus_fixture(ina_registers(),pd_registers())
        for key in ('currentPathVerified','voltageSenseVerified'):
            value=reader.read_ina228(bus().read,{**CONFIG,key:False})
            self.assertEqual(value['status'],'needs-setup')
            self.assertNotIn('watts',value)
            self.assertEqual(value['missingConfirmations'],['current-path' if key=='currentPathVerified' else 'voltage-sense'])

    def test_unconfirmed_sense_reports_setup_before_any_floating_conversion_values(self):
        registers=ina_registers();registers[0x0b]=b'\0\0'
        bus,trace=bus_fixture(registers,pd_registers())
        value=reader.read_ina228(bus().read,{**CONFIG,'voltageSenseVerified':False})
        self.assertEqual(value['status'],'needs-setup')
        self.assertEqual(trace,[(0x40,0x3e,2),(0x40,0x3f,2)])

    def test_all_pd_voltage_and_current_codes_match_the_register_table(self):
        for code,volts in enumerate((5,9,12,15,18,20),1):
            for i,amps in enumerate((.5,.7,1,1.25,1.5,1.75,2,2.25,2.5,2.75,3,3.25,3.5,4,4.5,5)):
                value=reader.decode_husb238(code<<4|i,0x40,[0]*6,0)
                self.assertEqual(value['volts'],volts)
                self.assertEqual(value['amps'],amps)
                self.assertEqual(value['watts'],volts*amps)

    def test_active_contract_and_offered_profiles_are_separate(self):
        value=reader.decode_husb238(0x6a,0x40,[0x8a,0x8a,0,0,0,0x8f],0xa0)
        self.assertEqual(value['watts'],60)
        self.assertEqual(value['selectedVolts'],20)
        self.assertEqual(value['profiles'][-1],{'volts':20,'amps':5,'watts':100})
        # Response=0 is valid for autonomous DIP-switch startup, not a failed contract.
        self.assertEqual(value['status'],'active')

    def test_detached_no_contract_and_reserved_codes_never_claim_100_watts(self):
        for s0,s1 in [(0x6f,0),(0,0x40)]:
            value=reader.decode_husb238(s0,s1,[0x8f]*6,0)
            self.assertIsNone(value['watts'])
        for s0,s1 in [(0xff,0xff),(0x6f,0x50)]:
            with self.assertRaises(ValueError):reader.decode_husb238(s0,s1,[0]*6,0)

    def test_pd_changing_during_read_does_not_publish_a_mixed_contract(self):
        calls=0
        def read(address,register,count):
            nonlocal calls
            if register==0:
                calls+=1;return b'\x6f' if calls==1 else b'\x2a'
            return pd_registers()[register]
        self.assertEqual(reader.read_husb238(read)['status'],'changing')

    def test_one_failed_board_does_not_hide_the_other_board(self):
        for missing,key,other in [(0x40,'ina228','pd'),(8,'pd','ina228')]:
            bus,_=bus_fixture(ina_registers(),pd_registers(),(missing,))
            value=reader.collect(CONFIG,bus,now=lambda:1000)
            self.assertEqual(value[key]['status'],'error')
            self.assertNotIn('watts',value[key])
            self.assertIn(value[other]['status'],('ok','active'))

    def test_close_error_does_not_stop_collection_of_the_other_board(self):
        bus,_=bus_fixture(ina_registers(),pd_registers())
        class ClosingBus(bus):
            def close(self):raise OSError('close failed')
        value=reader.collect(CONFIG,ClosingBus,now=lambda:1000)
        self.assertEqual(value['ina228']['error'],'i2c-unavailable')
        self.assertEqual(value['pd']['error'],'i2c-unavailable')
        self.assertEqual(value['observedAt'],1000)

    def test_changing_ina_configuration_is_not_a_mixed_scale_measurement(self):
        registers=ina_registers();reads=0
        def read(address,register,count):
            nonlocal reads
            if register==0:
                reads+=1
                if reads==2:return b'\0\x10'
            return registers[register]
        with self.assertRaisesRegex(ValueError,'configuration-changed'):
            reader.read_ina228(read,CONFIG)

    def test_settings_are_bounded_and_loading_does_not_touch_hardware(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'settings.json'
            self.assertEqual(reader.load_settings(path),reader.DEFAULTS)
            for text in ('x'*4097,'{"ina228":1}','[]','{'):
                path.write_text(text)
                with self.assertRaises(ValueError):reader.load_settings(path)
            path.write_text(json.dumps(CONFIG))
            self.assertEqual(reader.load_settings(path),CONFIG)

    def test_disabled_readers_never_open_the_bus_and_voltage_requests_are_invalid(self):
        value=reader.collect(reader.DEFAULTS,lambda: self.fail('unexpected bus access'))
        self.assertEqual(value['ina228']['status'],'disabled')
        for value in ({'requestVolts':20},{'ina228':1},{'husb238':'yes'},[]):
            with self.assertRaises(ValueError):reader.settings(value)

    def test_bus_uses_only_register_pointer_then_read_and_respects_kernel_ownership(self):
        calls=[]
        def ioctl(fd,command,arg):
            calls.append(command)
            if command==0x0707:
                self.assertEqual(arg.nmsgs,2)
                self.assertEqual([m.flags for m in arg.msgs[:2]],[0,1])
                self.assertEqual(arg.msgs[0].len,1)
                self.assertEqual(ctypes.string_at(arg.msgs[0].buf,1),b'\x05')
                ctypes.memmove(arg.msgs[1].buf,b'\x19\0\0',3)
                return 2
        with patch.object(reader.os,'open',return_value=7),patch.object(reader.os,'close'),patch.object(reader.fcntl,'ioctl',side_effect=ioctl):
            bus=reader.Bus()
            self.assertEqual(bus.read(0x40,5,3),b'\x19\0\0')
            for address,register in [(8,9),(0x4c,0),(0x40,2)]:
                with self.assertRaises(ValueError):bus.read(address,register,1)
            bus.close()
        self.assertEqual(calls,[0x0703,0x0707])

    def test_partial_i2c_transfer_is_not_a_zero_measurement(self):
        for completed in (0,1):
            with patch.object(reader.os,'open',return_value=7),patch.object(reader.os,'close'),patch.object(reader.fcntl,'ioctl',return_value=completed):
                bus=reader.Bus()
                with self.assertRaisesRegex(OSError,'Incomplete I2C transfer'):
                    bus.read(0x40,5,3)
                bus.close()

    def test_atomic_json_retains_units_and_private_group_read_permission(self):
        bus,_=bus_fixture(ina_registers(),pd_registers())
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'readings.json';value=reader.collect(CONFIG,bus,now=lambda:1000)
            reader.publish(value,path)
            self.assertEqual(json.loads(path.read_text()),value)
            self.assertEqual(path.stat().st_mode&0o777,0o640)
            self.assertFalse(path.with_suffix('.tmp').exists())


if __name__=='__main__':unittest.main()
