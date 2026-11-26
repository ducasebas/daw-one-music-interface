import {readFileSync,writeFileSync,renameSync,openSync,closeSync,fsyncSync,existsSync,realpathSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {basename} from 'node:path';
import {pathToFileURL} from 'node:url';
import {uptime} from 'node:os';
import {localHttp} from './local-http.mjs';
import {canUpdate} from './policy.mjs';
const journal='/var/lib/daw-one-updater/reboot.json',status='/var/lib/daw-one-update-status/reboot.json';
const read=(path,fallback=null)=>{try{const s=readFileSync(path,'utf8');return s.length<4096?JSON.parse(s):fallback;}catch{return fallback;}};
const boot=()=>readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim();
function atomic(path,value,mode=0o600){const tmp=path+'.tmp';writeFileSync(tmp,JSON.stringify(value)+'\n',{mode});const fd=openSync(tmp,'r');try{fsyncSync(fd);}finally{closeSync(fd);}renameSync(tmp,path);}
const execute=(cmd,args)=>execFileSync(cmd,args,{timeout:10000,stdio:'pipe'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
/** Deliver through the old installed updater too. The helper waits on that updater's lock,
 * then requires committed activation, a healthy exact build and a visible screen acknowledgement. */
export function scheduleReboot(candidate,run=execute){
 const commit=basename(candidate),m=read(candidate+'/release-manifest.json');
 if(!/^[a-f0-9]{40}$/.test(commit)||typeof m?.release!=='string'||m.release.length>100)throw Error('Invalid restart candidate');
 if(read(journal)?.commit===commit)return false; // Never automatically replay a failed/rebooted job.
 const job={schema:1,commit,release:m.release,bootId:boot(),phase:'waiting',updatedUptime:uptime()};atomic(journal,job);atomic(status,job,0o644);
 try{run('/usr/bin/systemd-run',['--quiet','--collect','--unit=daw-one-post-update','--property=RuntimeMaxSec=750','--property=UMask=0077','/usr/bin/flock','-w','600','/run/daw-one-update.lock','/usr/bin/node','/usr/local/lib/daw-one-updater/post-update.mjs','run',commit]);}
 catch{atomic(journal,{...job,phase:'required'});atomic(status,{...job,phase:'required'},0o644);return false;}
 return true;
}
export function rebootDecision({job,installed,health,currentBoot,ready,idle,elapsed=0}){
 if(!job||job.schema!==1||!/^[a-f0-9]{40}$/.test(job.commit))return 'cancelled';
 if(job.bootId!==currentBoot)return 'complete';
 if(installed?.commit!==job.commit||health?.deploymentCommit!==job.commit||health?.build?.id!==job.release||health?.ok!==true)return 'cancelled';
 if(!ready||ready.commit!==job.commit||ready.release!==job.release)return elapsed<90000?'await-screen':'required';
 return idle?'countdown':'required';
}
export async function finishReboot(commit,{readJson=read,write=atomic,bootId=boot,request=localHttp,run=execute,sleep=wait,clock=()=>performance.now(),resolve=realpathSync,has=existsSync}={}){
 const job=readJson(journal);if(job?.commit!==commit||job.phase!=='waiting')return;
 const publish=phase=>{const v={...job,phase,updatedUptime:uptime(),...(phase==='countdown'?{deadlineUptime:uptime()+10}:{})};write(journal,v);write(status,v,0o644);};
 const json=async path=>{const r=await request(path);if(!r.ok)throw Error('Backend unavailable');return JSON.parse(r.body.toString());};
 const began=clock();let healthy;
 try{
  if(readJson('/var/lib/daw-one-update-status/status.json')?.status!=='installed'){publish('cancelled');return;}
  // Lock acquisition happens after the installing updater exits. A crash/rollback never matches.
  while(clock()-began<90000){
   const installed=readJson('/var/lib/daw-one-updater/installed.json');
   healthy=await json('/api/health').catch(()=>null);
   const state=await json('/api/state').catch(()=>null),ready=readJson('/run/daw-one-display/reboot-ready.json');
   const phase=rebootDecision({job,installed,health:healthy,currentBoot:bootId(),ready,idle:!!state&&canUpdate(state),elapsed:clock()-began});
   if(phase==='cancelled'||phase==='complete'){publish(phase);return;}
   if(phase==='required'){publish('required');return;}
   if(phase==='countdown')break;
   publish('await-screen');await sleep(1000);
  }
  const ready=readJson('/run/daw-one-display/reboot-ready.json');
  if(!ready||ready.commit!==commit||ready.release!==job.release){publish('required');return;}
  publish('countdown');await sleep(10000);
  const state=await json('/api/state'),health=await json('/api/health');
  if(rebootDecision({job,installed:readJson('/var/lib/daw-one-updater/installed.json'),health,currentBoot:bootId(),ready,idle:canUpdate(state)})!=='countdown'||readJson('/var/lib/daw-one-update-status/status.json')?.status!=='installed'||resolve('/opt/daw-one')!=='/opt/daw-one-releases/'+commit||has('/var/lib/daw-one-updater/pending.json')||has('/var/lib/daw-one-updater/request.json')){publish('required');return;}
  // Persist the once-only decision before asking systemd; a service restart cannot replay it.
  publish('rebooting');run('/usr/bin/sync',[]);run('/usr/bin/systemctl',['reboot','--no-block']);
 }catch{publish('required');}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv[2]==='schedule')scheduleReboot(process.argv[3]);
 else if(process.argv[2]==='run'&&/^[a-f0-9]{40}$/.test(process.argv[3]||''))await finishReboot(process.argv[3]);
 else throw Error('Invalid post-update operation');
}
