import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareMeasurement} from '../server/measurement-prepare.js';

const rooms=(local)=>({revision:'r'.repeat(64),rooms:[{id:'tunebox',isLocal:true,available:true,canPause:true,state:'idle',members:[],type:'player',...local},{id:'kitchen',isLocal:false,available:true,state:'playing',members:[],type:'player'}]});
function harness({local={},bluetooth=false,sync=false,status='connected'}={}){
 const calls=[];let state=rooms(local);
 const multiroom={status:()=>state,async act(body){calls.push(['room',body.action,body.playerId,body.members??null,body.confirmed??null]);
  const me=state.rooms.find(p=>p.isLocal);
  if(body.action==='leave')state={...state,rooms:state.rooms.map(p=>p.isLocal?{...p,parentId:null}:p)};
  if(body.action==='group')state={...state,rooms:state.rooms.map(p=>p.isLocal?{...p,members:[]}:p)};
  if(body.action==='pause')state={...state,rooms:state.rooms.map(p=>p.id===me.id?{...p,state:'paused'}:p)};}};
 return {calls,multiroom,deps:{bluetooth:()=>({active:bluetooth}),syncRunning:()=>sync,manage:async r=>calls.push(['manager',r.command]),music:{status},multiroom}};
}

test('a confirmed sweep stops sync, Bluetooth, group membership and local playback once each, in order',async()=>{
 const h=harness({local:{parentId:'kitchen',state:'playing'},bluetooth:true,sync:true});
 assert.deepEqual(await prepareMeasurement(h.deps),['sync','bluetooth','group','playback']);
 assert.deepEqual(h.calls,[['manager','sync-stop'],['manager','bluetooth-stop'],['room','leave','tunebox',null,true],['room','pause','tunebox',null,null]]);
});

test('a group led by TuneBox is released before pausing, so other rooms are not paused',async()=>{
 const h=harness({local:{members:['kitchen'],state:'playing'}});
 assert.deepEqual(await prepareMeasurement(h.deps),['group','playback']);
 assert.deepEqual(h.calls[0],['room','group','tunebox',[],true]);
 assert.equal(h.calls.filter(c=>c[1]==='pause').length,1);assert.equal(h.calls[1][2],'tunebox');
});

test('an idle, independent TuneBox needs no changes',async()=>{
 const h=harness();assert.deepEqual(await prepareMeasurement(h.deps),[]);assert.deepEqual(h.calls,[]);
});

test('a failing step stops preparation before the sweep and is not retried',async()=>{
 const h=harness({local:{parentId:'kitchen',state:'playing'}});
 h.multiroom.act=async()=>{throw Error('Rooms changed. Review the current rooms and try again.');};
 await assert.rejects(prepareMeasurement(h.deps),/Rooms changed/);
 const noPause=harness({local:{state:'playing',canPause:false}});
 await assert.rejects(prepareMeasurement(noPause.deps),/Pause music on this TuneBox/);
 await assert.rejects(prepareMeasurement(harness({status:'disconnected'}).deps),/Connect Music Assistant/);
});

test('simulation pauses the simulated playback',async()=>{
 const events=[];const runtime={playback:{playing:true},dispatch:e=>events.push(e)};
 assert.deepEqual(await prepareMeasurement({bluetooth:()=>({active:false}),syncRunning:()=>false,manage:async()=>{},music:null,multiroom:null,runtime}),['playback']);
 assert.deepEqual(events,[{type:'pause'}]);
});

test('power setup uses the same preparation and names power setup when it cannot pause',async()=>{
 const h=harness({local:{parentId:'kitchen',state:'playing'}});
 assert.deepEqual(await prepareMeasurement({...h.deps,purpose:'power'}),['group','playback']);
 const stuck=harness({local:{state:'playing',canPause:false}});
 await assert.rejects(prepareMeasurement({...stuck.deps,purpose:'power'}),/before power setup/);
 await assert.rejects(prepareMeasurement({...harness({status:'disconnected'}).deps,purpose:'power'}),/before power setup/);
});
