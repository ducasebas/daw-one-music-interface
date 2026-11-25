import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalPauseStore,MusicRecovery} from '../server/music-recovery.js';
import {mkdtempSync,readFileSync,writeFileSync,statSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('local pause survives a same-boot app restart and an explicit resume clears it without storing gains',t=>{
 const directory=mkdtempSync(join(tmpdir(),'tunebox-local-pause-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const store=()=>new LocalPauseStore({directory,currentBoot:'boot-one'});
 assert.equal(store().value,false);assert.equal(store().save(true),true);assert.equal(store().value,true);
 assert.equal(new LocalPauseStore({directory,currentBoot:'boot-two'}).value,false);
 const path=join(directory,'local-pause.json');assert.equal(statSync(path).mode&0o777,0o600);assert.deepEqual(Object.keys(JSON.parse(readFileSync(path))).sort(),['bootId','schema','standby']);
 assert.equal(store().save(false),true);assert.equal(store().value,false);
});
test('damaged, unbound or unpersistable local pause state never claims a restored pause',t=>{
 const directory=mkdtempSync(join(tmpdir(),'tunebox-local-pause-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
 writeFileSync(join(directory,'local-pause.json'),'{broken');assert.equal(new LocalPauseStore({directory,currentBoot:'boot'}).value,false);
 assert.equal(new LocalPauseStore({directory,currentBoot:null}).save(true),false);
 const store=new LocalPauseStore({directory,currentBoot:'boot',write:()=>{throw Error('read only');}});assert.equal(store.save(true),false);assert.equal(store.value,false);
});

function fixture(){
 const state={configured:true,status:'connected',failed:false,standby:false,blocked:false},calls=[];
 let reject=false,release=null;
 const recovery=new MusicRecovery({context:()=>state,pause:async()=>{calls.push('local-standby');if(release)await release;if(reject)throw Error('private device detail');state.standby=true;}});
 return {state,calls,recovery,fail:()=>reject=true,wait:promise=>release=promise,flush:async()=>{if(recovery.pending)await recovery.pending.catch(()=>{});}};
}
test('losing Music Assistant pauses the local amplifier exactly once without a room or queue command',async()=>{
 const f=fixture();f.recovery.update();assert.deepEqual(f.calls,[]);
 Object.assign(f.state,{status:'connecting'});f.recovery.update();assert.deepEqual(f.calls,[]);
 Object.assign(f.state,{status:'disconnected',failed:true});f.recovery.update();assert.equal(f.recovery.status().phase,'pausing');await f.flush();
 assert.equal(f.state.standby,true);assert.deepEqual(f.calls,['local-standby']);assert.equal(f.recovery.status().phase,'paused');
 for(let i=0;i<15;i++){f.state.status=i%2?'connecting':'disconnected';f.recovery.update();}await f.flush();assert.equal(f.calls.length,1);
});
test('a failed initial connection also pauses the own amplifier, while an unconfigured source never does',async()=>{
 const f=fixture();Object.assign(f.state,{status:'disconnected',failed:false});f.recovery.update();assert.equal(f.calls.length,0);
 f.state.failed=true;f.recovery.update();await f.flush();assert.equal(f.calls.length,1);
 const g=fixture();Object.assign(g.state,{configured:false,status:'disconnected',failed:true});g.recovery.update();assert.equal(g.calls.length,0);
});
test('connection recovery never resumes audio and a later outage is independent',async()=>{
 const f=fixture();Object.assign(f.state,{status:'disconnected',failed:true});f.recovery.update();await f.flush();
 f.state.status='connected';f.recovery.update();assert.equal(f.state.standby,true);assert.equal(f.calls.length,1);
 // A deliberate local resume is separate from reconnecting.
 f.state.standby=false;f.state.status='disconnected';f.recovery.update();await f.flush();assert.equal(f.calls.length,2);
});
test('Bluetooth, measurements and other blocked audio sources stay untouched and can be reevaluated later',async()=>{
 const f=fixture();Object.assign(f.state,{status:'disconnected',failed:true,blocked:true});f.recovery.update();assert.equal(f.recovery.status().phase,'unaffected');assert.equal(f.calls.length,0);
 f.state.blocked=false;f.recovery.update();await f.flush();assert.equal(f.calls.length,1);
 const g=fixture();Object.assign(g.state,{status:'disconnected',failed:true,standby:true});g.recovery.update();assert.equal(g.calls.length,0);assert.equal(g.recovery.status().phase,'paused');
});
test('simultaneous requests share a local pause, including recovery during the pending hardware action',async()=>{
 const f=fixture();let resolve;f.wait(new Promise(r=>resolve=r));Object.assign(f.state,{status:'disconnected',failed:true});f.recovery.update();
 const pending=f.recovery.pending;assert.equal(f.recovery.pause(),pending);f.recovery.update();await new Promise(r=>setImmediate(r));assert.equal(f.calls.length,1);
 f.state.status='connected';f.recovery.update();resolve();await pending;assert.equal(f.state.standby,true);assert.equal(f.calls.length,1);
});
test('a failed local pause is visible, never claims silence, and requires explicit retry',async()=>{
 const f=fixture();f.fail();Object.assign(f.state,{status:'disconnected',failed:true});f.recovery.update();await f.flush();
 assert.equal(f.recovery.status().phase,'failed');assert.equal(f.state.standby,false);assert.equal(JSON.stringify(f.recovery.status()).includes('private device detail'),false);
 for(let i=0;i<15;i++)f.recovery.update();await f.flush();assert.equal(f.calls.length,1);
 await assert.rejects(f.recovery.pause(),/Automatic local pause failed/);assert.equal(f.calls.length,2);
});
test('stopping the backend and connected or blocked sources refuse new pause requests',async()=>{
 const f=fixture();await assert.rejects(f.recovery.pause());f.recovery.close();Object.assign(f.state,{status:'disconnected',failed:true});f.recovery.update();await assert.rejects(f.recovery.pause());assert.equal(f.calls.length,0);
});
