"""Exercise DSP commands with the GNU argument parser used by Linux amixer."""
import json
from pathlib import Path
import shlex
import shutil
import subprocess
import sys
import unittest


ROOT = Path(__file__).resolve().parents[1]
AMIXER_OPTIONS = 'hc:D:qidnva:sf:RM'
FIXTURE = r"""
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {dspController} from './deploy/manager/dsp.mjs';

const integer=(id,name,min,max,value)=>`numid=${id},iface=MIXER,name='${name}'\n ; type=INTEGER,access=rw---,values=1,min=${min},max=${max}\n : values=${value}\n`;
const equalizer="numid=22,iface=MIXER,name='Equalizer'\n ; type=ENUMERATED,access=rw------,values=1,items=2\n ; Item #0 'On'\n ; Item #1 'Off'\n : values=0\n";
const results={};
for(const scenario of ['cuts','headroom','rollback','standby']){
 const dir=mkdtempSync(join(tmpdir(),'tunebox-dsp-argv-'));
 const initial={1:-2,2:0,3:-8,4:-8},values={...initial},calls=[];
 let failed=false,error=null;
 const contents=()=>integer(1,'00020 Hz',-15,15,values[1])+integer(2,'00032 Hz',-15,15,values[2])+integer(3,'Channel Left Gain',-110,0,values[3])+integer(4,'Channel Right Gain',-110,0,values[4])+equalizer;
 const run=async(program,args)=>{
  if(program!=='/usr/bin/amixer')throw Error('Unexpected executable');
  if(args.includes('contents'))return contents();
  const index=args.indexOf('cset');
  if(index<0)throw Error('Unexpected command');
  const id=Number(args[index+1].split('=')[1]),value=Number(args[index+2]);
  calls.push({args:[...args],id,value});
  if(scenario==='rollback'&&id===2&&!failed){failed=true;throw Error('Injected ALSA write failure');}
  values[id]=value;return '';
 };
 try{
  const dsp=dspController({run,statePath:join(dir,'standby.json')});
  if(scenario==='standby'){await dsp.standby(true);await dsp.standby(false);}
  else try{await dsp.set(scenario==='headroom'?[{id:1,value:3}]:[{id:1,value:-3},{id:2,value:-2}]);}catch(e){error=e.message;}
  results[scenario]={calls,initial,values,error};
 }finally{rmSync(dir,{recursive:true,force:true});}
}
console.log(JSON.stringify(results));
"""


@unittest.skipUnless(sys.platform.startswith('linux') and shutil.which('getopt'),
                     'Linux amixer uses GNU getopt; native argument check is Linux-only')
class DspArgumentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        result = subprocess.run(['node', '--input-type=module'], input=FIXTURE,
                                cwd=ROOT, capture_output=True, text=True, timeout=15,
                                check=True)
        cls.results = json.loads(result.stdout)

    def parse(self, args):
        # util-linux getopt and amixer use the same GNU getopt_long semantics.
        return subprocess.run(['getopt', '-u', '-o', AMIXER_OPTIONS, '--', *args],
                              capture_output=True, text=True, timeout=5)

    def assert_commands_work(self, scenario):
        calls = self.results[scenario]['calls']
        self.assertTrue(calls)
        for call in calls:
            with self.subTest(scenario=scenario, control=call['id'], value=call['value']):
                parsed = self.parse(call['args'])
                self.assertEqual(parsed.returncode, 0, parsed.stderr)
                tokens = shlex.split(parsed.stdout)
                self.assertEqual(tokens[tokens.index('--')+1:],
                                 ['cset', 'numid='+str(call['id']), str(call['value'])])

    def test_legacy_negative_argument_is_a_command_line_error(self):
        parsed = self.parse(['-c', 'LouderRaspberry', 'cset', 'numid=1', '-3'])
        self.assertNotEqual(parsed.returncode, 0)

    def test_negative_eq_cuts_reach_the_control(self):
        self.assert_commands_work('cuts')
        self.assertIsNone(self.results['cuts']['error'])
        self.assertEqual(self.results['cuts']['values']['1'], -3)

    def test_headroom_gains_reach_the_controls(self):
        self.assert_commands_work('headroom')
        self.assertIsNone(self.results['headroom']['error'])
        gains = [c for c in self.results['headroom']['calls'] if c['id'] in (3, 4)]
        self.assertEqual([c['value'] for c in gains], [-8, -8])

    def test_failure_can_restore_a_negative_previous_value(self):
        self.assert_commands_work('rollback')
        result = self.results['rollback']
        self.assertIn('previous ALSA values', result['error'])
        self.assertEqual(result['values'], result['initial'])
        self.assertEqual(result['calls'][-1]['value'], -2)

    def test_standby_attenuation_and_restore_reach_the_controls(self):
        self.assert_commands_work('standby')
        result = self.results['standby']
        self.assertEqual([c['value'] for c in result['calls']], [-110, -110, -8, -8])
        self.assertEqual(result['values'], result['initial'])


if __name__ == '__main__':
    unittest.main()
