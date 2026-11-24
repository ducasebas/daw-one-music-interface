import test from 'node:test';
import assert from 'node:assert/strict';
import {sshController} from '../deploy/manager/ssh.mjs';
import {validateRequest} from '../shared/device-manager.js';
function fakeRun(state){const calls=[];const run=async(cmd,args)=>{calls.push(args.join(' '));const [verb,...rest]=args;
 if(verb==='is-enabled'){const v=state[rest[0]]?.enabled??'not-found';if(v!=='enabled')throw Object.assign(Error('x'),{stdout:v+'\n'});return v+'\n';}
 if(verb==='is-active'){const v=state[rest[0]]?.active??'inactive';if(v!=='active')throw Object.assign(Error('x'),{stdout:v+'\n'});return v+'\n';}
 if(verb==='enable'){state['ssh.service']={enabled:'enabled',active:'active'};return '';}
 if(verb==='disable'){state[rest[1]]={enabled:'disabled',active:'inactive'};return '';}
 return '';};return {run,calls};}
test('SSH is reported and switched only on request; turning off stops service and socket',async()=>{
 const {run,calls}=fakeRun({'ssh.service':{enabled:'enabled',active:'active'},'ssh.socket':{enabled:'disabled',active:'inactive'}});
 const ssh=sshController({run});assert.deepEqual(await ssh.get(),{supported:true,enabled:true,startsAtBoot:true});
 const off=await ssh.set(false);assert.equal(off.enabled,false);assert.ok(calls.includes('disable --now ssh.service')&&calls.includes('disable --now ssh.socket'));
 const on=await ssh.set(true);assert.equal(on.enabled,true);assert.ok(calls.includes('enable --now ssh.service'));
});
test('missing SSH is reported, and the request needs an explicit confirmation',async()=>{
 const {run}=fakeRun({});const ssh=sshController({run});assert.equal((await ssh.get()).supported,false);await assert.rejects(ssh.set(true),/not installed/);
 assert.throws(()=>validateRequest({command:'ssh-set',args:{enabled:true}}),/Confirm/);
 assert.deepEqual(validateRequest({command:'ssh-set',args:{enabled:false,confirmed:true}}).args,{enabled:false,confirmed:true});
 assert.throws(()=>validateRequest({command:'ssh-set',args:{enabled:true,confirmed:true,port:22}}));
});
