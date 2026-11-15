import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('authenticated physical wake requests Home without changing playback, including with a locked PIN',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'tunebox-button-wake-')),file=join(directory,'button-token'),buttonToken='a'.repeat(64);
 writeFileSync(file,buttonToken+'\n');
 const listener=createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
 const child=spawn(process.execPath,['server/index.js'],{env:{...process.env,NODE_ENV:'production',HOST:'127.0.0.1',PORT:String(port),DAW_STATE_DIR:directory,DAW_BUTTON_TOKEN_FILE:file,DAW_PLAYBACK_MODE:'simulation'},stdio:'ignore'});
 const base='http://127.0.0.1:'+port;
 const get=async path=>(await fetch(base+path)).json();
 const post=(path,data,headers={})=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
 try{
  let ready=false;for(let i=0;i<80;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,50));}assert.ok(ready);
  const before=await get('/api/state'),controlToken=(await get('/api/updates')).controlToken;
  assert.equal((await post('/api/button',{type:'short'})).status,403);
  assert.equal((await post('/api/event',{type:'display-timeout'},{'X-TuneBox-Control':controlToken})).status,200);
  assert.equal((await get('/api/state')).device.displayAwake,false);
  assert.equal((await post('/api/security/set-pin',{pin:'849261',confirmation:'849261'},{'X-TuneBox-Control':controlToken})).status,200);
  assert.equal((await post('/api/button',{type:'short'},{'X-TuneBox-Button':buttonToken})).status,200);
  const awake=await get('/api/state');assert.equal(awake.device.displayAwake,true);assert.match(awake.navigation.buttonWakeId,/^[a-f0-9-]{36}$/);
  assert.equal(awake.playback.playing,before.playback.playing);assert.equal(awake.device.amplifierEnabled,before.device.amplifierEnabled);
  await post('/api/button',{type:'short'},{'X-TuneBox-Button':buttonToken});assert.equal((await get('/api/state')).device.displayAwake,false);
  await post('/api/button',{type:'short'},{'X-TuneBox-Button':buttonToken});assert.notEqual((await get('/api/state')).navigation.buttonWakeId,awake.navigation.buttonWakeId);
 }finally{if(child.exitCode===null){child.kill('SIGTERM');await new Promise(resolve=>child.once('exit',resolve));}rmSync(directory,{recursive:true,force:true});}
});
