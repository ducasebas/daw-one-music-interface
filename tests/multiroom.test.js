import test from 'node:test';
import assert from 'node:assert/strict';
import {canUpdate} from '../deploy/ota/policy.mjs';
import {LiveMusicService} from '../server/ma-service.js';
import {MultiroomService} from '../server/multiroom.js';
import {normalizeRooms, roomLeader, roomOutputs, groupCandidate, groupVolumeTargets, groupVolume, roomRequest} from '../shared/multiroom.js';

const features=['volume_set','volume_mute','pause','seek','set_members'];
const player=(id,extra={})=>({player_id:id,name:id==='pi'?'TuneBox':id==='rivo'?'Rivo':id,provider:'squeezelite',type:'player',available:true,supported_features:features,can_group_with:['pi','rivo','kitchen'],group_members:[],static_group_members:[],volume_level:id==='pi'?20:30,volume_muted:false,playback_state:id==='pi'?'playing':'idle',active_source:id,current_media:{title:id==='pi'?'Near Light':'',artist:'Ólafur Arnalds'},...extra});
const queue=id=>({queue_id:id,active:true,state:id==='pi'?'playing':'paused',elapsed_time:42,elapsed_time_last_updated:Date.now()/1000,current_index:0,current_item:{queue_item_id:id+'-track',duration:220,media_item:{uri:'track://'+id,name:id==='pi'?'Near Light':'A Walk',artists:[{name:'Artist'}]}}});
class RoomTransport {
  constructor(){this.calls=[];this.players=[player('pi'),player('rivo'),player('kitchen',{available:false}),player('airplay',{provider:'airplay',supported_features:features.slice(0,3),can_group_with:[]})];this.queues=this.players.map(p=>queue(p.player_id));this.listeners=[];this.info={server_version:'fixture'};}
  subscribe(fn){this.listeners.push(fn);return()=>this.listeners=this.listeners.filter(f=>f!==fn);}
  async connect(){}
  close(){}
  async snapshot(id){const p=this.players.find(p=>p.player_id===id),q=this.queues.find(q=>q.queue_id===(p.synced_to||p.active_source||id));return {player:structuredClone(p),queue:structuredClone(q),items:q?.current_item?[structuredClone(q.current_item)]:[],queueIds:this.queues.map(q=>q.queue_id)};}
  async command(name,args={}){
    this.calls.push({name,args:structuredClone(args)});
    if(this.beforeCommand)await this.beforeCommand(name,args);
    if(name==='players/all')return structuredClone(this.players);
    if(name==='player_queues/all')return structuredClone(this.queues);
    if(name==='players/cmd/set_members'){
      const parent=this.players.find(p=>p.player_id===args.target_player),members=new Set(parent.group_members.filter(id=>id!==parent.player_id));
      for(const id of args.player_ids_to_remove||[]){members.delete(id);const child=this.players.find(p=>p.player_id===id);if(child){child.synced_to=null;child.playback_state='idle';}}
      for(const id of args.player_ids_to_add||[]){members.add(id);const child=this.players.find(p=>p.player_id===id);child.synced_to=parent.player_id;child.playback_state=parent.playback_state;child.current_media={...parent.current_media};}
      parent.group_members=members.size?[parent.player_id,...members]:[];
    }else if(name==='players/cmd/volume_set')this.players.find(p=>p.player_id===args.player_id).volume_level=args.volume_level;
    else if(name==='players/cmd/volume_mute')this.players.find(p=>p.player_id===args.player_id).volume_muted=args.muted;
    else if(name==='players/cmd/pause')this.players.find(p=>p.player_id===args.player_id).playback_state='paused';
    else if(name==='player_queues/transfer'){
      const from=this.queues.find(q=>q.queue_id===args.source_queue_id),to=this.queues.find(q=>q.queue_id===args.target_queue_id);
      Object.assign(to,structuredClone({...from,queue_id:to.queue_id,state:args.auto_play?'playing':'paused'}));from.active=false;from.current_item=null;
      this.players.find(p=>p.player_id===args.source_queue_id).playback_state='idle';this.players.find(p=>p.player_id===args.target_queue_id).playback_state=args.auto_play?'playing':'paused';
    }
    return null;
  }
}
async function fixture(extra={}){
  const transport=new RoomTransport(),music=new LiveMusicService({playerId:'pi',controlEnabled:true,volumeLimit:40,...extra},{transport,retryMs:10000});
  await music.start();const rooms=new MultiroomService(music);
  return {transport,music,rooms,act:body=>rooms.act({revision:rooms.status().revision,...body}),writes:()=>transport.calls.filter(c=>c.name.startsWith('players/cmd/')||c.name==='player_queues/transfer')};
}

test('room inventory hides private/protocol targets and never exposes media URLs or fabricated measurements',()=>{
 const rooms=normalizeRooms([player('pi',{current_media:{title:'Song',uri:'http://secret/token',image_url:'http://secret'},volume_level:null}),player('hidden',{hide_in_ui:true}),player('private',{private:true}),player('source',{type:'source'}),player('protocol',{type:'protocol'}),player('pi')],'pi');
 assert.equal(rooms.length,1);assert.equal(rooms[0].volume,null);assert.equal(rooms[0].isLocal,true);assert.equal(JSON.stringify(rooms).includes('secret'),false);
 assert.equal(normalizeRooms([player('unknown',{available:undefined})])[0].available,false);
});
test('room compatibility respects declared native compatibility and rejects occupied, offline and nested groups',()=>{
 const [pi,rivo,offline,other]=normalizeRooms([player('pi'),player('rivo'),player('offline',{available:false}),player('other',{provider:'airplay'})]);
 assert.equal(groupCandidate(pi,rivo),null);assert.equal(groupCandidate(pi,offline),'offline');assert.equal(groupCandidate(pi,other),'incompatible');
 assert.equal(groupCandidate(pi,{...rivo,parentId:'other'}),'other-group');assert.equal(groupCandidate(pi,{...rivo,members:['other']}),'group-leader');
 assert.equal(groupCandidate({...pi,canGroupWith:['squeezelite']},rivo),null);
});
test('group volume bounds every individual output and preserves balance instead of trusting an average',()=>{
 const rooms=normalizeRooms([player('pi',{group_members:['pi','rivo'],volume_level:10}),player('rivo',{synced_to:'pi',volume_level:35})]);
 assert.equal(roomLeader(rooms,'rivo').id,'pi');assert.equal(groupVolume(rooms,'pi'),35);
 const targets=groupVolumeTargets(roomOutputs(rooms,'pi'),40,40);assert.equal(targets[1].value,40);assert.ok(targets[0].value<targets[1].value);assert.ok(targets.every(p=>p.value<=40));
 assert.deepEqual(groupVolumeTargets(roomOutputs(rooms,'pi'),0,40).map(p=>p.value),[0,0]);
 assert.throws(()=>groupVolumeTargets(roomOutputs(rooms,'pi'),41,40),/limit/);
 assert.equal(groupVolume([...rooms.filter(p=>p.id!=='rivo')],'pi'),null);
 assert.equal(roomLeader([{id:'a',parentId:'b'},{id:'b',parentId:'a'}],'a'),null);
});
test('room protocol is bounded, explicit and requires confirmation for group and transfer actions',()=>{
 const request={action:'group',playerId:'pi',revision:'a'.repeat(64),members:['rivo'],confirmed:true};assert.equal(roomRequest(request),request);
 for(const value of [{...request,confirmed:false},{...request,members:['rivo','rivo']},{...request,members:['pi']},{...request,command:'players/cmd/play'},null,{action:'constructor'}])assert.throws(()=>roomRequest(value));
 assert.throws(()=>roomRequest({...request,action:'volume',value:1000}),/request|volume/);
});
test('native Squeezelite grouping and leave use official set_members arguments and no play/volume command',async()=>{
 const f=await fixture();try{
  assert.equal(f.writes().length,0);
  await f.act({action:'group',playerId:'pi',members:['rivo'],confirmed:true});
  assert.deepEqual(f.writes()[0],{name:'players/cmd/set_members',args:{target_player:'pi',player_ids_to_add:['rivo'],player_ids_to_remove:[]}});
  assert.equal(f.rooms.status().rooms.find(p=>p.id==='rivo').parentId,'pi');
  await f.act({action:'leave',playerId:'rivo',confirmed:true});assert.equal(f.rooms.status().rooms.find(p=>p.id==='rivo').parentId,null);
  assert.deepEqual(f.writes().at(-1).args,{target_player:'pi',player_ids_to_add:[],player_ids_to_remove:['rivo']});
  assert.equal(f.writes().length,2);
 }finally{f.music.stop();}
});
test('stale topology, static members, incompatible and high-volume joins cannot send a group command',async()=>{
 const f=await fixture();try{
  const revision=f.rooms.status().revision;f.transport.players[1].available=false;
  await assert.rejects(()=>f.rooms.act({action:'group',playerId:'pi',members:['rivo'],confirmed:true,revision}),/Rooms changed/);
  f.transport.players[1].available=true;await f.music.refresh();
  await assert.rejects(()=>f.act({action:'group',playerId:'pi',members:['airplay'],confirmed:true}),/compatible/);
  f.transport.players[1].volume_level=75;
  await assert.rejects(()=>f.act({action:'group',playerId:'pi',members:['rivo'],confirmed:true}),/volume limit/);
  f.transport.players[0].group_members=['pi','rivo'];f.transport.players[0].static_group_members=['rivo'];f.transport.players[1].synced_to='pi';await f.music.refresh();
  await assert.rejects(()=>f.act({action:'group',playerId:'pi',members:[],confirmed:true}),/Permanent/);
  await assert.rejects(()=>f.act({action:'leave',playerId:'rivo',confirmed:true}),/Permanent/);
  assert.equal(f.writes().length,0);
 }finally{f.music.stop();}
});
test('room selection is view-only even in read-only mode and volume changes keep their explicit target',async()=>{
 const f=await fixture({controlEnabled:false});try{
  await f.act({action:'select',playerId:'rivo'});assert.equal(f.music.playerId,'rivo');assert.equal(f.writes().length,0);
  await assert.rejects(()=>f.act({action:'volume',playerId:'pi',value:10}),/read-only/);
  f.music.config.controlEnabled=true;await f.act({action:'volume',playerId:'pi',value:12});assert.deepEqual(f.writes().at(-1).args,{player_id:'pi',volume_level:12});assert.equal(f.music.playerId,'rivo');
  await assert.rejects(()=>f.act({action:'volume',playerId:'rivo',value:41}),/limit/);
 }finally{f.music.stop();}
});
test('group volume and mute affect only group outputs; unmute checks each member ceiling',async()=>{
 const f=await fixture();try{
  await f.act({action:'group',playerId:'pi',members:['rivo'],confirmed:true});
  await f.act({action:'group-volume',playerId:'pi',value:40});const changes=f.writes().filter(c=>c.name.endsWith('volume_set'));assert.equal(changes.length,2);assert.ok(changes.every(c=>c.args.volume_level<=40));assert.deepEqual(changes.map(c=>c.args.player_id).sort(),['pi','rivo']);
  await f.act({action:'group-mute',playerId:'pi',value:true});assert.equal(f.transport.players[0].volume_muted,true);assert.equal(f.transport.players[1].volume_muted,true);
  f.transport.players[1].volume_level=70;await f.music.refresh();const before=f.writes().length;
  await assert.rejects(()=>f.act({action:'group-mute',playerId:'pi',value:false}),/volume limit/);assert.equal(f.writes().length,before);
 }finally{f.music.stop();}
});
test('moving the queue preserves playing or paused state and selects the confirmed destination',async()=>{
 for(const playing of [true,false]){
  const f=await fixture();try{
   f.transport.players[0].playback_state=playing?'playing':'paused';await f.music.refresh();const sourceKey=f.rooms.status().sourceKey;
   await f.act({action:'transfer',playerId:'pi',targetId:'rivo',sourceKey,confirmed:true});
   assert.deepEqual(f.writes().find(c=>c.name==='player_queues/transfer').args,{source_queue_id:'pi',target_queue_id:'rivo',auto_play:playing});assert.equal(f.music.playerId,'rivo');assert.equal(f.music.playback.playing,playing);assert.equal(f.music.playback.position,42);
  }finally{f.music.stop();}
 }
});
test('a stale track, missing queue or occupied transfer target is rejected before playback changes',async()=>{
 const f=await fixture();try{
  await assert.rejects(()=>f.act({action:'transfer',playerId:'pi',targetId:'rivo',sourceKey:'a'.repeat(64),confirmed:true}),/track/);
  f.transport.queues=f.transport.queues.filter(q=>q.queue_id!=='rivo');await f.music.refresh();
  await assert.rejects(()=>f.act({action:'transfer',playerId:'pi',targetId:'rivo',sourceKey:f.rooms.status().sourceKey,confirmed:true}),/different available/);
  assert.equal(f.writes().length,0);
 }finally{f.music.stop();}
});
test('only one room mutation runs at a time, while reads remain available and commands are never replayed',async()=>{
 const f=await fixture();let release;try{
  const waiting=new Promise(r=>release=r);f.transport.beforeCommand=async name=>{if(name==='players/cmd/set_members')await waiting;};
  const pending=f.act({action:'group',playerId:'pi',members:['rivo'],confirmed:true});
  await new Promise(r=>setTimeout(r,0));assert.equal((await f.rooms.read()).busy,true);
  await assert.rejects(()=>f.act({action:'volume',playerId:'pi',value:1}),/in progress/);release();await pending;
  f.transport.beforeCommand=async(name,args)=>{if(name==='players/cmd/volume_set'&&args.player_id==='rivo')throw Error('private upstream details');};
  await assert.rejects(()=>f.act({action:'group-volume',playerId:'pi',value:5}),e=>e.message.includes('could not be confirmed')&&!e.message.includes('private'));
  assert.equal(f.writes().filter(c=>c.name==='players/cmd/volume_set'&&c.args.player_id==='rivo').length,1);assert.equal(f.rooms.status().busy,false);
 }finally{release?.();f.music.stop();}
});
test('external room events refresh the inventory and disconnect prevents all room changes',async()=>{
 const f=await fixture();try{
  for(const listener of f.transport.listeners)listener({event:'player_updated',object_id:'rivo'});assert.ok(f.music.timer);
  f.music.failed('Connection lost');const count=f.writes().length;
  await assert.rejects(()=>f.act({action:'volume',playerId:'pi',value:1}),/Connect Music Assistant/);assert.equal(f.writes().length,count);
 }finally{f.music.stop();}
});

test('accepted commands remain pending until delayed player state arrives and block conflicting footer actions',async()=>{
 const f=await fixture();let release;try{
  const waiting=new Promise(r=>release=r);f.transport.beforeCommand=async name=>{if(name==='players/cmd/set_members')await waiting;};
  const pending=f.act({action:'group',playerId:'pi',members:['rivo'],confirmed:true});await new Promise(r=>setTimeout(r,0));
  await assert.rejects(()=>f.music.control({type:'next'}),/Wait for the room change/);await assert.rejects(()=>f.music.selectPlayer('rivo'),/Wait for the room change/);
  release();await pending;assert.equal(f.music.roomCommandBusy,false);
  const before=f.transport.command.bind(f.transport);f.transport.command=async(name,args,...rest)=>{if(name==='players/cmd/volume_set'){f.transport.calls.push({name,args});setTimeout(()=>{f.transport.players.find(p=>p.player_id===args.player_id).volume_level=args.volume_level;},180);return null;}return before(name,args,...rest);};
  const started=Date.now();await f.act({action:'volume',playerId:'rivo',value:8});assert.ok(Date.now()-started>=150);assert.equal(f.rooms.status().rooms.find(p=>p.id==='rivo').volume,8);
 }finally{release?.();f.music.stop();}
});
test('an unconfirmed provider state is not reported as a successful room change and is never retried',async()=>{
 const f=await fixture();try{
  f.rooms.settleMs=10;const base=f.transport.command.bind(f.transport);f.transport.command=async(name,args,...rest)=>{if(name==='players/cmd/volume_set'){f.transport.calls.push({name,args});return null;}return base(name,args,...rest);};
  await assert.rejects(()=>f.act({action:'volume',playerId:'pi',value:7}),/could not be confirmed/);assert.equal(f.writes().length,1);assert.equal(f.rooms.status().rooms.find(p=>p.id==='pi').volume,20);assert.equal(f.music.roomCommandBusy,false);
 }finally{f.music.stop();}
});

test('OTA and audible measurements remain blocked by local playback even while a paused remote room is selected',async()=>{
 const f=await fixture();try{
  await f.act({action:'select',playerId:'rivo'});assert.equal(f.music.playback.playing,false);assert.equal(f.rooms.localPlayback(),true);
  const state={mode:'music-assistant',device:{mode:'ready',amplifierEnabled:false,faults:[]},playback:{connected:true,playing:false},musicAssistant:{connected:true},activity:{localPlayback:f.rooms.localPlayback()}};assert.equal(canUpdate(state),false);
  f.transport.players[0].playback_state='paused';await f.music.refresh();state.activity.localPlayback=f.rooms.localPlayback();assert.equal(canUpdate(state),true);
  state.activity.roomControl=true;assert.equal(canUpdate(state),false);state.activity.roomControl=false;
  f.transport.players[0].available=false;await f.music.refresh();state.activity.localPlayback=f.rooms.localPlayback();assert.equal(state.activity.localPlayback,null);assert.equal(canUpdate(state),false);
 }finally{f.music.stop();}
});
test('the local output identity can come from PCM configuration independently of the initially selected remote player',async()=>{
 const f=await fixture({playerId:'rivo'});try{const rooms=new MultiroomService(f.music,{localId:'pi'});assert.equal(rooms.status().localId,'pi');assert.equal(rooms.status().rooms.find(p=>p.id==='pi').isLocal,true);assert.equal(rooms.localPlayback(),true);}finally{f.music.stop();}
});
test('grouped member queue actions use the verified parent and respect the volume of every output',async()=>{
 const f=await fixture();try{
  await f.act({action:'group',playerId:'pi',members:['rivo'],confirmed:true});await f.act({action:'select',playerId:'rivo'});
  const id=f.music.playback.queue[0].id;await f.music.control({type:'queue-select',id});assert.deepEqual(f.transport.calls.find(c=>c.name==='player_queues/play_index').args,{queue_id:'pi',index:id});
  f.transport.players[0].volume_level=70;await f.music.refresh();const before=f.writes().length;await assert.rejects(()=>f.music.control({type:'play'}),/every affected room/);assert.equal(f.writes().length,before);
 }finally{f.music.stop();}
});
test('joining existing music adds only the local TuneBox and preserves the leader, queue, members and volumes',async()=>{
 const f=await fixture();try{
  f.transport.players[0].playback_state='idle';Object.assign(f.transport.players[1],{playback_state:'playing',volume_level:100,group_members:['rivo','kitchen']});Object.assign(f.transport.players[2],{available:true,synced_to:'rivo',playback_state:'playing'});await f.music.refresh();
  const queues=structuredClone(f.transport.queues),volumes=f.transport.players.map(p=>p.volume_level);
  await f.act({action:'join',playerId:'pi',targetId:'rivo',confirmed:true});
  assert.deepEqual(f.transport.calls.filter(c=>!['players/all','player_queues/all'].includes(c.name)),[{name:'players/cmd/set_members',args:{target_player:'rivo',player_ids_to_add:['pi'],player_ids_to_remove:[]}}]);
  assert.deepEqual(f.transport.queues,queues);assert.deepEqual(f.transport.players.map(p=>p.volume_level),volumes);assert.equal(f.transport.players[1].playback_state,'playing');assert.deepEqual(f.transport.players[1].group_members,['rivo','kitchen','pi']);assert.equal(f.music.playerId,'pi');assert.equal(f.music.queueId,'rivo');
 }finally{f.music.stop();}
});
test('a startup join rejects changed playback and unknown or excessive local volume before sending commands',async()=>{
 for(const localVolume of [null,60]){
  const f=await fixture();try{Object.assign(f.transport.players[0],{playback_state:'idle',volume_level:localVolume});f.transport.players[1].playback_state='playing';await f.music.refresh();await assert.rejects(()=>f.act({action:'join',playerId:'pi',targetId:'rivo',confirmed:true}),/volume limit/);assert.equal(f.writes().length,0);}finally{f.music.stop();}
 }
 const f=await fixture();try{
  f.transport.players[0].playback_state='idle';f.transport.players[1].playback_state='paused';await f.music.refresh();await assert.rejects(()=>f.act({action:'join',playerId:'pi',targetId:'rivo',confirmed:true}),/compatible playing room/);assert.equal(f.writes().length,0);
 }finally{f.music.stop();}
});
test('joining waits for the local player sync state without retrying the membership command',async()=>{
 const f=await fixture();try{
  f.transport.players[0].playback_state='idle';f.transport.players[1].playback_state='playing';await f.music.refresh();f.rooms.settleMs=5;f.rooms.joinSettleMs=600;
  const original=f.transport.command.bind(f.transport);f.transport.command=async(name,args,...rest)=>{const result=await original(name,args,...rest);if(name==='players/cmd/set_members'){f.transport.players[0].synced_to=null;setTimeout(()=>f.transport.players[0].synced_to='rivo',180);}return result;};
  const start=Date.now();await f.act({action:'join',playerId:'pi',targetId:'rivo',confirmed:true});assert.ok(Date.now()-start>=150);assert.equal(f.writes().length,1);
 }finally{f.music.stop();}
});
