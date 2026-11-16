import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer,request} from 'node:http';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,symlinkSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {atomicJson} from '../deploy/manager/io.mjs';
test('production API rejects DNS-rebinding and forged proxy origins before exposing credentials or controls',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'tunebox-host-')),reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
 const child=spawn(process.execPath,['server/index.js'],{env:{...process.env,NODE_ENV:'production',HOST:'127.0.0.1',PORT:String(port),DAW_STATE_DIR:dir,DAW_PLAYBACK_MODE:'simulation'},stdio:'ignore'});
 const get=(path,headers={},method='GET')=>new Promise((resolve,reject)=>{const q=request({host:'127.0.0.1',port,path,headers,method},r=>{let body='';r.on('data',c=>body+=c);r.on('end',()=>resolve({status:r.statusCode,headers:r.headers,body}));});q.once('error',reject);q.end();});
 try{
  let ready=false;for(let i=0;i<100;i++){try{if((await get('/api/health')).status===200){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,40));}assert.equal(ready,true);
  const normal=await get('/api/updates');assert.equal(normal.status,200);assert.equal(normal.headers['x-content-type-options'],'nosniff');assert.match(normal.headers['content-security-policy'],/frame-ancestors 'self'/);assert.ok(JSON.parse(normal.body).controlToken);
  for(const headers of [{Host:'attacker.example'},{Origin:'https://attacker.example','X-Forwarded-Host':'attacker.example'},{'Sec-Fetch-Site':'cross-site'}]){
   const r=await get('/api/updates',headers);assert.equal(r.status,403);assert.equal(r.body.includes('controlToken'),false);
  }
  const evil=await get('/api/preferences',{Origin:'http://attacker.local','X-Forwarded-Host':'attacker.local','X-TuneBox-Control':JSON.parse(normal.body).controlToken},'POST');assert.equal(evil.status,403);
 }finally{const ended=once(child,'exit');child.kill('SIGTERM');await ended;rmSync(dir,{recursive:true,force:true});}
});
test('root atomic writes do not follow a predictable temporary-file symlink',()=>{
 const dir=mkdtempSync(join(tmpdir(),'tunebox-atomic-'));try{const path=join(dir,'status.json'),victim=join(dir,'private');writeFileSync(victim,'keep');symlinkSync(victim,path+'.tmp');atomicJson(path,{ok:true});assert.equal(readFileSync(victim,'utf8'),'keep');assert.deepEqual(JSON.parse(readFileSync(path)),{ok:true});}finally{rmSync(dir,{recursive:true,force:true});}
});
test('explicit group-readable telemetry survives the manager private umask without world access',()=>{
 const dir=mkdtempSync(join(tmpdir(),'tunebox-umask-')),previous=process.umask(0o077);try{const path=join(dir,'source.json');atomicJson(path,{active:true},0o640);assert.equal(statSync(path).mode&0o777,0o640);}finally{process.umask(previous);rmSync(dir,{recursive:true,force:true});}
});
