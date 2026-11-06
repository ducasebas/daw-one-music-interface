import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {createServer} from 'node:net';
import {validateRequest,DeviceManager} from '../shared/device-manager.js';
import {updateSettings,insideWindow,installationDecision} from '../shared/update-settings.js';
import {setEnvironment} from '../deploy/manager/root-adapter.mjs';
import {simulatedDevice} from '../server/simulated-device.js';
import {deviceRequest,controlToken,validDeviceRequest} from '../server/device-client.js';
import {restorePrevious} from '../deploy/ota/policy.mjs';
import {createProgressServer} from '../deploy/manager/progress-server.mjs';
const idle={mode:'simulation',device:{mode:'ready',amplifierEnabled:false,faults:[]},playback:{playing:false}};
test('update policy validates timezone, overnight windows and safety precedence',()=>{
 const p=updateSettings({mode:'auto',windowEnabled:true,start:'23:00',end:'03:00'});
 assert.equal(insideWindow(p,new Date('2026-11-06T00:30:00Z')),true);assert.equal(insideWindow(p,new Date('2026-11-06T12:00:00Z')),false);
 assert.equal(installationDecision(p,'auto',true,new Date('2026-11-06T12:00:00Z')),'waiting-window');
 assert.equal(installationDecision(p,'install',true,new Date('2026-11-06T12:00:00Z')),'install');
 assert.equal(installationDecision(p,'install',false),'waiting-idle');
 assert.equal(installationDecision(updateSettings({mode:'notify'}),'auto',true),'available');
 assert.equal(installationDecision(updateSettings({mode:'paused'}),'auto',true),'paused');
 assert.equal(insideWindow(updateSettings({windowEnabled:true,start:'02:00',end:'04:00'}),new Date('2026-03-29T01:30:00Z')),true);
 for(const value of [{mode:'shell'},{start:'25:00'},{timeZone:'bad/timezone'},{path:'/root'},{windowEnabled:'true'}])assert.throws(()=>updateSettings(value));
});
test('device protocol accepts only fixed commands and local MA credentials',()=>{
 assert.equal(validateRequest({command:'probe-music',args:{url:'http://10.69.0.10:8095/ws',token:'test'}}).command,'probe-music');
 for(const value of [{command:'exec',args:{}},{command:'install',args:{path:'/tmp/evil'}},{command:'rollback',args:{commit:'../etc'}},{command:'probe-music',args:{url:'http://169.254.169.254/'}},{command:'probe-music',args:{url:'http://example.com/'}},{command:'probe-music',args:{url:'http://user:pw@localhost/'}},{command:'probe-music',args:{url:'http://localhost/',token:'bad\nvalue'}},{command:'wifi',args:{interface:'eth0',ssid:'home',password:'testpass'}},{command:'audio-test',args:{device:'hw:CARD=UnverifiedHat'}},{command:'status',extra:'x'}])assert.throws(()=>validateRequest(value));
});
test('same-origin device commands require a fresh process token and reject cross-site or malformed headers',()=>{
 const request=values=>({get:key=>values[key]});
 assert.equal(validDeviceRequest(request({'X-TuneBox-Control':controlToken,Origin:'http://localhost:5173',host:'localhost:5173'})),true);
 for(const values of [{},{'X-TuneBox-Control':'ü'.repeat(48)},{'X-TuneBox-Control':controlToken,'Sec-Fetch-Site':'cross-site'},{'X-TuneBox-Control':controlToken,Origin:'http://evil.test',host:'localhost:5173'}])assert.equal(validDeviceRequest(request(values)),false);
});
test('configuration editing cannot inject systemd environment assignments or erase unrelated settings',()=>{
 assert.equal(setEnvironment('OTHER=keep\nMA_URL=old\n',{MA_URL:'http://10.0.0.1:8095'}),'OTHER=keep\nMA_URL=http://10.0.0.1:8095\n');
 assert.throws(()=>setEnvironment('',{MA_URL:'x\nLD_PRELOAD=bad'}));assert.throws(()=>setEnvironment('',{'BAD=KEY':'x'}));
});
test('manager serialises mutations while still permitting status requests',async()=>{
 let release;const pending=new Promise(r=>release=r);const manager=new DeviceManager({status:()=>({busy:true}),perform:()=>pending});
 const first=manager.request({command:'check'});await assert.rejects(manager.request({command:'install'}),/already running/);assert.equal((await manager.request({command:'status'})).busy,true);release({queued:true});await first;
});
test('local Unix bridge returns only protocol result without invoking a shell',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'tb-socket-')),path=join(dir,'control.sock');const server=createServer(c=>c.once('data',()=>c.end(JSON.stringify({ok:true,result:{managed:true}})+'\n')));
 try{await new Promise(r=>server.listen(path,r));assert.deepEqual(await deviceRequest({command:'status'},path),{managed:true});}finally{await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});}
});
test('simulation persists policy, does not persist credentials, and shares activation / rollback logic',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'tb-manager-'));
 try{const manager=simulatedDevice({snapshot:()=>idle,directory:dir,delay:1});await manager.request({command:'policy',args:{mode:'paused'}});await manager.request({command:'probe-music',args:{url:'http://localhost:8095',token:'never-save-this'}});assert.equal(readFileSync(join(dir,'device.json'),'utf8').includes('never-save-this'),false);
 assert.equal((await simulatedDevice({snapshot:()=>idle,directory:dir}).request({command:'status'})).policy.mode,'paused');
 await manager.request({command:'check'});await manager.request({command:'install'});
 for(let i=0;i<80&&manager.status().status!=='installed';i++)await new Promise(r=>setTimeout(r,5));assert.equal(manager.status().status,'installed');
 await manager.request({command:'rollback'});for(let i=0;i<80&&manager.status().status!=='rolled-back';i++)await new Promise(r=>setTimeout(r,5));assert.equal(manager.status().status,'rolled-back');assert.equal((await manager.request({command:'status'})).policy.mode,'paused');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('manual rollback restores current slot if previous version fails health',async()=>{
 let selected='current',journal=true;const host={current:async()=>selected,journal:async()=>{},stop:async()=>{},select:async v=>selected=v,start:async()=>{},healthy:async()=>selected==='current',commitRollback:async()=>assert.fail('unhealthy previous must not commit'),clearJournal:async()=>journal=false};
 await assert.rejects(restorePrevious(host,'previous'),/current application restored/);assert.equal(selected,'current');assert.equal(journal,false);
});
test('independent progress server serves progress with the backend completely unavailable and has no HTTP control API',async()=>{
 const server=createProgressServer({getStatus:()=>({status:'restarting',percent:null}),isAppReady:async()=>false});
 try{await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;const response=await fetch(origin+'/');assert.equal(response.status,200);assert.match(await response.text(),/Updatevoortgang/);assert.deepEqual(await(await fetch(origin+'/status')).json(),{status:'restarting',percent:null,appReady:false});assert.equal((await fetch(origin+'/status',{method:'POST'})).status,404);}finally{await new Promise(r=>server.close(r));}
});
