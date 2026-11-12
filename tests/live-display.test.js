import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('live mode sleeps and wakes locally even without Music Assistant; saved volume ceilings survive restart',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'tunebox-live-display-'));
 const listener=createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
 const origin='http://127.0.0.1:'+port;let child;
 const launch=async()=>{child=spawn(process.execPath,['server/index.js'],{env:{...process.env,NODE_ENV:'production',HOST:'127.0.0.1',PORT:String(port),DAW_STATE_DIR:dir,DAW_PLAYBACK_MODE:'music-assistant',MA_URL:'http://127.0.0.1:9',MA_TOKEN:'',MA_TOKEN_FILE:'',MA_VOLUME_LIMIT:'40',MA_PLAYER_ID:'fixture',MA_ALLOW_CONTROL:'true'},stdio:'ignore'});for(let i=0;i<80;i++){try{if((await fetch(origin+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,50));}throw Error('Server did not start');};
 const stop=async()=>{if(!child||child.exitCode!==null)return;child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));};
 const get=async path=>(await fetch(origin+path)).json();
 const post=(path,body,token)=>fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{'X-TuneBox-Control':token}:{})},body:JSON.stringify(body)});
 try{
  await launch();const initial=await get('/api/state');assert.equal(initial.mode,'music-assistant');assert.equal(initial.musicAssistant.volumeLimit,40);
  const slept=await post('/api/event',{type:'display-timeout'});assert.equal(slept.status,200);assert.equal((await slept.json()).device.displayAwake,false);
  const woke=await post('/api/event',{type:'activity'});assert.equal(woke.status,200);const state=await woke.json();assert.equal(state.device.displayAwake,true);assert.equal(state.device.amplifierEnabled,initial.device.amplifierEnabled);assert.equal(state.playback.playing,initial.playback.playing);assert.equal(state.musicAssistant.connected,false);
  const token=(await get('/api/updates')).controlToken,prefs=await get('/api/preferences');
  assert.equal((await post('/api/preferences',{revision:prefs.revision,patch:{maxVolume:65,prefs:{volumeLimitConfigured:true}}},token)).status,200);
  assert.equal((await get('/api/state')).musicAssistant.volumeLimit,65);
  await stop();await launch();assert.equal((await get('/api/state')).musicAssistant.volumeLimit,65);
  const current=await get('/api/preferences'),fresh=(await get('/api/updates')).controlToken;
  await post('/api/preferences',{revision:current.revision,patch:{maxVolume:100,prefs:{volumeLimitConfigured:false}}},fresh);
  assert.equal((await get('/api/state')).musicAssistant.volumeLimit,40);
 }finally{await stop();rmSync(dir,{recursive:true,force:true});}
});
