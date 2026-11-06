import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {verifyManifest,verifyArchive,canUpdate,activate,repository,prunableSlots} from '../deploy/ota/policy.mjs';
import {updateStatus} from '../server/update-status.js';
const keys=generateKeyPairSync('ed25519'),bytes=Buffer.from('archive');
const manifest={schema:1,repository,channel:'preview',sequence:4,commit:'a'.repeat(40),release:'test',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
const signed=m=>{const raw=Buffer.from(JSON.stringify(m));return [raw,sign(null,raw,keys.privateKey)];};
test('OTA accepts signed channel inventory, rejects tampering, wrong key, channel and replay',()=>{
 const [raw,sig]=signed(manifest);assert.equal(verifyManifest(raw,sig,keys.publicKey,'preview',3).sequence,4);
 assert.throws(()=>verifyManifest(Buffer.concat([raw,Buffer.from(' ')]),sig,keys.publicKey,'preview'));
 assert.throws(()=>verifyManifest(raw,sig,generateKeyPairSync('ed25519').publicKey,'preview'));
 assert.throws(()=>verifyManifest(raw,sig,keys.publicKey,'stable'));
 assert.throws(()=>verifyManifest(raw,sig,keys.publicKey,'preview',4));
 for(const changes of [{repository:'other/repo'},{bytes:33554433},{commit:'../x'},{sequence:0}]){const [r,s]=signed({...manifest,...changes});assert.throws(()=>verifyManifest(r,s,keys.publicKey,'preview'));}
 verifyArchive(bytes,manifest);assert.throws(()=>verifyArchive(Buffer.from('changed'),manifest));
});
test('OTA never interrupts playback or proceeds through faults, enabled amplifier or unknown connection',()=>{
 const state={mode:'music-assistant',device:{mode:'ready',faults:[],amplifierEnabled:false},playback:{playing:false,connected:true},musicAssistant:{connected:true}};
 assert.equal(canUpdate(state),true);for(const v of [null,{}, {...state,playback:{playing:true,connected:true}},{...state,device:{...state.device,amplifierEnabled:true}},{...state,device:{...state.device,faults:['thermal']}},{...state,musicAssistant:{connected:false}},{...state,playback:{playing:false}}])assert.equal(canUpdate(v),false);
});
test('failed health restores previous slot; broken rollback retains recovery journal',async()=>{
 let selected='previous',journal=null,committed=false;const host={current:async()=>selected,journal:async v=>journal=v,stop:async()=>{},select:async v=>selected=v,start:async()=>{},healthy:async m=>!m,commit:async()=>committed=true,clearJournal:async()=>journal=null};
 await assert.rejects(activate(host,manifest),/previous application restored/);assert.equal(selected,'previous');assert.equal(journal,null);assert.equal(committed,false);
 host.healthy=async()=>false;await assert.rejects(activate(host,manifest),/manual recovery/);assert.ok(journal);
});
test('successful activation commits only after health',async()=>{const order=[];const host={current:async()=>'/old',journal:async()=>order.push('journal'),stop:async()=>order.push('stop'),select:async()=>order.push('select'),start:async()=>order.push('start'),healthy:async()=>{order.push('health');return true;},commit:async()=>order.push('commit'),clearJournal:async()=>order.push('clear')};assert.equal(await activate(host,manifest),'installed');assert.deepEqual(order,['journal','stop','select','start','health','commit','clear']);});
test('update status is read only and excludes updater errors or secrets',()=>{const dir=mkdtempSync(join(tmpdir(),'ota-status-'));try{const path=join(dir,'status');assert.equal(updateStatus(path).status,'not-configured');writeFileSync(path,JSON.stringify({status:'installed',channel:'preview',commit:'a'.repeat(40),error:'secret',token:'hidden'}));const value=updateStatus(path);assert.equal(value.commit,'a'.repeat(40));assert.equal(value.error,undefined);assert.equal(value.token,undefined);}finally{rmSync(dir,{recursive:true});}});

test('slot retention preserves active/previous slots and ignores unfamiliar data',()=>{const active='a'.repeat(40),previous='b'.repeat(40),entries=[active,previous,'c'.repeat(40),'d'.repeat(40),'e'.repeat(40),'personal-files'].map((name,i)=>({name,modified:i}));assert.deepEqual(prunableSlots(entries,active,previous),['c'.repeat(40)]);});
