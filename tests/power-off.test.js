import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateRequest} from '../shared/device-manager.js';
import {powerController} from '../deploy/manager/power.mjs';
import {simulatedDevice} from '../server/simulated-device.js';

test('power off requires explicit confirmation and never accepts shell, path or force arguments',()=>{
  assert.equal(validateRequest({command:'power-off',args:{confirmed:true}}).command,'power-off');
  for(const args of [{},{confirmed:false},{confirmed:'true'},{confirmed:true,force:true},{confirmed:true,path:'/tmp/run'}])assert.throws(()=>validateRequest({command:'power-off',args}));
});
test('physical power off schedules only the installed fixed helper and refuses other hosts or updates',async()=>{
  const calls=[];
  const run=async(program,args)=>{calls.push([program,args]);return args[0]==='is-active'?'inactive\n':'';};
  const pi=powerController({run,exists:()=>true,read:()=> 'Raspberry Pi 4 Model B Rev 1.5\0'});
  // The request marker models an in-flight update and blocks shutdown.
  await assert.rejects(pi.queue(),/update to finish/);
  assert.equal(calls.some(([program])=>program.endsWith('systemd-run')),false);
  const safe=powerController({run,exists:path=>!path.endsWith('/request.json'),read:()=> 'Raspberry Pi 4 Model B Rev 1.5\0'});
  assert.deepEqual(await safe.queue(),{queued:true,simulated:false,powerOff:true});
  assert.deepEqual(calls.at(-1),['/usr/bin/systemd-run',['--quiet','--unit=daw-one-power-off','--on-active=3s','--timer-property=AccuracySec=100ms','/usr/local/lib/daw-one-control/deploy/manager/power-off.sh']]);
  await assert.rejects(safe.queue(),/already queued/);
  const other=powerController({run,exists:()=>true,read:()=> 'Intel NUC'});assert.equal(other.supported(),false);await assert.rejects(other.queue(),/Raspberry Pi/);
  const active=powerController({run:async()=> 'active\n',exists:path=>!path.endsWith('/request.json'),read:()=> 'Raspberry Pi 3 Model B Plus Rev 1.3'});await assert.rejects(active.queue(),/update to finish/);
});
test('power off simulation never invokes a host command or stops another player',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'tb-off-'));
  const state={mode:'simulation',device:{mode:'ready',amplifierEnabled:false,faults:[]},playback:{playing:true}};
  try{
    const manager=simulatedDevice({snapshot:()=>state,directory:dir});
    assert.equal((await manager.request({command:'status'})).powerOffSupported,true);
    assert.deepEqual(await manager.request({command:'power-off',args:{confirmed:true}}),{queued:true,simulated:true,powerOff:true});
    assert.equal(state.playback.playing,true);
    const helper=readFileSync(new URL('../deploy/manager/power-off.sh',import.meta.url),'utf8');
    assert.match(helper,/touch \/run\/daw-one-display\/power-off/);assert.match(helper,/systemctl --no-block poweroff/);assert.doesNotMatch(helper,/--force|players\/cmd|curl/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
