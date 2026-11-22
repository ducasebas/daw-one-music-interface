import test from 'node:test';
import assert from 'node:assert/strict';
import {BootRooms} from '../server/boot-rooms.js';
const rev='a'.repeat(64);
function fake(rooms,{selectedId='tb',controlEnabled=true,connected=true}={}){
 const calls=[];let state={connected,controlEnabled,localId:'tb',selectedId,revision:rev,rooms};
 return {calls,status:()=>state,read:async()=>state,act:async body=>{calls.push(body.action+':'+body.playerId+(body.members?':'+body.members.join(','):''));
  if(body.action==='leave')state={...state,rooms:state.rooms.map(r=>r.id==='tb'?{...r,parentId:null}:{...r,members:r.members.filter(m=>m!=='tb')})};
  if(body.action==='group')state={...state,rooms:state.rooms.map(r=>r.id==='tb'?{...r,members:body.members}:r)};
  if(body.action==='select')state={...state,selectedId:body.playerId};}};
}
const mem=()=>{let saved={};return {read:()=>saved,write:(p,v)=>{saved=v;}};};
test('after a new boot a grouped TuneBox leaves the group, selects itself and shows a notice once',async()=>{
 const m=fake([{id:'tb',available:true,parentId:'kitchen',members:[],canGroup:true},{id:'kitchen',available:true,parentId:null,members:['tb'],canGroup:true}],{selectedId:'kitchen'});
 const store=mem(),b=new BootRooms({multiroom:m,directory:'/x',currentBoot:'boot-2',...store});
 assert.equal(b.pending(),true);const r=await b.check();assert.deepEqual(m.calls,['leave:tb','select:tb']);assert.equal(r.changed,true);assert.ok(b.notice());
 assert.equal(b.pending(),false);assert.equal(await b.check(),null,'only once per boot');
 const again=new BootRooms({multiroom:m,directory:'/x',currentBoot:'boot-2',...store});assert.equal(again.pending(),false,'an app restart is not a reboot');assert.ok(again.notice());
 assert.equal(new BootRooms({multiroom:m,directory:'/x',currentBoot:'boot-3',...store}).notice(),null);
});
test('a leader drops its dynamic members but keeps permanent ones; nothing grouped means no notice',async()=>{
 const m=fake([{id:'tb',available:true,parentId:null,members:['a','b'],staticMembers:['b'],canGroup:true}]);
 const b=new BootRooms({multiroom:m,directory:'/x',currentBoot:'x',...mem()});await b.check();assert.deepEqual(m.calls,['group:tb:b']);assert.ok(b.notice());
 const solo=fake([{id:'tb',available:true,parentId:null,members:[],canGroup:true}]);const s=new BootRooms({multiroom:solo,directory:'/x',currentBoot:'x',...mem()});
 const r=await s.check();assert.equal(r.changed,false);assert.equal(s.notice(),null);assert.deepEqual(solo.calls,[]);
});
test('waits for Music Assistant and never acts read-only',async()=>{
 let t=0;const m=fake([],{connected:false});const b=new BootRooms({multiroom:m,directory:'/x',currentBoot:'x',now:()=>t,waitMs:1000,...mem()});
 assert.equal(await b.check(),null);assert.equal(b.pending(),true);t=2000;await b.check();assert.equal(b.pending(),false);
 const ro=fake([{id:'tb',available:true,parentId:'k',members:[]}],{controlEnabled:false});const r=await new BootRooms({multiroom:ro,directory:'/x',currentBoot:'x',...mem()}).check();assert.equal(r.skipped,'read-only');assert.deepEqual(ro.calls,[]);
});
