import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer,request} from 'node:http';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {RemoteAccess,remoteAddress,remoteView,remoteEvent,remoteLimits} from '../server/remote-control.js';

const temp=()=>mkdtempSync(join(tmpdir(),'tunebox-remote-'));
const req=(cookie='')=>({headers:{cookie}});

test('a remote QR code pairs exactly one phone and stores only a hash',()=>{
 const dir=temp();let now=1000;
 try{
  const access=new RemoteAccess(dir,{now:()=>now}),{token}=access.createPair();
  assert.equal(access.pairing(),true);
  const {credential}=access.complete(token,'Pixel <script>');
  assert.throws(()=>access.complete(token,'Second'),/expired or was already used/);
  const raw=readFileSync(join(dir,'remote.json'),'utf8');
  assert.equal(raw.includes(credential.split('.')[1]),false);
  assert.equal(statSync(join(dir,'remote.json')).mode&0o777,0o600);
  const phone=access.phone(req('a=b; tunebox_remote='+credential));
  assert.equal(phone.name,'Pixel script');
  const tampered=credential.slice(0,-1)+(credential.endsWith('0')?'1':'0');assert.equal(access.phone(req('tunebox_remote='+tampered)),null);
  assert.match(access.cookie(credential),/HttpOnly; SameSite=Strict/);
  // Survives a restart until forgotten.
  const restarted=new RemoteAccess(dir,{now:()=>now});
  assert.equal(restarted.phone(req('tunebox_remote='+credential)).id,phone.id);
  restarted.forget(phone.id);
  assert.equal(restarted.phone(req('tunebox_remote='+credential)),null);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('remote codes expire, a new code replaces the old one and the phone count is bounded',()=>{
 const dir=temp();let now=0;
 try{
  const access=new RemoteAccess(dir,{now:()=>now});
  const first=access.createPair();now+=remoteLimits.pairMs+1;
  assert.throws(()=>access.complete(first.token),/expired/);
  const a=access.createPair(),b=access.createPair();
  assert.throws(()=>access.complete(a.token),/expired/);
  access.complete(b.token,'One');
  for(let i=1;i<remoteLimits.phones;i++)access.complete(access.createPair().token,'P'+i);
  assert.throws(()=>access.createPair(),/Forget a phone/);
  assert.deepEqual(access.forgetAll(),[]);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('corrupt remote storage pairs nothing',()=>{
 const dir=temp();
 try{writeFileSync(join(dir,'remote.json'),'{broken');const access=new RemoteAccess(dir);assert.equal(access.invalid,true);assert.deepEqual(access.list(),[]);}
 finally{rmSync(dir,{recursive:true,force:true});}
});

test('the remote LAN address never offers the setup hotspot or loopback',()=>{
 assert.equal(remoteAddress({lo:[{family:'IPv4',address:'127.0.0.1',internal:true}],wlan0:[{family:'IPv4',address:'10.42.0.1',internal:false},{family:'IPv4',address:'192.168.1.20',internal:false}]}),'192.168.1.20');
 assert.equal(remoteAddress({wlan0:[{family:'IPv4',address:'192.168.1.20'}],eth0:[{family:'IPv4',address:'192.168.1.21'}]}),'192.168.1.21');
 assert.equal(remoteAddress({wlan0:[{family:'IPv4',address:'169.254.3.3'}]}),null);
});

test('the remote view exposes playback only',()=>{
 const view=remoteView({mode:'music-assistant',musicAssistant:{status:'connected',volumeLimit:40},preferences:{maxVolume:35,prefs:{volumeLimitConfigured:true}},hostTelemetry:{secret:1},playback:{connected:true,playing:true,index:0,volume:20,muted:false,queue:[{title:'Song',artist:'A',album:'B',duration:100,artwork:'/api/artwork/abc'}]}});
 assert.equal(view.playback.title,'Song');assert.equal(view.volumeLimit,35);assert.equal(view.searchAvailable,true);
 assert.equal(JSON.stringify(view).includes('secret'),false);
 const bt=remoteView({bluetooth:{active:true,volume:12,limit:30},playback:{queue:[]}});
 assert.equal(bt.playback.volume,12);assert.equal(bt.volumeLimit,30);assert.equal(bt.searchAvailable,false);
});
test('the remote mirrors the TuneBox style and what plays next, without telemetry or settings',()=>{
 const view=remoteView({mode:'music-assistant',preferences:{themePreferences:{selected:'cinematic',mode:'manual'},clock:{timeZone:'Europe/Amsterdam'}},hostTelemetry:{power:{watts:12}},
  playback:{index:0,sourceFormat:{codec:'flac',sampleRate:96000,bitDepth:24},queue:[{title:'Now'},{title:'Next song',artist:'Next artist',artwork:'/api/artwork/x'}]}});
 assert.deepEqual(view.playback.next,{title:'Next song',artist:'Next artist'});assert.equal(view.playback.quality,'FLAC · 96 kHz · 24-bit');
 assert.equal(view.style.skin,'cinematic');assert.match(view.style.font,/Inter/);assert.match(view.style.accent,/^#[0-9a-f]{6}$/i);
 assert.deepEqual(Object.keys(view.style).sort(),['accent','background','font','muted','radius','skin','surface','text','weight']);
 const json=JSON.stringify(view);for(const word of ['watts','timeZone','themePreferences'])assert.equal(json.includes(word),false,word);
 const bt=remoteView({bluetooth:{active:true,volume:5,limit:30},playback:{index:0,queue:[{title:'Phone'},{title:'Hidden'}],sourceFormat:{codec:'aac'}}});
 assert.equal(bt.playback.next,null);assert.equal(bt.playback.quality,null);
});

test('remote notifications carry only id, title and a short detail',()=>{
 const view=remoteView({playback:{queue:[]}},{notifications:[{id:'update',title:'Update available',detail:'2026.11.20',section:'updates',icon:'update',secret:1},{id:'x'},{title:'no id'}]});
 assert.deepEqual(view.notifications,[{id:'update',title:'Update available',detail:'2026.11.20'}]);assert.deepEqual(remoteView({playback:{queue:[]}}).notifications,[]);
});
test('remote commands are allowlisted and volume rises in bounded steps',()=>{
 const view={playback:{volume:20},volumeLimit:40};
 assert.deepEqual(remoteEvent({type:'pause'},view),{type:'pause'});
 assert.deepEqual(remoteEvent({type:'volume',value:100},view),{type:'volume',value:30});
 assert.deepEqual(remoteEvent({type:'volume',value:5},view),{type:'volume',value:5});
 assert.deepEqual(remoteEvent({type:'mute',value:true},view),{type:'mute',value:true});
 for(const bad of [{type:'seek',position:3},{type:'queue-remove',id:'x'},{type:'pause',extra:1},{type:'volume',value:'loud'},{type:'mute',value:1},null,[]])assert.throws(()=>remoteEvent(bad,view));
 assert.throws(()=>remoteEvent({type:'volume',value:10},{playback:{volume:null},volumeLimit:40}),/not available/);
});

const freePort=async()=>{const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));return port;};
const call=(port,path,{method='GET',headers={},body}={})=>new Promise((resolve,reject)=>{const data=body===undefined?null:JSON.stringify(body);const q=request({host:'127.0.0.1',port,path,method,headers:{...(data?{'Content-Type':'application/json'}:{}),...headers}},r=>{let text='';r.on('data',c=>text+=c);r.on('end',()=>{let json=null;try{json=JSON.parse(text);}catch{}resolve({status:r.statusCode,headers:r.headers,json,text});});});q.once('error',reject);if(data)q.write(data);q.end();});

test('HTTP: the remote listener pairs from the wall QR code and only reaches playback',async()=>{
 const dir=temp(),port=await freePort(),remotePort=await freePort();
 const child=spawn(process.execPath,['server/index.js'],{env:{...process.env,NODE_ENV:'production',HOST:'127.0.0.1',PORT:String(port),DAW_STATE_DIR:dir,DAW_PLAYBACK_MODE:'simulation',DAW_REMOTE_HOST:'127.0.0.1',DAW_REMOTE_PORT:String(remotePort),DAW_REMOTE_ADDRESS:'127.0.0.1',DAW_REMOTE_IDLE_MS:'100'},stdio:'ignore'});
 try{
  let ready=false;for(let i=0;i<150;i++){try{if((await call(port,'/api/health')).status===200){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,40));}assert.equal(ready,true);
  // No phones paired: nothing listens on the LAN port.
  await assert.rejects(call(remotePort,'/api/remote/session'));
  const token=(await call(port,'/api/updates')).json.controlToken,wall={'X-TuneBox-Control':token};
  assert.equal((await call(port,'/api/remote/pairing',{method:'POST',body:{action:'start'}})).status,403);
  const shown=await call(port,'/api/remote/pairing',{method:'POST',headers:wall,body:{action:'start'}});
  assert.equal(shown.status,200);assert.match(shown.json.url,new RegExp(`^http://127\\.0\\.0\\.1:${remotePort}/remote\\.html#pair=[a-f0-9]{48}$`));
  const pair=shown.json.url.split('#pair=')[1];
  // Kiosk-only management is not reachable from the phone listener, and phone routes are not on the kiosk port.
  assert.equal((await call(remotePort,'/api/remote/pairing',{method:'POST',body:{action:'start'}})).status,403);
  assert.equal((await call(port,'/api/remote/state')).status,404);
  assert.equal((await call(remotePort,'/api/remote/state')).status,401);
  assert.equal((await call(remotePort,'/')).headers.location,'/remote.html');
  const wrong=await call(remotePort,'/api/remote/pair',{method:'POST',body:{token:'0'.repeat(48),name:'Evil'}});assert.equal(wrong.status,403);
  const paired=await call(remotePort,'/api/remote/pair',{method:'POST',body:{token:pair,name:'Phone'}});
  assert.equal(paired.status,200);const cookie=paired.headers['set-cookie'][0].split(';')[0];
  assert.equal((await call(remotePort,'/api/remote/pair',{method:'POST',body:{token:pair,name:'Again'}})).status,403);
  const phone={Cookie:cookie};
  // GUI 3.15: a paired phone can invite one more phone with a fresh single-use code; unpaired callers cannot.
  assert.equal((await call(remotePort,'/api/remote/invite',{method:'POST',body:{}})).status,401);
  const invite=await call(remotePort,'/api/remote/invite',{method:'POST',headers:phone,body:{}});assert.equal(invite.status,200);assert.match(invite.json.url,new RegExp(`^http://127\\.0\\.0\\.1:${remotePort}/remote\\.html#pair=[a-f0-9]{48}$`));assert.equal(invite.json.pinRequired,false);
  assert.equal((await call(port,'/api/remote/invite',{method:'POST',headers:wall,body:{}})).status,404);
  const second=await call(remotePort,'/api/remote/pair',{method:'POST',body:{token:invite.json.url.split('#pair=')[1],name:'Friend'}});assert.equal(second.status,200);
  const friend=(await call(port,'/api/remote/phones')).json.phones.find(p=>p.name==='Friend');assert.ok(friend);assert.equal((await call(port,'/api/remote/forget',{method:'POST',headers:wall,body:{id:friend.id}})).status,200);
  const state=await call(remotePort,'/api/remote/state',{headers:phone});assert.equal(state.status,200);assert.equal(state.json.playback.volume,32);
  for(const path of ['/api/state','/api/updates','/api/preferences','/api/system','/api/network','/api/security/status','/api/remote/phones'])assert.equal((await call(remotePort,path,{headers:phone})).status,403,path);
  for(const [path,body] of [['/api/event',{type:'pause'}],['/api/preferences',{revision:0,patch:{}}],['/api/device',{command:'wifi'}],['/api/reset',{}],['/api/remote/forget',{all:true}]])assert.equal((await call(remotePort,path,{method:'POST',headers:phone,body})).status,403,path);
  const play=await call(remotePort,'/api/remote/event',{method:'POST',headers:phone,body:{type:'play'}});assert.equal(play.status,200);assert.equal(play.json.playback.playing,true);
  const loud=await call(remotePort,'/api/remote/event',{method:'POST',headers:phone,body:{type:'volume',value:100}});assert.equal(loud.status,200);assert.equal(loud.json.playback.volume,42);
  assert.equal((await call(remotePort,'/api/remote/event',{method:'POST',headers:phone,body:{type:'seek',position:9}})).status,409);
  assert.equal((await call(remotePort,'/api/remote/event',{method:'POST',headers:{...phone,Origin:'http://attacker.example'},body:{type:'pause'}})).status,403);
  assert.equal((await call(remotePort,'/api/remote/search?q=x',{headers:phone})).json.error,'Search needs Music Assistant');
  const listed=await call(port,'/api/remote/phones');assert.equal(listed.json.phones.length,1);assert.equal(listed.json.phones[0].name,'Phone');
  assert.equal(JSON.stringify(listed.json).includes(cookie.split('.')[1]),false);
  const forgot=await call(port,'/api/remote/forget',{method:'POST',headers:wall,body:{id:listed.json.phones[0].id}});assert.equal(forgot.status,200);assert.deepEqual(forgot.json.phones,[]);
  // Briefly, a revoked phone is told to scan again; then the LAN listener closes.
  assert.equal((await call(remotePort,'/api/remote/state',{headers:phone})).status,401);
  await new Promise(r=>setTimeout(r,300));
  await assert.rejects(call(remotePort,'/api/remote/state',{headers:phone}));
 }finally{const ended=once(child,'exit');child.kill('SIGTERM');await ended;rmSync(dir,{recursive:true,force:true});}
});

test('HTTP: with a PIN, pairing a phone needs the unlocked wall settings',async()=>{
 const dir=temp(),port=await freePort(),remotePort=await freePort();
 const child=spawn(process.execPath,['server/index.js'],{env:{...process.env,NODE_ENV:'production',HOST:'127.0.0.1',PORT:String(port),DAW_STATE_DIR:dir,DAW_PLAYBACK_MODE:'simulation',DAW_REMOTE_HOST:'127.0.0.1',DAW_REMOTE_PORT:String(remotePort),DAW_REMOTE_ADDRESS:'127.0.0.1'},stdio:'ignore'});
 try{
  let ready=false;for(let i=0;i<150;i++){try{if((await call(port,'/api/health')).status===200){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,40));}assert.equal(ready,true);
  const token=(await call(port,'/api/updates')).json.controlToken,wall={'X-TuneBox-Control':token};
  const set=await call(port,'/api/security/set-pin',{method:'POST',headers:wall,body:{pin:'572941',confirmation:'572941'}});assert.equal(set.status,200);
  assert.equal((await call(port,'/api/remote/pairing',{method:'POST',headers:wall,body:{action:'start'}})).status,423);
  assert.equal((await call(port,'/api/remote/phones')).status,423);
  const admin=set.headers['set-cookie'][0].split(';')[0];
  assert.equal((await call(port,'/api/remote/pairing',{method:'POST',headers:{...wall,Cookie:admin},body:{action:'start'}})).status,200);
  // GUI 3.12 PARTY: the wall can show the code without unlocking, but then the phone needs the PIN.
  assert.equal((await call(port,'/api/remote/party',{method:'POST',body:{action:'start'}})).status,403,'device token still required');
  const party=await call(port,'/api/remote/party',{method:'POST',headers:wall,body:{action:'start'}});
  assert.equal(party.status,200);assert.equal(typeof party.json.phones,'number','no phone names without unlocking');assert.equal(party.json.pinRequired,true);
  const code=party.json.url.split('#pair=')[1];
  const ask=await call(remotePort,'/api/remote/pair',{method:'POST',body:{token:code,name:'Guest'}});assert.equal(ask.status,403);assert.equal(ask.json.code,'pin-required');
  const typo=await call(remotePort,'/api/remote/pair',{method:'POST',body:{token:code,name:'Guest',pin:'000000'}});assert.equal(typo.status,403);assert.equal(typo.json.code,'pin-wrong');
  const ok=await call(remotePort,'/api/remote/pair',{method:'POST',body:{token:code,name:'Guest',pin:'572941'}});assert.equal(ok.status,200,'a typo does not use up the code');
  assert.equal((await call(remotePort,'/api/remote/pair',{method:'POST',body:{token:code,name:'Again',pin:'572941'}})).status,403,'single use');
 }finally{const ended=once(child,'exit');child.kill('SIGTERM');await ended;rmSync(dir,{recursive:true,force:true});}
});
