import test from 'node:test';
import assert from 'node:assert/strict';
import {ManualUpdate} from '../server/manual-update.js';
import {MultiroomService} from '../server/multiroom.js';
import {canUpdate} from '../deploy/ota/policy.mjs';
import {installationDecision,updateSettings} from '../shared/update-settings.js';

function fixture({grouped=false,playing=true,selected='tb'}={}){
  const calls=[],flags={};
  const player=(id,name,state)=>({player_id:id,name,type:'player',provider:'squeezelite',available:true,playback_state:state,volume_level:20,supported_features:['pause','volume_set','set_members'],group_members:[]});
  const tb=player('tb','TuneBox',playing?'playing':'paused'),rivo=player('rivo','Rivo','playing');
  if(grouped){tb.synced_to='rivo';rivo.group_members=['tb'];}
  const queue=[{id:'track',mediaKey:'same-recording'}];
  const music={status:'connected',config:{playerId:'tb',controlEnabled:true,volumeLimit:40},playerId:selected,players:[tb,rivo],playback:{connected:true,playing,queue},
    async refresh(){const p=this.players.find(p=>p.player_id===this.playerId);this.playback={...this.playback,playing:flags.stalePlayback||p.playback_state==='playing'};},
    transport:{async command(name,args){calls.push({name,args});if(flags.rejectPause)throw Error('pause rejected');const ids=args.player_id==='rivo'&&grouped?['rivo','tb']:[args.player_id];for(const p of music.players)if(ids.includes(p.player_id))p.playback_state='paused';}},
    failed(){this.status='disconnected';},
  };
  const multiroom=new MultiroomService(music,{localId:'tb',settleMs:0});
  const update={status:'available',available:{commit:'a'.repeat(40)},manager:{managed:true,configured:true}};
  const snapshot=()=>({mode:'music-assistant',musicAssistant:{connected:music.status==='connected'},device:{mode:'ready',amplifierEnabled:false,faults:[],...(flags.device||{})},playback:music.playback,activity:{localPlayback:multiroom.localPlayback(),roomControl:multiroom.busy||music.controlBusy===true,bluetoothActive:false,roomMeasurement:false,...flags.activity}});
  const install=new ManualUpdate({snapshot,status:async()=>update,music,multiroom,manage:async request=>{assert.equal(canUpdate(snapshot()),true);calls.push(request);return {queued:true};}});
  return {install,music,multiroom,update,snapshot,calls,flags,tb,rivo,queue};
}

test('manual install pauses the actual independent TuneBox once and confirms idle before queuing',async()=>{
  const f=fixture();
  const result=await f.install.install({command:'install'});
  assert.deepEqual(f.calls,[{name:'players/cmd/pause',args:{player_id:'tb'}},{command:'install',args:{}}]);
  assert.equal(result.pausedForUpdate,true);assert.equal(f.tb.playback_state,'paused');assert.equal(f.rivo.playback_state,'playing');
  assert.equal(f.tb.volume_level,20);assert.equal(f.music.playback.queue,f.queue);assert.equal(f.music.playerId,'tb');assert.equal(f.install.busy,false);
});

test('an idle TuneBox installs without sending a command to an independently playing Rivo',async()=>{
  const f=fixture({playing:false});const result=await f.install.install({command:'install',args:{}});
  assert.deepEqual(f.calls,[{command:'install',args:{}}]);assert.equal(f.rivo.playback_state,'playing');assert.equal(result.pausedForUpdate,false);
});

test('a remote selected player is never paused to make the local update eligible',async()=>{
  const f=fixture({selected:'rivo'});
  await assert.rejects(f.install.install({command:'install'}),/Select the local TuneBox/);assert.deepEqual(f.calls,[]);
});

test('a group requires explicit consent for the current rooms before one leader pause',async()=>{
  const f=fixture({grouped:true});let confirmation;
  await assert.rejects(f.install.install({command:'install'}),e=>{confirmation=e;return e.code==='update-group-confirmation';});
  assert.deepEqual(confirmation.rooms.map(p=>p.name),['Rivo','TuneBox']);assert.deepEqual(f.calls,[]);
  await f.install.install({command:'install',args:{pauseGroup:true,roomsRevision:confirmation.roomsRevision}});
  assert.deepEqual(f.calls,[{name:'players/cmd/pause',args:{player_id:'rivo'}},{command:'install',args:{}}]);assert.equal(f.rivo.playback_state,'paused');assert.equal(f.tb.playback_state,'paused');
});

test('a changed room graph requires a fresh group confirmation and sends no pause',async()=>{
  const f=fixture({grouped:true});let revision;
  await assert.rejects(f.install.install({command:'install'}),e=>(revision=e.roomsRevision,e.code==='update-group-confirmation'));
  f.rivo.group_members.push('hall');f.music.players.push({...f.rivo,player_id:'hall',name:'Hall',group_members:[],synced_to:'rivo'});
  await assert.rejects(f.install.install({command:'install',args:{pauseGroup:true,roomsRevision:revision}}),e=>e.code==='update-group-confirmation'&&e.roomsRevision!==revision&&e.rooms.some(p=>p.name==='Hall'));
  assert.deepEqual(f.calls,[]);
});

test('invalid envelopes and confirmation arguments fail before any pause or root action',async()=>{
  for(const request of [{command:'install',extra:true},{command:'install',args:{path:'/tmp/x'}},{command:'install',args:[]},{command:'install',args:{pauseGroup:'yes'}},{command:'install',args:{pauseGroup:true}},{command:'install',args:{roomsRevision:'a'.repeat(64)}},{command:'check'}]){
    const f=fixture();await assert.rejects(f.install.install(request));assert.deepEqual(f.calls,[]);
  }
});

test('no release, an unconfigured manager and active update phases never pause music',async()=>{
  for(const patch of [{available:null},{manager:{managed:false}},{manager:{managed:true,configured:false}},{status:'checking'},{status:'preparing'},{status:'installing'}]){
    const f=fixture();Object.assign(f.update,patch);await assert.rejects(f.install.install({command:'install'}));assert.deepEqual(f.calls,[]);
  }
});

test('faults, unknown local playback, measurement, Bluetooth and another room command block the pause',async()=>{
  for(const patch of [{device:{faults:['thermal-alarm']}},{device:{mode:'shutting-down'}},{device:{amplifierEnabled:true}},{activity:{localPlayback:null}},{activity:{roomMeasurement:true}},{activity:{syncCalibration:true}},{activity:{bluetoothActive:true}},{activity:{roomControl:true}}]){
    const f=fixture();Object.assign(f.flags,patch);await assert.rejects(f.install.install({command:'install'}));assert.deepEqual(f.calls,[]);
  }
  const f=fixture();f.music.controlBusy=true;await assert.rejects(f.install.install({command:'install'}),/room change/);assert.deepEqual(f.calls,[]);
});

test('read-only or failed pause is not retried and never queues an installation',async()=>{
  for(const rejected of [false,true]){
    const f=fixture();if(rejected)f.flags.rejectPause=true;else f.music.config.controlEnabled=false;
    await assert.rejects(f.install.install({command:'install'}));assert.equal(f.calls.filter(c=>c.name==='players/cmd/pause').length,rejected?1:0);assert.equal(f.calls.some(c=>c.command==='install'),false);assert.equal(f.install.busy,false);
  }
});

test('stale playback after pause prevents installation; a queueing failure never resumes music',async()=>{
  const f=fixture();f.flags.stalePlayback=true;let clock=0;f.install.now=()=>clock+=8000;
  await assert.rejects(f.install.install({command:'install'}),/did not confirm a pause/);assert.equal(f.calls.some(c=>c.command==='install'),false);assert.equal(f.calls.filter(c=>c.name==='players/cmd/pause').length,1);
  const g=fixture();g.install.manage=async()=>{throw Error('Updater lock busy.');};await assert.rejects(g.install.install({command:'install'}),/Music remains paused/);assert.equal(g.tb.playback_state,'paused');assert.equal(g.calls.length,1);
});

test('manual preparation rejects a concurrent install and releases its busy guard on error',async()=>{
  const f=fixture();let release;const gate=new Promise(r=>release=r);f.install.status=async()=>{await gate;return f.update;};
  const first=f.install.install({command:'install'});assert.throws(()=>f.install.assertAvailable(),/Wait while/);await assert.rejects(f.install.install({command:'install'}),/Wait while/);release();await first;assert.doesNotThrow(()=>f.install.assertAvailable());
});

test('automatic policy keeps waiting for playing music and never enters the manual pause path',()=>{
  const f=fixture();assert.equal(installationDecision(updateSettings({mode:'auto'}),'auto',canUpdate(f.snapshot())),'waiting-idle');assert.deepEqual(f.calls,[]);
});
