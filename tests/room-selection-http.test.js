import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('the real HTTP application restores a room across process restarts and defaults local for a previous-boot cache',{skip:process.platform!=='linux'?'Requires a Linux kernel boot identity':false},async()=>{
 const directory=mkdtempSync(join(tmpdir(),'tunebox-selection-http-'));
 const local='02:00:00:00:00:01',marker=readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim();
 writeFileSync(join(directory,'rooms-boot.json'),JSON.stringify({bootId:marker,changed:false,left:['select']}));
 const preload=join(directory,'fake-ma.mjs');
 writeFileSync(preload,`
 import {appendFileSync} from 'node:fs';
 const local=${JSON.stringify(local)};
 const players=[local,'rivo','everywhere'].map(id=>({player_id:id,name:id,available:true,type:id==='everywhere'?'group':'player',provider:'squeezelite',supported_features:[],group_members:[],static_group_members:[],volume_level:20,playback_state:'paused'}));
 globalThis.WebSocket=class extends EventTarget{
  constructor(){super();this.readyState=0;queueMicrotask(()=>{this.readyState=1;this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({server_id:'fixture',server_version:'2.0'})}));});}
  send(raw){const message=JSON.parse(raw);appendFileSync(${JSON.stringify(join(directory,'commands.log'))},JSON.stringify(message)+'\\n');
   let result=null;
   if(message.command==='players/all')result=players;
   else if(message.command==='players/get')result=players.find(p=>p.player_id===message.args.player_id);
   else if(message.command==='player_queues/all')result=[];
   queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({message_id:message.message_id,result})})));
  }
  close(){this.readyState=3;this.dispatchEvent(new Event('close'));}
 };
 `);
 const listener=createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));
 const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
 const origin='http://127.0.0.1:'+port;let child;
 const get=async path=>{const r=await fetch(origin+path);assert.equal(r.status,200);return r.json();};
 const stop=async()=>{if(child&&child.exitCode===null){const exited=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await exited;}child=null;};
 const launch=async()=>{
  child=spawn(process.execPath,['--import',preload,'server/index.js'],{env:{...process.env,HOST:'127.0.0.1',PORT:String(port),DAW_STATE_DIR:directory,DAW_PLAYBACK_MODE:'music-assistant',DAW_AUDIO_PLAYER_ID:local,MA_PLAYER_ID:'everywhere',MA_URL:'http://music.local',MA_ALLOW_CONTROL:'true',MA_TOKEN:'',MA_TOKEN_FILE:''},stdio:'ignore'});
  for(let i=0;i<100;i++){
   try{const rooms=await get('/api/rooms');if(rooms.connected)return rooms;}catch{}
   assert.equal(child.exitCode,null,'the backend must stay running');await new Promise(resolve=>setTimeout(resolve,50));
  }
  throw Error('Music Assistant fixture did not become ready');
 };
 try{
  let rooms=await launch();assert.equal(rooms.selectedId,local);assert.equal(rooms.localId,local);
  const token=(await get('/api/updates')).controlToken;
  const response=await fetch(origin+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json','X-TuneBox-Control':token},body:JSON.stringify({action:'select',playerId:'rivo',revision:rooms.revision})});
  assert.equal(response.status,200);const selected=await response.json();assert.equal(selected.rooms.selectedId,'rivo');assert.equal(selected.snapshot.playback.playerId,'rivo');
  await stop();rooms=await launch();assert.equal(rooms.selectedId,'rivo');
  await stop();
  const selection=join(directory,'rooms-selection.json'),saved=JSON.parse(readFileSync(selection));
  writeFileSync(selection,JSON.stringify({...saved,bootId:'previous-boot'}));
  rooms=await launch();assert.equal(rooms.selectedId,local);
  const calls=readFileSync(join(directory,'commands.log'),'utf8').trim().split('\n').map(line=>JSON.parse(line));
  assert.equal(calls.some(c=>c.command.startsWith('players/cmd/')||c.command==='player_queues/transfer'),false);
 }finally{await stop();rmSync(directory,{recursive:true,force:true});}
});
