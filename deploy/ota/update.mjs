import {readFileSync,writeFileSync,mkdirSync,existsSync,renameSync,symlinkSync,realpathSync,rmSync,copyFileSync,readdirSync,statfsSync,lstatSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {repository,verifyManifest,verifyArchive,canUpdate,activate,restorePrevious,prunableSlots} from './policy.mjs';
import {updateSettings,installationDecision} from './settings.mjs';
import {verifyTree} from './verify-tree.mjs';
const base='/var/lib/daw-one-updater',slots='/opt/daw-one-releases',app='/opt/daw-one';
const run=(cmd,args)=>execFileSync(cmd,args,{stdio:'pipe',timeout:180000});
const json=(path,fallback={})=>{try{return JSON.parse(readFileSync(path,'utf8'));}catch{return fallback;}};
const atomic=(path,value)=>{writeFileSync(path+'.tmp',JSON.stringify(value)+'\n',{mode:0o600});renameSync(path+'.tmp',path);};
const configPath='/etc/daw-one-updater/config.json';
let config=json(configPath),channel=config.channel||null,current=json(base+'/installed.json'),available=null,kiosk=false;
function report(status,extra={}){
 const path='/var/lib/daw-one-update-status/status.json';
 atomic(path,{status,channel,checkedAt:new Date().toISOString(),current:{release:current.release,commit:current.commit},available,percent:null,...extra});run('chmod',['644',path]);
 console.log(JSON.stringify({component:'tunebox-update',status,commit:available?.commit||current.commit||null,percent:extra.percent??null}));
}
async function download(url,max,onProgress){
 for(let redirects=0;redirects<5;redirects++){
  const u=new URL(url);
  if(u.protocol!=='https:'||!['api.github.com','github.com','release-assets.githubusercontent.com','objects.githubusercontent.com'].includes(u.hostname))throw Error('Untrusted download host');
  const response=await fetch(u,{redirect:'manual',headers:{'User-Agent':'TuneBox-OTA'},signal:AbortSignal.timeout(60000)});
  if([301,302,303,307,308].includes(response.status)){url=new URL(response.headers.get('location'),u).href;await response.body?.cancel();continue;}
  if(!response.ok)throw Error('Release download failed');
  let size=0,last=0;const chunks=[];
  for await(const chunk of response.body){size+=chunk.length;if(size>max)throw Error('Download too large');chunks.push(chunk);if(onProgress&&Date.now()-last>1000){last=Date.now();onProgress(size);}}
  onProgress?.(size);return Buffer.concat(chunks);
 }throw Error('Too many redirects');
}
async function local(path){
 const response=await fetch('http://127.0.0.1:3001'+path,{signal:AbortSignal.timeout(3000)});if(!response.ok)throw Error('Backend unavailable');
 let size=0;const chunks=[];for await(const chunk of response.body){size+=chunk.length;if(size>1048576)throw Error('Backend response too large');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks));
}
function slot(value){const target=value.startsWith(slots+'/')?value:slots+'/'+value;if(!new RegExp('^'+slots+'/(?:[a-f0-9]{40}|legacy-[0-9]+)$').test(target)||!existsSync(target)||lstatSync(target).isSymbolicLink())throw Error('Invalid release slot');return target;}
const host={
 current:async()=>realpathSync(app),
 journal:async value=>{try{kiosk=run('systemctl',['is-active','daw-one-kiosk.service']).toString().trim()==='active';}catch{kiosk=false;}atomic(base+'/pending.json',{...value,kiosk});},
 // Chromium stays alive: its independent update page is served by the manager.
 stop:async()=>run('systemctl',['stop','daw-one.service']),
 select:async value=>{const target=slot(value),tmp='/opt/.daw-one-'+randomUUID();symlinkSync(target,tmp);renameSync(tmp,app);},
 start:async()=>run('systemctl',['start','daw-one.service']),
 healthy:async manifest=>{
  for(let attempt=0;attempt<30;attempt++){
   try{
    const health=await local('/api/health');
    if(health.ok&&(!manifest||health.build.id===manifest.release&&health.deploymentCommit===manifest.commit)){
     const response=await fetch('http://127.0.0.1:3001/',{signal:AbortSignal.timeout(3000)});
     if(response.ok){const html=await response.text();const assets=[...html.matchAll(/(?:src|href)="(\/assets\/[a-zA-Z0-9_.-]+\.(?:js|css))"/g)].map(x=>x[1]);
      if(html.includes('<html')&&assets.some(a=>a.endsWith('.js'))){let ready=true;for(const path of assets){const asset=await fetch('http://127.0.0.1:3001'+path,{signal:AbortSignal.timeout(3000)});if(!asset.ok)ready=false;await asset.body?.cancel();}if(ready)return true;}
     }
    }
   }catch{}
   await new Promise(resolve=>setTimeout(resolve,1000));
  }return false;
 },
 commit:async manifest=>{current={sequence:manifest.sequence,commit:manifest.commit,release:manifest.release,previous:json(base+'/pending.json').previous};atomic(base+'/installed.json',current);},
 commitRollback:async(previous,target)=>{const metadata=json(target+'/deployment-ota.json'),health=await local('/api/health');current={...current,commit:metadata.commit||null,release:health.build?.id,previous};atomic(base+'/installed.json',current);config={...config,policy:{...updateSettings(config.policy),mode:'paused'}};atomic(configPath,config);},
 clearJournal:async()=>rmSync(base+'/pending.json',{force:true})
};
async function prepareDisplay(){report('installing');await new Promise(resolve=>setTimeout(resolve,5000));if(!canUpdate(await local('/api/state')))throw Error('Playback/state changed before activation; update deferred');}
try{
 if(existsSync(base+'/pending.json')){
  const pending=json(base+'/pending.json');report('rolling-back');await host.stop();await host.select(pending.previous);await host.start();if(!await host.healthy(null))throw Error('Recovery requires manual service repair');await host.clearJournal();report('rolled-back');process.exit(0);
 }
 if(process.argv.includes('--recover'))process.exit(0);
 const request=json(base+'/request.json',{action:'auto'});rmSync(base+'/request.json',{force:true});
 if(!['auto','check','install','rollback'].includes(request.action))throw Error('Invalid update action');
 if(!['preview','stable'].includes(channel))throw Error('Invalid channel');
 const policy=updateSettings(config.policy);
 if(request.action==='rollback'){
  if(!current.previous||!canUpdate(await local('/api/state')))throw Error('Previous version unavailable or playback/state unsafe for rollback');
  slot(current.previous);await prepareDisplay();await restorePrevious(host,current.previous,report);report('rolled-back');process.exit(0);
 }
 if(request.action==='auto'&&policy.mode==='paused'){report('paused');process.exit(0);}
 report('checking');
 const releases=JSON.parse((await download('https://api.github.com/repos/'+repository+'/releases?per_page=30',1048576)).toString());
 const candidate=releases.find(r=>!r.draft&&new RegExp('^ota-'+channel+'-[a-f0-9]{40}$').test(r.tag_name));
 if(!candidate){report('no-release');process.exit(0);}
 const url='https://github.com/'+repository+'/releases/download/'+candidate.tag_name+'/';
 const raw=await download(url+'ota-manifest.json',8192),signature=await download(url+'ota-manifest.sig',256);
 const manifest=verifyManifest(raw,Buffer.from(signature.toString().trim(),'base64'),readFileSync('/etc/daw-one-updater/public.pem'),channel,0);
 if(candidate.tag_name!=='ota-'+channel+'-'+manifest.commit)throw Error('Tag mismatch');
 if(manifest.sequence<(current.sequence||0)||manifest.sequence===current.sequence&&manifest.commit===current.commit){report('up-to-date');process.exit(0);}
 available={release:manifest.release,commit:manifest.commit,notes:manifest.notes||'Verified TuneBox build'};
 const needsIdle=request.action==='install'||request.action==='auto'&&policy.mode==='auto';
 const decision=installationDecision(policy,request.action,needsIdle?canUpdate(await local('/api/state')):false);
 if(decision!=='install'){report(decision);process.exit(0);}
 const disk=statfsSync(slots);if(disk.bavail*disk.bsize<268435456)throw Error('At least 256 MiB free staging space required');
 report('downloading',{percent:0});
 const bytes=await download(url+'tunebox-release.tar.gz',33554432,size=>report('downloading',{percent:Math.min(100,100*size/manifest.bytes),downloadedBytes:size,totalBytes:manifest.bytes}));
 report('verifying');verifyArchive(bytes,manifest);
 const dest=slots+'/'+manifest.commit;if(realpathSync(app)===dest)throw Error('Candidate is already active');if(readdirSync(slots).length>=8)throw Error('Release storage full; remove unused slots through SSH');if(existsSync(dest))rmSync(dest,{recursive:true});mkdirSync(dest,{mode:0o755});
 const archive=base+'/candidate.tar.gz';writeFileSync(archive,bytes,{mode:0o600});run('python3',[new URL('./safe-extract.py',import.meta.url).pathname,archive,dest]);verifyTree(dest,manifest.release);
 report('preparing');run('chown',['-R','dawupdatebuild:dawupdatebuild',dest]);
 run('runuser',['-u','dawupdatebuild','--','env','-i','PATH=/usr/bin:/bin','HOME=/var/lib/daw-one-update-build','npm','ci','--prefix',dest,'--omit=dev','--ignore-scripts','--no-audit','--no-fund']);
 run('chown',['-R','root:root',dest]);run('chmod',['-R','go-w',dest]);verifyTree(dest,manifest.release);
 for(const file of ['kiosk.sh','set-display-mode.sh','health.sh','deployment-target','read-sensors.py'])if(existsSync(app+'/'+file))copyFileSync(app+'/'+file,dest+'/'+file);
 for(const file of ['kiosk.sh','set-display-mode.sh','health.sh'])if(existsSync(dest+'/'+file))run('chmod',['755',dest+'/'+file]);
 atomic(dest+'/deployment-ota.json',{commit:manifest.commit});run('chmod',['644',dest+'/deployment-ota.json']);
 const latestPolicy=updateSettings(json(configPath).policy);const finalDecision=installationDecision(latestPolicy,request.action,canUpdate(await local('/api/state')));
 if(finalDecision!=='install'){report(finalDecision);process.exit(0);}
 await prepareDisplay();
 if(realpathSync(app)===app){const old=slots+'/legacy-'+Date.now();atomic(base+'/pending.json',{previous:old,candidate:manifest.commit,kiosk:false});renameSync(app,old);symlinkSync(old,app);}
 await activate(host,manifest,report);report('installed');
 const previous=current.previous?.split('/').pop();const entries=readdirSync(slots).filter(name=>lstatSync(slots+'/'+name).isDirectory()&&!lstatSync(slots+'/'+name).isSymbolicLink()).map(name=>({name,modified:lstatSync(slots+'/'+name).mtimeMs}));
 for(const name of prunableSlots(entries,manifest.commit,previous))rmSync(slots+'/'+name,{recursive:true});
}catch(error){report('error',{error:String(error.message).slice(0,180)});process.exitCode=1;}
