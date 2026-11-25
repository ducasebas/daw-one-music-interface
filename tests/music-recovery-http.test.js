import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

test('the real backend automatically pauses its own amplifier and offers an authenticated connection test without room commands',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'tunebox-ma-recovery-')),socket=join(directory,'manager.sock'),calls=[];
 const manager=createServer(c=>{let raw='';c.on('data',chunk=>{raw+=chunk;if(!raw.includes('\n'))return;const request=JSON.parse(raw);calls.push(request);c.end(JSON.stringify({ok:true,result:request.command==='local-standby'?{muted:request.args.enabled}:{managed:true,configured:false,setupComplete:true}})+'\n');});});
 await new Promise(r=>manager.listen(socket,r));
 const portServer=createServer();await new Promise(r=>portServer.listen(0,'127.0.0.1',r));const port=portServer.address().port;await new Promise(r=>portServer.close(r));
 const preload=join(directory,'ma.mjs');
 writeFileSync(preload,`
let online=true,current=null;const commands=[];
const player={player_id:'tb',available:true,playback_state:'playing',volume_level:30,active_source:'tb',supported_features:['pause']};
globalThis.WebSocket=class extends EventTarget{
 constructor(){super();this.readyState=1;current=this;queueMicrotask(()=>online?this.reply({server_id:'fixture',server_version:'fixture'}):this.close());}
 reply(data){queueMicrotask(()=>{if(this.readyState===1)this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(data)}));});}
 send(raw){const m=JSON.parse(raw);commands.push(m.command);const result={'auth':{},'players/all':[player,{...player,player_id:'rivo'}],'players/get':player,'player_queues/all':[],'player_queues/items':[]}[m.command];this.reply({message_id:m.message_id,result:result??null});}
 close(){if(this.readyState===3)return;this.readyState=3;this.dispatchEvent(new Event('close'));}
};
process.on('message',m=>{if(m.action==='offline'){online=false;current?.close();}if(m.action==='online')online=true;process.send({id:m.id,commands});});
`);
 const launch=()=>spawn(process.execPath,['--import',preload,'server/index.js'],{env:{...process.env,NODE_ENV:'production',HOST:'127.0.0.1',PORT:String(port),DAW_STATE_DIR:directory,DAW_PLAYBACK_MODE:'music-assistant',DAW_MANAGER_SOCKET:socket,MA_URL:'http://fixture.invalid:8095',MA_PLAYER_ID:'tb',MA_TOKEN:'',MA_TOKEN_FILE:'',MA_ALLOW_CONTROL:'true'},stdio:['ignore','ignore','pipe','ipc']});
 let child=launch();
 let errors='';child.stderr.on('data',c=>errors+=c);const origin='http://127.0.0.1:'+port;
 const get=async path=>(await fetch(origin+path)).json();
 const post=(path,body,token)=>fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{'X-TuneBox-Control':token}:{})},body:JSON.stringify(body)});
 const wait=async read=>{for(let i=0;i<100;i++){try{const value=await read();if(value)return value;}catch{}await new Promise(r=>setTimeout(r,40));}throw Error('Backend did not reach the expected state: '+errors);};
 let sequence=0;const signal=action=>new Promise(resolve=>{const id=++sequence;const listener=m=>{if(m.id===id){child.off('message',listener);resolve(m);}};child.on('message',listener);child.send({id,action});});
 try{
  await wait(async()=>{const state=await get('/api/state');return state.musicAssistant?.connected&&state;});
  let token=(await get('/api/updates')).controlToken;
  assert.equal((await post('/api/music/reconnect',{},null)).status,403);
  assert.equal((await post('/api/music/reconnect',{url:'http://other.invalid'},token)).status,400);
  assert.equal((await fetch(origin+'/api/music/reconnect',{method:'POST',headers:{Origin:'https://untrusted.invalid','Content-Type':'application/json','X-TuneBox-Control':token},body:'{}'})).status,403);
  await signal('offline');
  const away=await wait(async()=>{const s=await get('/api/state');return s.localControl.standby&&s;});
  assert.equal(away.localControl.needed,true);assert.equal(away.localControl.recovery.phase,'paused');
  assert.deepEqual(calls.filter(c=>c.command==='local-standby'),[{command:'local-standby',args:{enabled:true}}]);
  const failed=await post('/api/music/reconnect',{},token);assert.equal(failed.status,503);assert.equal((await failed.json()).snapshot.localControl.standby,true);
  await signal('online');const result=await post('/api/music/reconnect',{},token);assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'no-store');
  const connected=(await result.json()).snapshot;assert.equal(connected.musicAssistant.connected,true);assert.equal(connected.localControl.standby,true);assert.equal(connected.localControl.needed,false);assert.equal(connected.musicAssistant.playerId,'tb');
  const records=await signal('stats');assert.equal(records.commands.some(c=>c.startsWith('players/cmd/')||c.startsWith('player_queues/cmd/')),false);
  assert.deepEqual(calls.filter(c=>c.command==='local-standby'),[{command:'local-standby',args:{enabled:true}}]);
  child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));child=launch();child.stderr.on('data',c=>errors+=c);
  const restarted=await wait(async()=>{const s=await get('/api/state');return s.musicAssistant?.connected&&s;});assert.equal(restarted.localControl.standby,true);assert.equal(restarted.localControl.needed,false);
  assert.equal(calls.filter(c=>c.command==='local-standby').length,1);token=(await get('/api/updates')).controlToken;
  assert.equal((await post('/api/local',{action:'resume'},token)).status,200);
  assert.deepEqual(calls.filter(c=>c.command==='local-standby').at(-1),{command:'local-standby',args:{enabled:false}});
 }finally{child.kill('SIGTERM');if(child.exitCode===null)await new Promise(r=>child.once('exit',r));await new Promise(r=>manager.close(r));rmSync(directory,{recursive:true,force:true});}
});
