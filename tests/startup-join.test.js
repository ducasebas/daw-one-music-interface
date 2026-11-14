import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRooms,startupJoinTargets,roomRequest} from '../shared/multiroom.js';
const raw=(id,state='idle',extra={})=>({player_id:id,name:id,available:true,playback_state:state,supported_features:['set_members','volume_set'],can_group_with:['pi','rivo'],volume_level:20,...extra});
const state=(players=[raw('pi'),raw('rivo','playing')])=>({connected:true,controlEnabled:true,localId:'pi',limit:40,rooms:normalizeRooms(players,'pi')});
test('startup offers the already-playing compatible leader, without requiring it to change volume',()=>{
 const s=state([raw('pi'),raw('rivo','playing',{volume_level:100,group_members:['rivo','kitchen']}),raw('kitchen','playing',{synced_to:'rivo'})]);
 assert.deepEqual(startupJoinTargets(s).map(p=>p.id),['rivo']);assert.equal(s.rooms[1].volume,100);
});
test('startup never offers an unavailable, paused, incompatible, occupied or already-playing local endpoint',()=>{
 for(const change of [{available:false},{playback_state:'playing'},{synced_to:'rivo'},{group_members:['pi','other']}])assert.deepEqual(startupJoinTargets(state([raw('pi','idle',change),raw('rivo','playing')])),[]);
 for(const change of [{available:false},{playback_state:'paused'},{can_group_with:[]},{synced_to:'other'},{group_members:['rivo','pi']}])assert.deepEqual(startupJoinTargets(state([raw('pi'),raw('rivo','playing',change)])),[]);
 assert.deepEqual(startupJoinTargets({...state(),connected:false}),[]);assert.deepEqual(startupJoinTargets({...state(),controlEnabled:false}),[]);
});
test('startup join requires an explicit target and confirmation with no arbitrary playback command',()=>{
 const req={action:'join',playerId:'pi',targetId:'rivo',revision:'a'.repeat(64),confirmed:true};assert.deepEqual(roomRequest(req),req);
 for(const bad of [{...req,confirmed:false},{...req,targetId:null},{...req,play:true}])assert.throws(()=>roomRequest(bad));
});
