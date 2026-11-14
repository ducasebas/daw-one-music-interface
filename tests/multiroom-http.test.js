import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('room HTTP controls require the local nonce, reject cross-site requests and respect the settings PIN',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'tunebox-rooms-http-'));
 const listener=createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
 const origin='http://127.0.0.1:'+port;
 const child=spawn(process.execPath,['server/index.js'],{env:{...process.env,NODE_ENV:'production',HOST:'127.0.0.1',PORT:String(port),DAW_STATE_DIR:dir,DAW_PLAYBACK_MODE:'simulation'},stdio:'ignore'});
 const get=path=>fetch(origin+path);
 const post=(path,body,token,extra={})=>fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{'X-TuneBox-Control':token}:{}),...extra},body:JSON.stringify(body)});
 try{
  let ready=false;for(let i=0;i<80;i++){try{if((await get('/api/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,50));}assert.ok(ready);
  const status=await get('/api/rooms'),state=await status.json();assert.match(status.headers.get('cache-control'),/no-store/);assert.equal(state.configured,false);assert.deepEqual(state.rooms,[]);assert.equal(state.locked,false);
  const token=(await(await get('/api/updates')).json()).controlToken;
  const request={action:'volume',playerId:'pi',value:20,revision:state.revision};
  assert.equal((await post('/api/rooms',request)).status,403);
  assert.equal((await post('/api/rooms',request,token,{Origin:'http://unrelated.example'})).status,403);
  assert.equal((await post('/api/rooms',{...request,command:'players/cmd/play'},token)).status,400);
  assert.equal((await post('/api/rooms',request,token)).status,409);
  const pin=await post('/api/security/set-pin',{pin:'849261',confirmation:'849261'},token);assert.equal(pin.status,200);
  assert.equal((await(await get('/api/rooms')).json()).locked,true);
  assert.equal((await post('/api/rooms',{action:'group',playerId:'pi',members:['rivo'],confirmed:true,revision:state.revision},token)).status,423);
  assert.equal((await post('/api/rooms',{action:'join',playerId:'pi',targetId:'rivo',confirmed:true,revision:state.revision},token)).status,423);
  assert.equal((await post('/api/rooms',request,token)).status,409,'room volume remains a playback action while settings are locked');
 }finally{if(child.exitCode===null){child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));}rmSync(dir,{recursive:true,force:true});}
});
