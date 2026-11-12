import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {localHttp} from '../deploy/ota/local-http.mjs';

test('OTA backend GETs use fresh sockets across blocked preparation and app disconnects',{timeout:10000},async()=>{
  const code=`import {createServer} from 'node:http';let serial=0;const server=createServer((q,r)=>{if(q.url==='/slow')return;if(q.url==='/abort')return q.socket.destroy();if(q.url==='/large'){r.end('x'.repeat(4096));return;}r.setHeader('Content-Type','application/json');r.end(JSON.stringify({socket:q.socket.serial}));});server.on('connection',s=>s.serial=++serial);server.keepAliveTimeout=100;server.keepAliveTimeoutBuffer=0;server.listen(0,'127.0.0.1',()=>console.log(server.address().port));`;
  const child=spawn(process.execPath,['--input-type=module','-e',code],{stdio:['ignore','pipe','pipe']});
  try{
    const [chunk]=await once(child.stdout,'data'),port=Number(chunk.toString().trim());
    const first=await localHttp('/api/state',{port});assert.equal(first.ok,true);
    // Unlike a timer in this process, the independent server keeps expiring sockets
    // while the updater's event loop is blocked by npm/systemctl.
    execFileSync(process.execPath,['-e','setTimeout(()=>{},300)']);
    const second=await localHttp('/api/state',{port});
    assert.notEqual(JSON.parse(first.body).socket,JSON.parse(second.body).socket);
    await assert.rejects(localHttp('/abort',{port}),e=>e.code==='ECONNRESET'&&e.message.includes('/abort'));
    assert.equal((await localHttp('/api/health',{port})).ok,true);
    await assert.rejects(localHttp('/large',{port,maxBytes:128}),e=>e.code==='EMAXSIZE');
    await assert.rejects(localHttp('/slow',{port,timeoutMs:30}),e=>e.code==='ETIMEDOUT');
  }finally{
    child.kill('SIGTERM');if(child.exitCode===null)await once(child,'exit');
  }
});
test('OTA local requests reject remote or injected paths and invalid bounds',()=>{
  for(const path of ['https://example.com/','//example.com/','/\r\nX-Test: value'])assert.throws(()=>localHttp(path),/Invalid local/);
  assert.throws(()=>localHttp('/api/state',{port:0}),/Invalid local/);
  assert.throws(()=>localHttp('/api/state',{maxBytes:0}),/Invalid local/);
});
