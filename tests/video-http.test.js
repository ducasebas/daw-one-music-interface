import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('rejected video uploads finish receiving the body before replying on a closing HTTP connection',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'tunebox-video-http-'));
 const listener=createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
 const origin='http://127.0.0.1:'+port;
 const child=spawn(process.execPath,['server/index.js'],{env:{...process.env,NODE_ENV:'production',HOST:'127.0.0.1',PORT:String(port),DAW_STATE_DIR:dir,DAW_PLAYBACK_MODE:'simulation'},stdio:'ignore'});
 const get=async path=>(await fetch(origin+path)).json();
 const post=(path,body)=>fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{
  let ready=false;for(let i=0;i<80;i++){try{if((await fetch(origin+'/api/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,50));}assert.ok(ready,'backend starts');
  const token=(await get('/api/updates')).controlToken;
  await post('/api/scenario',{name:'Playback'});const track=(await get('/api/video')).trackKey;
  await post('/api/event',{type:'next'});assert.notEqual((await get('/api/video')).trackKey,track);
  for(const [nonce,status] of [[token,409],['invalid',403]]){
   const bytes=Buffer.alloc(256*1024);let sent=false,timer;
   const result=await new Promise((resolve,reject)=>{
    const req=request(origin+'/api/video/upload',{method:'POST',headers:{Connection:'close','Content-Type':'video/webm','Content-Length':bytes.length,'X-TuneBox-Control':nonce,'X-TuneBox-Track':track}},res=>{
     const bodySent=sent;let body='';res.setEncoding('utf8');res.on('data',c=>body+=c);res.on('end',()=>{clearTimeout(timer);resolve({status:res.statusCode,bodySent,body});});
    });
    req.on('error',e=>{clearTimeout(timer);reject(e);});req.setTimeout(5000,()=>req.destroy(Error('Upload rejection timed out')));
    req.write(bytes.subarray(0,16384));timer=setTimeout(()=>{sent=true;req.end(bytes.subarray(16384));},75);
   });
   assert.equal(result.status,status);assert.equal(result.bodySent,true,'reply must not race the remaining upload bytes');assert.ok(JSON.parse(result.body).error);
  }
  assert.equal((await get('/api/health')).ok,true);
 }finally{if(child.exitCode===null){child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));}rmSync(dir,{recursive:true,force:true});}
});
