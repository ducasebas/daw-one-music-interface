import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {generateKeyPairSync} from 'node:crypto';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {verifyManifest} from '../deploy/ota/policy.mjs';
import {publicUpdateStatus} from '../server/update-status.js';
import {release} from '../shared/release.js';

test('signed manifests name the update for people, and older devices still accept them',()=>{
 const dir=mkdtempSync(join(tmpdir(),'tunebox-sign-'));
 try{
  const {privateKey,publicKey}=generateKeyPairSync('ed25519');writeFileSync(join(dir,'a.tgz'),'archive');
  execFileSync(process.execPath,[new URL('../deploy/ota/sign.mjs',import.meta.url).pathname,join(dir,'a.tgz'),'preview','a'.repeat(40),'7'],{cwd:dir,env:{...process.env,TUNEBOX_OTA_SIGNING_KEY:privateKey.export({type:'pkcs8',format:'pem'}),TUNEBOX_UPDATE_NOTES:'Merge pull request #5 from someone/branch'}});
  const raw=readFileSync(join(dir,'ota-manifest.json')),sig=Buffer.from(readFileSync(join(dir,'ota-manifest.sig'),'utf8'),'base64');
  const m=verifyManifest(raw,sig,publicKey,'preview',6);
  assert.equal(m.label,release.label);assert.equal(m.release,release.id);
  assert.ok(m.notes.startsWith(release.label+' — '));assert.doesNotMatch(m.notes,/Merge pull request/);
  assert.ok(m.notes.length<=500);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('the update status passes a bounded label to the settings page',()=>{
 const v=publicUpdateStatus({status:'available',available:{release:'2026.11.19-remote.1',label:'GUI 3.9.0 · REMOTE',commit:'b'.repeat(40),notes:'x'}});
 assert.equal(v.available.label,'GUI 3.9.0 · REMOTE');
 assert.equal(publicUpdateStatus({status:'available',available:{release:'r',label:'L'.repeat(200)}}).available.label.length,80);
});
