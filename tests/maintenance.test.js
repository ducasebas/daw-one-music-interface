import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,readdirSync,copyFileSync,rmSync,statSync} from 'node:fs';
import {join,dirname,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {systemPayload,maintenancePlan,maintenanceBody,maintainSoftware,verifyInstalledBaseline,recordMaintenance,maintenanceState,interruptedMaintenance,updaterFiles} from '../deploy/ota/maintenance.mjs';
import {maintainAppliance} from '../deploy/ota/appliance.mjs';
import {maintainAppliance as legacyAppliance} from './fixtures/ota-3.16.4/appliance.mjs';
import {publicUpdateStatus,publicMaintenance} from '../server/update-status.js';

const linux=process.platform==='linux';
const digest=data=>createHash('sha256').update(data).digest('hex');
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const legacy=p=>readFileSync(new URL('./fixtures/ota-3.16.4/'+p,import.meta.url),'utf8');
const put=(path,data)=>{mkdirSync(dirname(path),{recursive:true});writeFileSync(path,data);};
function manifest(root,files,release='old'){
 for(const [p,data] of Object.entries(files))put(join(root,p),data);
 put(join(root,'release-manifest.json'),JSON.stringify({schema:1,release,files:Object.entries(files).map(([path,data])=>({path,sha256:digest(data)}))}));
}
function inventory(root,name){
 const lines=[];
 const walk=dir=>{for(const item of readdirSync(dir,{withFileTypes:true})){const p=join(dir,item.name);if(item.isDirectory())walk(p);else if(item.name!==name)lines.push(digest(readFileSync(p))+'  '+p+'\n');}};
 walk(root);put(join(root,name),lines.join(''));
}
function fixture(t,{tools=false,progress=true}={}){
 const root=mkdtempSync(join(tmpdir(),'tb-maintenance-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const paths={current:join(root,'app'),updater:join(root,'lib/updater'),manager:join(root,'lib/control'),display:join(root,'lib/display'),units:join(root,'units'),state:join(root,'state/maintenance.json'),status:join(root,'status/status.json')};
 for(const p of [paths.current,paths.updater,paths.manager,paths.display,paths.units,dirname(paths.state),dirname(paths.status)])mkdirSync(p,{recursive:true});
 const files={
  'package.json':'{"type":"module"}\n',
  'deploy/update-appliance.sh':legacy('update-appliance.sh'),
  'deploy/install-ota.sh':legacy('install-ota.sh'),
  'deploy/host-files.py':source('deploy/host-files.py'),
  'deploy/manager/check-imports.mjs':source('deploy/manager/check-imports.mjs'),
  'deploy/manager/service.mjs':"import '../../server/update-status.js';\n",
  'deploy/manager/progress.html':legacy('progress.html'),
  'deploy/display/control.py':'def loop(): pass\n',
  'deploy/ota/appliance.mjs':legacy('appliance.mjs'),
  'deploy/ota/update.mjs':"import './appliance.mjs';\n",
  'server/update-status.js':legacy('update-status.js'),
  'server/ma-transport.js':'export const transport=true;\n',
  'shared/update-settings.js':'export const updateSettings=()=>({});\n',
  'shared/release.js':'export const release={id:"old"};\n',
  'shared/locales/en.json':'{"hello":"Hello"}',
  'dist/appliance.js':'// touch boundary\n',
  'dist/appliance.css':'html{cursor:none}\n',
  'dist/assets/app.js':'// old app\n',
 };
 for(const n of updaterFiles)if(n!=='maintenance.mjs'&&!files['deploy/ota/'+n])files['deploy/ota/'+n]=n.endsWith('.py')?'print("extract")\n':'export const module=true;\n';
 manifest(paths.current,files);
 for(const [p,data] of Object.entries(files)){
  if(p.startsWith('deploy/ota/')&&updaterFiles.includes(basename(p)))put(join(paths.updater,basename(p)),data);
  if(p==='shared/update-settings.js')put(join(paths.updater,'settings.mjs'),data);
  if(/^shared\/[^/]+\.js$/.test(p)||p.startsWith('server/')||p.startsWith('deploy/manager/')||p==='deploy/ota/policy.mjs')put(join(paths.manager,p),data);
  if(p==='dist/appliance.js'||p==='dist/appliance.css')put(join(paths.manager,'public',basename(p)),data);
 }
 put(join(paths.manager,'package.json'),files['package.json']);put(join(paths.display,'control.py'),files['deploy/display/control.py']);
 inventory(paths.updater,'updater.sha256');inventory(paths.manager,'manager.sha256');inventory(paths.display,'controller.sha256');
 const before=systemPayload(paths.current);
 put(join(paths.units,'daw-one-update.service'),before.service);put(join(paths.units,'daw-one-update.timer'),before.timer);
 const candidate=join(root,'candidate'),next={...files,'shared/release.js':'export const release={id:"new"};\n','shared/locales/en.json':'{"hello":"Welcome"}','dist/assets/app.js':'// new GUI\n'};
 if(tools){
  for(const p of ['deploy/update-appliance.sh','deploy/install-ota.sh','deploy/ota/appliance.mjs','deploy/ota/maintenance.mjs'])next[p]=source(p);
  if(progress){next['deploy/manager/progress.html']=source('deploy/manager/progress.html');next['server/update-status.js']=source('server/update-status.js');}
 }
 manifest(candidate,next,'new');put(paths.status,JSON.stringify({status:'installing',available:{release:'new'},startedAt:'2026-11-25T12:00:00Z'}));
 const calls=[];
 const run=(cmd,args)=>{
  calls.push({cmd,args:[...args]});
  if(cmd==='/usr/bin/logger'||cmd==='/usr/bin/systemctl'||cmd==='/usr/bin/curl'||cmd==='/usr/bin/env')return Buffer.from('');
  return execFileSync(cmd==='/usr/bin/node'?process.execPath:cmd,args,{stdio:'pipe',timeout:15000});
 };
 return {root,paths,files,next,candidate,calls,run,update:()=>manifest(candidate,next,'new')};
}

test('GUI, locale and version changes do not require a host refresh',t=>{
 const f=fixture(t),plan=maintenancePlan(systemPayload(f.paths.current),systemPayload(f.candidate));
 assert.deepEqual(plan,{kind:'none',changed:[],progress:false});
});
test('unused GUI helpers and publishing scripts do not trigger host maintenance',t=>{
 const f=fixture(t);
 f.files['shared/wall.js']='export const layout="old";\n';f.next['shared/wall.js']='export const layout="new";\n';
 f.files['deploy/ota/check-channel.mjs']='// old publisher\n';f.next['deploy/ota/check-channel.mjs']='// new publisher\n';
 manifest(f.paths.current,f.files);f.update();assert.equal(maintenancePlan(systemPayload(f.paths.current),systemPayload(f.candidate)).kind,'none');
 f.files['deploy/manager/service.mjs']+="import {layout} from '../../shared/wall.js';\n";
 f.next['deploy/manager/service.mjs']=f.files['deploy/manager/service.mjs'];manifest(f.paths.current,f.files);f.update();
 assert.equal(maintenancePlan(systemPayload(f.paths.current),systemPayload(f.candidate)).kind,'system');
});
test('the real legacy maintenance body and unit templates stay unchanged in the bootstrap',t=>{
 const f=fixture(t,{tools:true}),before=systemPayload(f.paths.current),after=systemPayload(f.candidate),plan=maintenancePlan(before,after);
 assert.equal(maintenanceBody(legacy('update-appliance.sh')),maintenanceBody(source('deploy/update-appliance.sh')));
 assert.equal(before.service,after.service);assert.equal(before.timer,after.timer);
 assert.equal(plan.kind,'update-tools');assert.equal(plan.progress,true);assert.ok(plan.changed.includes('deploy/ota/maintenance.mjs'));
});
test('real hardware, shared policy, kiosk, and service-template changes require a system update',t=>{
 const f=fixture(t,{tools:true}),before=systemPayload(f.paths.current);
 for(const p of ['deploy/display/control.py','deploy/ota/policy.mjs','shared/update-settings.js','deploy/manager/service.mjs','deploy/ota/migrate-kiosk.py']){
  const saved=f.next[p];f.next[p]=(saved||'')+'\n# changed\n';f.update();
  assert.equal(maintenancePlan(before,systemPayload(f.candidate)).kind,'system',p);
  if(saved===undefined)delete f.next[p];else f.next[p]=saved;
 }
 f.next['deploy/install-ota.sh']=f.next['deploy/install-ota.sh'].replace('TimeoutStartSec=10min','TimeoutStartSec=11min');f.update();
 assert.equal(maintenancePlan(before,systemPayload(f.candidate)).kind,'system');
});
test('a modification to actual maintenance configuration cannot hide behind the bootstrap',t=>{
 const f=fixture(t,{tools:true});f.next['deploy/update-appliance.sh']=f.next['deploy/update-appliance.sh'].replace('RuntimeWatchdogSec=3min','RuntimeWatchdogSec=4min');f.update();
 assert.equal(maintenancePlan(systemPayload(f.paths.current),systemPayload(f.candidate)).kind,'system');
 for(const text of ['# BEGIN TUNEBOX OTA CONTROL\nunfinished','# END TUNEBOX OTA CONTROL','# BEGIN TUNEBOX OTA CONTROL\n# BEGIN TUNEBOX OTA CONTROL'])assert.throws(()=>maintenanceBody(text),/block/);
});
test('missing, modified and duplicate installer inventory entries are refused',t=>{
 const f=fixture(t),path=join(f.candidate,'release-manifest.json'),initial=readFileSync(path,'utf8');
 for(const change of [m=>m.files=m.files.filter(x=>x.path!=='deploy/update-appliance.sh'),m=>m.files.push(m.files[0]),m=>m.files[0].path='../escape']){
  const m=JSON.parse(initial);change(m);put(path,JSON.stringify(m));assert.throws(()=>systemPayload(f.candidate));
 }
 put(path,initial);put(join(f.candidate,'deploy/update-appliance.sh'),'');assert.throws(()=>systemPayload(f.candidate),/empty|inventory/);
});
test('missing, escaping or changed active manager dependencies cannot be ignored',t=>{
 const f=fixture(t);f.next['deploy/manager/service.mjs']="import '../../shared/missing.js';\n";f.update();
 assert.throws(()=>systemPayload(f.candidate),/dependency is missing/);
 f.next['deploy/manager/service.mjs']="import '../../../escape.js';\n";f.update();assert.throws(()=>systemPayload(f.candidate),/escapes/);
 f.next['deploy/manager/service.mjs']=f.files['deploy/manager/service.mjs'];f.update();
 put(join(f.candidate,'server/update-status.js'),'// modified after inventory\n');assert.throws(()=>systemPayload(f.candidate),/differs/);
});
test('a disabled host-maintenance opt-in performs no maintenance',()=>{
 assert.equal(maintainAppliance('/does-not-exist',()=>assert.fail('No command expected'),false),false);
});
test('GUI-only updates verify installed helpers without restarting any service',{skip:!linux},t=>{
 const f=fixture(t);assert.equal(maintainAppliance(f.candidate,f.run,true,{paths:f.paths}),false);
 assert.equal(f.calls.filter(x=>['/usr/bin/env','/usr/bin/systemctl','/usr/bin/python3'].includes(x.cmd)).length,0);
 assert.equal(maintenanceState(f.paths.state).step,'unchanged');
 assert.equal(JSON.parse(readFileSync(f.paths.status)).maintenance.label,'System components are already current');
});
test('corrupt installed helpers block a GUI-only skip before any replacement',{skip:!linux},t=>{
 const f=fixture(t);put(join(f.paths.display,'control.py'),'');
 assert.throws(()=>maintainSoftware(f.candidate,f.run,{paths:f.paths}));
 assert.equal(f.calls.some(x=>x.cmd==='/usr/bin/python3'||x.cmd==='/usr/bin/systemctl'),false);
 assert.equal(maintenanceState(f.paths.state).status,'failed');
});
test('valid local inventories cannot disguise an unapplied host payload',{skip:!linux},t=>{
 const f=fixture(t);put(join(f.paths.manager,'server/ma-transport.js'),'export const other=true;\n');inventory(f.paths.manager,'manager.sha256');
 assert.throws(()=>verifyInstalledBaseline(systemPayload(f.paths.current),f.run,f.paths),/do not match/);
});
test('a local service override cannot be silently discarded by the minimal update path',{skip:!linux},t=>{
 const f=fixture(t,{tools:true});put(join(f.paths.units,'daw-one-update.service'),'different unit\n');
 assert.throws(()=>maintainSoftware(f.candidate,f.run,{paths:f.paths}),/service differs/);
 assert.equal(f.calls.some(x=>x.cmd==='/usr/bin/python3'),false);
});
test('the first repair replaces only update tools and update-page files, retaining other manager files',{skip:!linux},t=>{
 const f=fixture(t,{tools:true});const display=readFileSync(join(f.paths.display,'controller.sha256'));
 assert.equal(maintainSoftware(f.candidate,f.run,{paths:f.paths}),true);
 assert.deepEqual(readFileSync(join(f.paths.display,'controller.sha256')),display);
 assert.equal(readFileSync(join(f.paths.updater,'maintenance.mjs'),'utf8'),source('deploy/ota/maintenance.mjs'));
 assert.equal(readFileSync(join(f.paths.manager,'deploy/manager/progress.html'),'utf8'),source('deploy/manager/progress.html'));
 assert.equal(readFileSync(join(f.paths.manager,'server/ma-transport.js'),'utf8'),f.files['server/ma-transport.js']);
 assert.deepEqual(f.calls.filter(x=>x.cmd==='/usr/bin/systemctl').map(x=>x.args),[['restart','daw-one-manager.service']]);
 assert.equal(f.calls.some(x=>x.cmd==='/usr/bin/env'),false);
 assert.equal(maintenanceState(f.paths.state).status,'complete');
 assert.equal(readdirSync(join(f.root,'lib')).some(n=>n.startsWith('.')),false);
});
test('an updater-only change leaves the update-page manager running',{skip:!linux},t=>{
 const f=fixture(t,{tools:true,progress:false});assert.equal(maintainSoftware(f.candidate,f.run,{paths:f.paths}),true);
 assert.equal(f.calls.some(x=>x.cmd==='/usr/bin/systemctl'),false);
});
test('the unchanged legacy caller reaches the minimal bridge instead of a full host refresh',{skip:!linux},t=>{
 const f=fixture(t,{tools:true});let bridges=0;
 const oldRun=(cmd,args)=>{assert.equal(cmd,'/usr/bin/env');assert.ok(args.includes(join(f.candidate,'deploy/update-appliance.sh')));bridges++;assert.equal(maintainSoftware(f.candidate,f.run,{paths:f.paths}),true);};
 assert.equal(legacyAppliance(f.candidate,oldRun,true),true);assert.equal(bridges,1);
 assert.equal(f.calls.some(x=>x.cmd==='/usr/bin/env'||x.args.includes('daemon-reload')),false);
});
test('the real candidate bridge exits before full maintenance when invoked by the legacy caller',{skip:!linux},t=>{
 const f=fixture(t,{tools:true});
 const replacements={"'/opt/daw-one'":JSON.stringify(f.paths.current),"'/usr/local/lib/daw-one-updater'":JSON.stringify(f.paths.updater),"'/usr/local/lib/daw-one-control'":JSON.stringify(f.paths.manager),"'/usr/local/lib/daw-one-display'":JSON.stringify(f.paths.display),"'/etc/systemd/system'":JSON.stringify(f.paths.units),"'/var/lib/daw-one-updater/maintenance.json'":JSON.stringify(f.paths.state),"'/var/lib/daw-one-update-status/status.json'":JSON.stringify(f.paths.status)};
 let module=f.next['deploy/ota/maintenance.mjs'];for(const [a,b] of Object.entries(replacements))module=module.replaceAll(a,b);f.next['deploy/ota/maintenance.mjs']=module;f.update();
 const guard=join(f.root,'bridge-guard.mjs'),calls=join(f.root,'bridge-calls.jsonl'),full=join(f.root,'full-maintenance-started');
 put(guard,`import cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';import {appendFileSync} from 'node:fs';
const real=cp.execFileSync;cp.execFileSync=(cmd,args,options)=>{appendFileSync(${JSON.stringify(calls)},JSON.stringify({cmd,args})+'\\n');if(cmd==='/usr/bin/logger'||cmd==='/usr/bin/curl')return Buffer.from('');if(cmd==='/usr/bin/systemctl'){if(JSON.stringify(args)!=='["restart","daw-one-manager.service"]')throw Error('Unexpected service command');return Buffer.from('');}if(!['/usr/bin/node','/usr/bin/python3','/usr/bin/sha256sum'].includes(cmd))throw Error('Unexpected command: '+cmd);return real(cmd==='/usr/bin/node'?process.execPath:cmd,args,options);};syncBuiltinESMExports();`);
 const match=source('deploy/update-appliance.sh').match(/# BEGIN TUNEBOX OTA CONTROL\n([\s\S]*?)# END TUNEBOX OTA CONTROL/);assert.ok(match);
 const script='set -euo pipefail\nrepo=$1\n'+match[1]+'\nprintf full > "$2"\n';
 const run=(_cmd,args)=>{
  const env={...process.env,TUNEBOX_APPLIANCE_OTA:'1',TUNEBOX_APPLIANCE_LOCKED:'1',NODE_OPTIONS:'--import='+guard};
  const result=spawnSync('bash',['-c',script,'bridge-test',f.candidate,full],{env,encoding:'utf8',timeout:20000});
  assert.equal(result.status,0,result.stdout+result.stderr);return Buffer.from(result.stdout);
 };
 assert.equal(legacyAppliance(f.candidate,run,true),true);assert.equal(existsSync(full),false);
 assert.equal(maintenanceState(f.paths.state).status,'complete');
 const commands=readFileSync(calls,'utf8').trim().split('\n').map(JSON.parse);
 assert.equal(commands.some(x=>x.args.includes('daemon-reload')),false);
 assert.deepEqual(commands.filter(x=>x.cmd==='/usr/bin/systemctl').map(x=>x.args),[['restart','daw-one-manager.service']]);
});
test('an import-check failure cannot replace either live helper tree',{skip:!linux},t=>{
 const f=fixture(t,{tools:true}),updater=readFileSync(join(f.paths.updater,'updater.sha256')),manager=readFileSync(join(f.paths.manager,'manager.sha256'));
 const run=(cmd,args)=>{if(cmd==='/usr/bin/node')throw Error('Missing module');return f.run(cmd,args);};
 assert.throws(()=>maintainSoftware(f.candidate,run,{paths:f.paths}),/Missing module/);
 assert.deepEqual(readFileSync(join(f.paths.updater,'updater.sha256')),updater);assert.deepEqual(readFileSync(join(f.paths.manager,'manager.sha256')),manager);
 assert.equal(f.calls.some(x=>x.cmd==='/usr/bin/python3'),false);
 assert.equal(readdirSync(join(f.root,'lib')).some(n=>n.startsWith('.')),false);
});
test('a manual retry can resume known candidate files after the progress service restart failed',{skip:!linux},t=>{
 const f=fixture(t,{tools:true});let fail=true;
 const run=(cmd,args)=>{if(fail&&cmd==='/usr/bin/systemctl'){fail=false;throw Error('restart failed');}return f.run(cmd,args);};
 assert.throws(()=>maintainSoftware(f.candidate,run,{paths:f.paths}),/restart failed/);
 assert.equal(maintenanceState(f.paths.state).status,'failed');
 assert.equal(maintainSoftware(f.candidate,run,{paths:f.paths}),true);
 assert.equal(maintenanceState(f.paths.state).status,'complete');
});
test('real system changes retain the complete signed maintenance path and fixed failure phase',{skip:!linux},t=>{
 const f=fixture(t);f.next['deploy/display/control.py']+='print("new")\n';f.update();
 const run=(cmd,args)=>{if(cmd==='/usr/bin/env'){recordMaintenance('display','running',{paths:f.paths,run:f.run});throw Error('private arguments must not appear');}return f.run(cmd,args);};
 assert.throws(()=>maintainAppliance(f.candidate,run,true,{paths:f.paths}),/System maintenance stopped: Updating display services/);
 const state=maintenanceState(f.paths.state);assert.equal(state.status,'failed');assert.equal(state.failedStep,'display');
 assert.doesNotMatch(readFileSync(f.paths.status,'utf8'),/private arguments/);
});
test('an interrupted maintenance operation retains its last step across process instances',t=>{
 const f=fixture(t);const before=recordMaintenance('network','running',{paths:f.paths,run:f.run,release:'new'});
 const state=interruptedMaintenance({paths:f.paths,run:f.run});assert.equal(state.status,'interrupted');assert.equal(state.failedStep,'network');
 assert.ok(before.bootUptimeMs>0);assert.deepEqual(state.failureContext,{bootId:before.bootId,observedAt:before.observedAt,bootUptimeMs:before.bootUptimeMs});
 assert.deepEqual(interruptedMaintenance({paths:f.paths,run:f.run}),state);
 assert.equal(JSON.parse(readFileSync(f.paths.status)).maintenance.status,'interrupted');
});
test('the service restrictive umask cannot hide public progress or expose the private maintenance record',t=>{
 const f=fixture(t),previous=process.umask(0o077);
 try{
  recordMaintenance('tools','running',{paths:f.paths,run:f.run});
  assert.equal(statSync(f.paths.status).mode&0o777,0o644);assert.equal(statSync(f.paths.state).mode&0o777,0o600);
  assert.equal(JSON.parse(readFileSync(f.paths.status)).maintenance.step,'tools');
 }finally{process.umask(previous);}
});
test('public progress derives fixed labels and errors without exposing private error text or state',()=>{
 const v=publicUpdateStatus({status:'error',error:'secret subprocess arguments',failedPhase:'system-maintenance',maintenance:{step:'failed',failedStep:'display',status:'failed',label:'do not echo arbitrary input',private:'secret'}});
 assert.equal(v.maintenance.label,'System maintenance failed');assert.equal(v.error,'System maintenance stopped: Updating display services. The previous app has been kept.');assert.equal(v.failedPhase,'system-maintenance');
 assert.doesNotMatch(JSON.stringify(v),/arbitrary|secret|arguments/);
 assert.equal(publicUpdateStatus({status:'error',error:'secret'}).error,undefined);
 assert.equal(publicUpdateStatus({status:'error',failedPhase:'secret'}).failedPhase,null);
 assert.equal(publicMaintenance({step:'not-real',status:'running'}),null);assert.equal(publicMaintenance({step:'display',status:'not-real'}),null);
});

test('the actual updater refuses automatic replay after interrupted maintenance, while manual checks remain possible',{skip:!linux},t=>{
 const f=fixture(t),worker=join(f.root,'worker'),config=join(f.root,'config.json'),installed=join(f.root,'state/installed.json');mkdirSync(worker);
 const replacements={
  '/etc/daw-one-updater/config.json':config,
  '/var/lib/daw-one-update-status/status.json':f.paths.status,
  '/var/lib/daw-one-update-status/history.json':join(f.root,'status/history.json'),
  '/var/lib/daw-one-updater':join(f.root,'state'),
  '/opt/daw-one-releases':join(f.root,'slots'),
  '/opt/daw-one':f.paths.current,
  '/usr/local/lib/daw-one-updater':f.paths.updater,
  '/usr/local/lib/daw-one-control':f.paths.manager,
  '/usr/local/lib/daw-one-display':f.paths.display,
  '/etc/systemd/system':f.paths.units,
 };
 for(const name of updaterFiles.filter(n=>n.endsWith('.mjs'))){
  let text=source('deploy/ota/'+name);for(const from of Object.keys(replacements).sort((a,b)=>b.length-a.length))text=text.replaceAll(from,replacements[from]);
  put(join(worker,name),text);
 }
 put(join(worker,'settings.mjs'),source('shared/update-settings.js'));
 put(installed,JSON.stringify({release:'old',commit:'a'.repeat(40)}));
 const marker=join(f.root,'network-called'),preload=join(f.root,'guard.mjs');
 put(preload,`import cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';import {writeFileSync} from 'node:fs';
const real=cp.execFileSync;cp.execFileSync=(cmd,args,options)=>{if(cmd==='/usr/bin/logger')return Buffer.from('');if(cmd==='chmod'&&args.at(-1)===${JSON.stringify(f.paths.status)})return real(cmd,args,options);throw Error('Unexpected subprocess: '+cmd);};syncBuiltinESMExports();
globalThis.fetch=async()=>{writeFileSync(${JSON.stringify(marker)},'called');throw Error('fixture network stop');};`);
 for(const [action,enabled,blocked] of [['auto',true,true],['check',true,false],['install',true,false],['auto',false,false]]){
  put(config,JSON.stringify({channel:'preview',applianceUpdates:enabled,policy:{mode:'auto'}}));
  put(join(f.root,'state/request.json'),JSON.stringify({action}));rmSync(marker,{force:true});
  recordMaintenance('display','running',{paths:f.paths,run:f.run,release:'new'});
  const result=spawnSync(process.execPath,['--import',preload,join(worker,'update.mjs')],{encoding:'utf8',timeout:10000});
  const status=JSON.parse(readFileSync(f.paths.status));
  if(blocked){assert.equal(result.status,0,result.stderr);assert.equal(existsSync(marker),false);assert.equal(status.failedPhase,'system-maintenance');assert.match(status.error,/Updating display services/);}
  else {assert.equal(existsSync(marker),true,result.stdout+result.stderr);assert.equal(status.failedPhase,'checking');}
  assert.equal(status.maintenance.status,'interrupted');
 }
 put(config,JSON.stringify({channel:'preview',applianceUpdates:true,policy:{mode:'notify'}}));put(join(f.root,'state/request.json'),JSON.stringify({action:'check'}));
 recordMaintenance('complete','complete',{paths:f.paths,run:f.run,release:'old'});
 const result=spawnSync(process.execPath,['--import',preload,join(worker,'update.mjs')],{encoding:'utf8',timeout:10000});
 const status=JSON.parse(readFileSync(f.paths.status));assert.equal(status.failedPhase,'checking',result.stderr);assert.equal(status.maintenance,undefined,'A previous successful step cannot describe the next update check');
});
