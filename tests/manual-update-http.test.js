import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('the authenticated manual-install API pauses simulation; rejected requests leave playback running',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'tunebox-manual-update-'));
  const listener=createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));
  const port=listener.address().port;await new Promise(r=>listener.close(r));
  const origin='http://127.0.0.1:'+port;
  const child=spawn(process.execPath,['server/index.js'],{env:{...process.env,NODE_ENV:'development',HOST:'127.0.0.1',PORT:String(port),DAW_STATE_DIR:directory,DAW_PLAYBACK_MODE:'simulation',DAW_MANAGER_SOCKET:''},stdio:'ignore'});
  const get=async path=>{const r=await fetch(origin+path);assert.equal(r.status,200);return r.json();};
  const post=(path,body,token,extra={})=>fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{'X-TuneBox-Control':token}:{}),...extra},body:JSON.stringify(body)});
  try{
    let ready=false;for(let i=0;i<100;i++){try{if((await fetch(origin+'/api/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,50));}assert.ok(ready);
    const token=(await get('/api/updates')).controlToken;
    assert.equal((await post('/api/scenario',{name:'Playback'})).status,200);
    assert.equal((await get('/api/state')).playback.playing,true);
    assert.equal((await post('/api/device',{command:'install'},token)).status,409,'no available release must not pause music');
    assert.equal((await post('/api/device',{command:'check'},token)).status,200);
    for(const [body,auth,extra,expected] of [
      [{command:'install'},null,{},403],
      [{command:'install'},token,{Origin:'http://unrelated.example'},403],
      [{command:'install',args:{shell:'bad'}},token,{},409],
      [{command:'install',args:{pauseGroup:true}},token,{},409],
    ]){
      assert.equal((await post('/api/device',body,auth,extra)).status,expected);assert.equal((await get('/api/state')).playback.playing,true);
    }
    const response=await post('/api/device',{command:'install'},token);assert.equal(response.status,200);assert.equal((await response.json()).pausedForUpdate,true);
    assert.equal((await get('/api/state')).playback.playing,false);
    let installed=false;for(let i=0;i<100;i++){if((await get('/api/updates')).status==='installed'){installed=true;break;}await new Promise(r=>setTimeout(r,100));}assert.ok(installed);
    assert.equal((await get('/api/state')).playback.playing,false,'completion must not unexpectedly resume music');
    await post('/api/scenario',{name:'Playback'});
    assert.equal((await post('/api/security/set-pin',{pin:'849261',confirmation:'849261'},token)).status,200);
    assert.equal((await post('/api/device',{command:'install'},token)).status,423);
    assert.equal((await get('/api/state')).playback.playing,true,'locked settings cannot pause playback through install');
  }finally{
    if(child.exitCode===null){child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));}
    rmSync(directory,{recursive:true,force:true});
  }
});
