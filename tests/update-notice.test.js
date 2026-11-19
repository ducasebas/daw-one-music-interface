import test from 'node:test';
import assert from 'node:assert/strict';
import {trackUpdate,updateNotification,outcomeLifetimeMs,loadUpdateMemory,saveUpdateMemory} from '../shared/update-notice.js';
const cur={release:'r1',label:'GUI 3.9.2 · HOTFIX'},next={release:'r2',label:'GUI 3.10.0 · POLISH'};

test('no update, no notice: an up-to-date device shows nothing',()=>{
 const m=trackUpdate({}, {status:'up-to-date',current:cur});assert.equal(updateNotification(m,{status:'up-to-date',current:cur}),null);
});
test('an offer becomes progress, then is replaced by "Update installed" until dismissed or expired',()=>{
 let m=trackUpdate({}, {status:'available',current:cur,available:next},0);
 assert.equal(updateNotification(m,{status:'available',current:cur,available:next}).title,'Update available');
 m=trackUpdate(m,{status:'installing',current:cur,available:next},1);
 assert.equal(updateNotification(m,{status:'installing',current:cur,available:next}).title,'Installing update');
 // After the restart the device reports the new release (and may already say up-to-date).
 const after={status:'up-to-date',current:next};m=trackUpdate(m,after,2);
 const row=updateNotification(m,after);assert.equal(row.title,'Update installed');assert.equal(row.detail,'GUI 3.10.0 · POLISH');assert.equal(row.dismissible,true);assert.equal(row.attention,false);
 // Still there after later status reads, gone after a day.
 m=trackUpdate(m,after,3);assert.equal(updateNotification(m,after).title,'Update installed');
 m=trackUpdate(m,after,2+outcomeLifetimeMs+1);assert.equal(updateNotification(m,after),null);
});
test('an explicit installed status also produces the outcome',()=>{
 const m=trackUpdate({}, {status:'installed',current:next},5);assert.equal(updateNotification(m,{status:'installed',current:next}).title,'Update installed');
});
test('a failed or rolled-back install is replaced by "Update failed"',()=>{
 let m=trackUpdate({}, {status:'installing',current:cur,available:next},0);
 m=trackUpdate(m,{status:'rolled-back',current:cur},1);const row=updateNotification(m,{status:'rolled-back',current:cur});
 assert.equal(row.title,'Update failed');assert.match(row.detail,/previous version/);assert.equal(row.attention,true);
 let e=trackUpdate({}, {status:'downloading',current:cur,available:next},0);e=trackUpdate(e,{status:'error',current:cur,error:'Signature mismatch'},1);
 assert.equal(updateNotification(e,{status:'error',current:cur}).title,'Update failed');
});
test('a withdrawn offer disappears; a new install clears an old outcome',()=>{
 let m=trackUpdate({}, {status:'available',current:cur,available:next},0);m=trackUpdate(m,{status:'up-to-date',current:cur},1);
 assert.equal(m.pending,null);assert.equal(updateNotification(m,{status:'up-to-date',current:cur}),null);
 m={outcome:{kind:'installed',label:'old',at:0}};m=trackUpdate(m,{status:'installing',current:cur,available:next},1);assert.equal(m.outcome,null);
});
test('offline keeps the memory and shows only a stored outcome',()=>{
 const m={outcome:{kind:'installed',label:'GUI 3.10.0 · POLISH',at:0}};
 assert.deepEqual(trackUpdate(m,{offline:true},1),{pending:null,outcome:m.outcome});
 assert.equal(updateNotification(m,{status:'available',available:next},true).title,'Update installed');
 assert.equal(updateNotification({}, {status:'available',available:next},true),null);
});
test('memory survives a reload and tolerates broken storage',()=>{
 const store=new Map(),storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
 saveUpdateMemory({pending:{release:'r2'},outcome:null},storage);assert.equal(loadUpdateMemory(storage).pending.release,'r2');
 assert.deepEqual(loadUpdateMemory({getItem:()=>'{bad'}),{});
 assert.doesNotThrow(()=>saveUpdateMemory({}, {setItem(){throw Error('quota');}}));
});
