import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {withUpdateLock} from '../deploy/manager/update-lock.mjs';
test('source entry and OTA cannot own the same kernel lock; failure releases it',{skip:process.platform!=='linux'},async()=>{
 const dir=mkdtempSync(join(tmpdir(),'tunebox-lock-')),path=join(dir,'lock');let release;const gate=new Promise(r=>release=r);let entered;const ready=new Promise(r=>entered=r);
 try{
  const first=withUpdateLock(async()=>{entered();await gate;return 'source';},path);await ready;
  await assert.rejects(withUpdateLock(async()=>assert.fail('Overlapping audio owner'),path));release();assert.equal(await first,'source');
  await assert.rejects(withUpdateLock(async()=>{throw Error('Failed preflight');},path));assert.equal(await withUpdateLock(async()=>42,path),42);
 }finally{release?.();rmSync(dir,{recursive:true,force:true});}
});
