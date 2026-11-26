import {scheduleReboot} from './post-update.mjs';
import {readFileSync,writeFileSync,existsSync,lstatSync,readdirSync,mkdtempSync,mkdirSync,copyFileSync,renameSync,rmSync,openSync,closeSync,fsyncSync,fchmodSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {join,dirname,basename,posix} from 'node:path';
import {fileURLToPath} from 'node:url';
import {uptime} from 'node:os';

export const updaterFiles=Object.freeze(['post-update.mjs','update.mjs','policy.mjs','appliance.mjs','maintenance.mjs','prepare-runtime.mjs','local-http.mjs','releases.mjs','verify-tree.mjs','safe-extract.py']);
const updaterOnly=new Set(['post-update.mjs','update.mjs','appliance.mjs','maintenance.mjs','prepare-runtime.mjs','local-http.mjs','releases.mjs','verify-tree.mjs','safe-extract.py'].map(n=>'deploy/ota/'+n));
const progressOnly=new Set(['deploy/manager/progress.html','server/update-status.js','dist/appliance.js','dist/appliance.css']);
const publisherOnly=new Set(['deploy/release-bundle.js','deploy/ota/sign.mjs','deploy/ota/keygen.mjs','deploy/ota/export-public.mjs','deploy/ota/check-channel.mjs','deploy/ota/setup-project.sh']);
const hostPath=(p,dependencies)=>p.startsWith('deploy/')&&!publisherOnly.has(p)||dependencies.has(p)&&p!=='shared/release.js'||['shared/update-settings.js','server/ma-transport.js','server/update-status.js','dist/appliance.js','dist/appliance.css'].includes(p);
const hash=data=>createHash('sha256').update(data).digest('hex');
export const maintenancePaths=Object.freeze({current:'/opt/daw-one',updater:'/usr/local/lib/daw-one-updater',manager:'/usr/local/lib/daw-one-control',display:'/usr/local/lib/daw-one-display',units:'/etc/systemd/system',state:'/var/lib/daw-one-updater/maintenance.json',status:'/var/lib/daw-one-update-status/status.json'});
const execute=(cmd,args)=>execFileSync(cmd,args,{stdio:'pipe',timeout:180000});

function json(path){const raw=readFileSync(path,'utf8');if(raw.length>1048576)throw Error('System inventory is too large');return JSON.parse(raw);}
function regular(path){if(!lstatSync(path).isFile())throw Error('System payload must contain regular files');const data=readFileSync(path);if(!data.length||data.length>8388608)throw Error('System payload file is empty or too large');return data;}
function atomic(path,value,mode=0o600){
 const tmp=path+'.'+randomUUID()+'.tmp';let fd;
 try{
  fd=openSync(tmp,'wx',mode);fchmodSync(fd,mode);writeFileSync(fd,JSON.stringify(value)+'\n');fsyncSync(fd);closeSync(fd);fd=undefined;renameSync(tmp,path);
  const parent=openSync(dirname(path),'r');try{fsyncSync(parent);}finally{closeSync(parent);}
 }
 finally{if(fd!==undefined)closeSync(fd);rmSync(tmp,{force:true});}
}

/** Only planner/checkpoint blocks are excluded; the actual system configuration remains part of the comparison. */
export function maintenanceBody(source){
 let inside=false;const kept=[];
 for(const line of source.split('\n')){
  if(line==='# BEGIN TUNEBOX OTA CONTROL'){if(inside)throw Error('Nested maintenance control block');inside=true;continue;}
  if(line==='# END TUNEBOX OTA CONTROL'){if(!inside)throw Error('Unmatched maintenance control block');inside=false;continue;}
  if(!inside)kept.push(line);
 }
 if(inside)throw Error('Incomplete maintenance control block');return kept.join('\n');
}
function unitText(source,name){
 const start='cat > "$stage/'+name+'" <<\'UNIT\'\n',at=source.indexOf(start),end=source.indexOf('\nUNIT',at+start.length);
 if(at<0||end<0)throw Error('Updater service template is unavailable');return source.slice(at+start.length,end)+'\n';
}
function managerDependencies(root,entries){
 const seen=new Set(),queue=[...entries.keys()].filter(p=>/^deploy\/manager\/[^/]+\.mjs$/.test(p));
 while(queue.length){
  const p=queue.pop();if(seen.has(p))continue;seen.add(p);
  if(!entries.has(p))throw Error('A manager dependency is missing from the system inventory');
  const data=regular(join(root,p));if(hash(data)!==entries.get(p))throw Error('A manager dependency differs from its verified inventory');
  const text=data.toString();
  const imports=[...text.matchAll(/(?:^|[\s;])(?:import|export)\s[^'"]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)].map(m=>m[1]||m[2]);
  for(const m of text.matchAll(/(?:^|[\s;])import\s*['"](\.{1,2}\/[^'"]+)['"]/g))imports.push(m[1]);
  for(const spec of imports){const target=posix.normalize(posix.join(posix.dirname(p),spec));if(target.startsWith('../')||posix.isAbsolute(target))throw Error('Manager import escapes the verified payload');queue.push(target);}
 }
 return seen;
}
export function systemPayload(root){
 const manifest=json(join(root,'release-manifest.json'));
 if(manifest.schema!==1||typeof manifest.release!=='string'||!Array.isArray(manifest.files)||!manifest.files.length||manifest.files.length>4000)throw Error('Invalid system inventory');
 const entries=new Map();
 for(const f of manifest.files){
  if(typeof f.path!=='string'||f.path.startsWith('/')||f.path.split('/').some(p=>!p||p==='.'||p==='..')||!/^[a-f0-9]{64}$/.test(f.sha256)||entries.has(f.path))throw Error('Invalid system inventory entry');
  entries.set(f.path,f.sha256);
 }
 const dependencies=managerDependencies(root,entries);
 const files=[...entries].filter(([p])=>hostPath(p,dependencies)).sort(([a],[b])=>a.localeCompare(b));
 for(const p of ['deploy/update-appliance.sh','deploy/install-ota.sh'])if(!entries.has(p)||hash(regular(join(root,p)))!==entries.get(p))throw Error('System installer does not match its verified inventory');
 const installer=regular(join(root,'deploy/install-ota.sh')).toString();
 const body=maintenanceBody(regular(join(root,'deploy/update-appliance.sh')).toString());
 return {root,release:manifest.release,files,bodyHash:hash(body),service:unitText(installer,'update.service'),timer:unitText(installer,'update.timer')};
}
export function maintenancePlan(previous,next){
 const before=new Map(previous.files),after=new Map(next.files),changed=[...new Set([...before.keys(),...after.keys()])].filter(p=>before.get(p)!==after.get(p)).sort();
 if(!changed.length)return {kind:'none',changed,progress:false};
 const tools=previous.bodyHash===next.bodyHash&&previous.service===next.service&&previous.timer===next.timer&&changed.every(p=>updaterOnly.has(p)||progressOnly.has(p)||p==='deploy/update-appliance.sh'||p==='deploy/install-ota.sh');
 return {kind:tools?'update-tools':'system',changed,progress:changed.some(p=>progressOnly.has(p))};
}

function installedPaths(p,paths,display){
 const result=[];
 if(p.startsWith('deploy/ota/')&&updaterFiles.includes(basename(p)))result.push(join(paths.updater,basename(p)));
 if(p==='shared/update-settings.js')result.push(join(paths.updater,'settings.mjs'));
 if(/^shared\/[^/]+\.js$/.test(p)||p==='server/update-status.js'||p==='server/ma-transport.js'||/^deploy\/manager\/[^/]+\.(?:mjs|sh|html)$/.test(p)||['deploy/measurement/devices.mjs','deploy/host-capacity.js','deploy/music-assistant-local.sh','deploy/music-assistant.compose.yml','deploy/ota/policy.mjs'].includes(p))result.push(join(paths.manager,p));
 if(p==='dist/appliance.js'||p==='dist/appliance.css')result.push(join(paths.manager,'public',basename(p)));
 if(display&&p==='deploy/display/control.py')result.push(join(paths.display,'control.py'));
 return result;
}
/** A source comparison alone cannot prove that a disabled/partial host refresh was applied. Bind it to installed files. */
export function verifyInstalledBaseline(previous,run,paths=maintenancePaths,resumable=null){
 const display=existsSync(join(paths.display,'controller.sha256'));
 for(const inventory of [join(paths.updater,'updater.sha256'),join(paths.manager,'manager.sha256'),...(display?[join(paths.display,'controller.sha256')]:[])])run('/usr/bin/sha256sum',['--strict','--check','--quiet',inventory]);
 const next=new Map(resumable?.files||[]);
 for(const [p,expected] of previous.files)for(const target of installedPaths(p,paths,display)){
  const actual=hash(regular(target)),knownReplacement=(updaterOnly.has(p)||progressOnly.has(p))&&actual===next.get(p);
  if(actual!==expected&&!knownReplacement)throw Error('Installed system files do not match the current release; repair system maintenance before updating');
 }
 if(regular(join(paths.units,'daw-one-update.service')).toString()!==previous.service||regular(join(paths.units,'daw-one-update.timer')).toString()!==previous.timer)throw Error('Installed updater service differs; a system update is required');
}

const labels=Object.freeze({checking:'Checking system components',unchanged:'System components are already current',tools:'Updating the software updater',progress:'Updating the update screen',browser:'Updating browser settings',display:'Updating display services',network:'Updating system settings',manager:'Updating device services',measurement:'Updating measurement services',complete:'System maintenance complete',interrupted:'System maintenance was interrupted',failed:'System maintenance failed'});
export function maintenanceState(path=maintenancePaths.state){try{const s=json(path);if(s.schema!==1||!Object.hasOwn(labels,s.step)||!['running','complete','failed','interrupted'].includes(s.status))return null;return s;}catch{return null;}}
export function recordMaintenance(step,status='running',{paths=maintenancePaths,run=execute,release=null}={}){
 if(!Object.hasOwn(labels,step)||!['running','complete','failed','interrupted'].includes(status))throw Error('Invalid system maintenance phase');
 let bootId=null;try{bootId=readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim();}catch{}
 const previous=maintenanceState(paths.state),origin=previous?.failedStep||previous?.step;
 const failedStep=['failed','interrupted'].includes(step)&&Object.hasOwn(labels,origin)?origin:null;
 const failureContext=failedStep?{bootId:previous.bootId,observedAt:previous.observedAt,bootUptimeMs:previous.bootUptimeMs}:null;
 const value={schema:1,step,status,label:labels[step],release,bootId,observedAt:Date.now(),bootUptimeMs:Math.round(uptime()*1000),...(failedStep?{failedStep,failureContext}:{})};
 atomic(paths.state,value);
 try{const current=json(paths.status);atomic(paths.status,{...current,maintenance:{step,status,label:value.label,...(failedStep?{failedStep}:{})}},0o644);}catch{}
 try{run('/usr/bin/logger',['-t','tunebox-maintenance','--',JSON.stringify({step,status,release})]);}catch{}
 return value;
}
export function interruptedMaintenance(options={}){
 const paths=options.paths||maintenancePaths,previous=maintenanceState(paths.state);
 if(previous?.status==='running')return recordMaintenance('interrupted','interrupted',{...options,release:previous.release});
 return ['interrupted','failed'].includes(previous?.status)?previous:null;
}
export function maintenanceFailure(state=maintenanceState()){
 const step=state?.failedStep||state?.step,label=Object.hasOwn(labels,step)?labels[step]:null;
 return label&& !['failed','interrupted'].includes(step)?'System maintenance stopped: '+label+'. The previous app has been kept.':'System maintenance was interrupted. Check the device before trying a system update again.';
}

function copyTree(from,to){
 for(const entry of readdirSync(from,{withFileTypes:true})){
  if(entry.name==='manager.sha256')continue;
  const source=join(from,entry.name),target=join(to,entry.name);
  if(entry.isDirectory()){mkdirSync(target);copyTree(source,target);}
  else if(entry.isFile())copyFileSync(source,target);
  else throw Error('Unexpected link or special file in installed manager');
 }
}
function refreshTools(candidate,plan,run,paths,next){
 const stages=[];
 try{
  const updater=mkdtempSync(join(dirname(paths.updater),'.daw-one-updater-refresh-'));stages.push(updater);
  for(const file of updaterFiles)copyFileSync(join(candidate,'deploy/ota',file),join(updater,file));
  copyFileSync(join(candidate,'shared/update-settings.js'),join(updater,'settings.mjs'));
  const checker=join(candidate,'deploy/manager/check-imports.mjs'),publisher=join(candidate,'deploy/host-files.py');
  run('/usr/bin/node',[checker,updater,'update.mjs']);
  let manager;
  if(plan.progress){
   manager=mkdtempSync(join(dirname(paths.manager),'.daw-one-progress-refresh-'));stages.push(manager);copyTree(paths.manager,manager);
   for(const p of plan.changed.filter(p=>progressOnly.has(p))){const target=p.startsWith('dist/')?join(manager,'public',basename(p)):join(manager,p);copyFileSync(join(candidate,p),target);}
   const modules=readdirSync(join(manager,'deploy/manager')).filter(n=>n.endsWith('.mjs')).map(n=>'deploy/manager/'+n);
   run('/usr/bin/node',[checker,manager,...modules]);
  }
  recordMaintenance('tools','running',{paths,run,release:next.release});
  run('/usr/bin/python3',[publisher,'tree',updater,paths.updater,'--inventory','updater.sha256']);
  if(manager){
   recordMaintenance('progress','running',{paths,run,release:next.release});
   run('/usr/bin/python3',[publisher,'tree',manager,paths.manager,'--inventory','manager.sha256']);
   run('/usr/bin/systemctl',['restart','daw-one-manager.service']);
   run('/usr/bin/curl',['--fail','--silent','--retry','8','--retry-connrefused','--retry-delay','1','--max-time','2','http://127.0.0.1:3002/status']);
  }
  verifyInstalledBaseline(next,run,paths);
  recordMaintenance('complete','complete',{paths,run,release:next.release});
 }finally{for(const stage of stages)rmSync(stage,{recursive:true,force:true});}
}

/** Return null for a real system change. The caller then runs the complete, signed maintenance script. */
export function maintainSoftware(candidate,run=execute,{paths=maintenancePaths}={}){
 const next=systemPayload(candidate),previous=systemPayload(paths.current),plan=maintenancePlan(previous,next);
 recordMaintenance('checking','running',{paths,run,release:next.release});
 try{
  if(plan.kind==='system')return null;
  verifyInstalledBaseline(previous,run,paths,plan.kind==='update-tools'?next:null);
  if(plan.kind==='none'){recordMaintenance('unchanged','complete',{paths,run,release:next.release});return false;}
  refreshTools(candidate,plan,run,paths,next);return true;
 }catch(error){recordMaintenance('failed','failed',{paths,run,release:next.release});throw error;}
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 try{
  const [action,candidate]=process.argv.slice(2);
  if(action==='bridge'){const changed=maintainSoftware(candidate);if(changed!==null)scheduleReboot(candidate);process.exitCode=changed===null?3:0;}
  else if(action==='step'){
   const root=dirname(dirname(dirname(fileURLToPath(import.meta.url))));
   recordMaintenance(candidate,process.argv[4]||'running',{release:json(join(root,'release-manifest.json')).release});
  }
  else throw Error('Unknown system maintenance operation');
 }catch(error){console.error('System maintenance: '+error.message);process.exitCode=1;}
}
