import {readFileSync,writeFileSync,mkdirSync,existsSync,renameSync,symlinkSync,realpathSync,rmSync,copyFileSync,readdirSync,statfsSync,lstatSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {repository,verifyManifest,verifyArchive,canUpdate,activate,prunableSlots} from './policy.mjs';
import {verifyTree} from './verify-tree.mjs';
const base='/var/lib/daw-one-updater',slots='/opt/daw-one-releases',app='/opt/daw-one';
const run=(cmd,args)=>execFileSync(cmd,args,{stdio:'pipe',timeout:180000});
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const atomic=(p,v)=>{writeFileSync(p+'.tmp',JSON.stringify(v)+'\n',{mode:0o600});renameSync(p+'.tmp',p);};
let channel=null;
const report=(status,extra={})=>{const p='/var/lib/daw-one-update-status/status.json';atomic(p,{status,channel,checkedAt:new Date().toISOString(),...extra});run('chmod',['644',p]);};
async function download(url,max){
 for(let redirects=0;redirects<5;redirects++){
  const u=new URL(url);if(u.protocol!=='https:'||!['api.github.com','github.com','release-assets.githubusercontent.com','objects.githubusercontent.com'].includes(u.hostname))throw Error('Untrusted download host');
  const r=await fetch(u,{redirect:'manual',headers:{'User-Agent':'TuneBox-OTA'},signal:AbortSignal.timeout(60000)});
  if([301,302,303,307,308].includes(r.status)){url=new URL(r.headers.get('location'),u).href;continue;}
  if(!r.ok)throw Error('Release download failed');let size=0;const chunks=[];for await(const c of r.body){size+=c.length;if(size>max)throw Error('Download too large');chunks.push(c);}return Buffer.concat(chunks);
 }throw Error('Too many redirects');
}
const local=async p=>{const r=await fetch('http://127.0.0.1:3001'+p,{signal:AbortSignal.timeout(3000)});if(!r.ok)throw Error('Backend unavailable');return r.json();};
let kiosk=false;
const host={
 current:async()=>realpathSync(app),
 journal:async value=>{try{kiosk=run('systemctl',['is-active','daw-one-kiosk.service']).toString().trim()==='active';}catch{kiosk=false;}atomic(base+'/pending.json',{...value,kiosk});},
 stop:async()=>{run('systemctl',['stop','daw-one-kiosk.service','daw-one.service']);},
 select:async value=>{const target=value.startsWith(slots+'/')?value:slots+'/'+value;if(!target.startsWith(slots+'/'))throw Error('Invalid slot');const tmp='/opt/.daw-one-'+randomUUID();symlinkSync(target,tmp);renameSync(tmp,app);},
 start:async()=>{run('systemctl',['start','daw-one.service']);},
 healthy:async m=>{for(let i=0;i<30;i++){try{const h=await local('/api/health');if(h.ok&&(!m||h.build.id===m.release&&h.deploymentCommit===m.commit)){const r=await fetch('http://127.0.0.1:3001/',{signal:AbortSignal.timeout(3000)});if(r.ok){const html=await r.text();const assets=[...html.matchAll(/(?:src|href)="(\/assets\/[a-zA-Z0-9_.-]+\.(?:js|css))"/g)].map(x=>x[1]);if(html.includes('<html')&&assets.some(a=>a.endsWith('.js'))){let ready=true;for(const path of assets){const asset=await fetch('http://127.0.0.1:3001'+path,{signal:AbortSignal.timeout(3000)});if(!asset.ok)ready=false;await asset.body?.cancel();}if(ready)return true;}}}}catch{}await new Promise(r=>setTimeout(r,1000));}return false;},
 commit:async m=>atomic(base+'/installed.json',{sequence:m.sequence,commit:m.commit,previous:json(base+'/pending.json').previous}),
 clearJournal:async()=>{rmSync(base+'/pending.json',{force:true});}
};
try{
 if(existsSync(base+'/pending.json')){const p=json(base+'/pending.json');kiosk=p.kiosk;await host.stop();await host.select(p.previous);await host.start();if(!await host.healthy(null))throw Error('Recovery requires manual service repair');await host.clearJournal();if(kiosk)run('systemctl',['start','daw-one-kiosk.service']);report('rolled-back');process.exit(0);}
 if(process.argv.includes('--recover'))process.exit(0);
 const config=json('/etc/daw-one-updater/config.json');channel=config.channel;
 if(!['preview','stable'].includes(channel))throw Error('Invalid channel');
 const releases=JSON.parse((await download('https://api.github.com/repos/'+repository+'/releases?per_page=30',1048576)).toString());
 const candidate=releases.find(r=>!r.draft&&new RegExp('^ota-'+channel+'-[a-f0-9]{40}$').test(r.tag_name));if(!candidate){report('no-release',{channel});process.exit(0);}
 const url='https://github.com/'+repository+'/releases/download/'+candidate.tag_name+'/';
 const raw=await download(url+'ota-manifest.json',8192),sig=await download(url+'ota-manifest.sig',256);
 const installed=existsSync(base+'/installed.json')?json(base+'/installed.json'):{sequence:0};
 // Already installed releases are verified again but never re-applied.
 const m=verifyManifest(raw,Buffer.from(sig.toString().trim(),'base64'),readFileSync('/etc/daw-one-updater/public.pem'),channel,0);
 if(m.sequence<=installed.sequence){report('up-to-date',{channel,commit:installed.commit});process.exit(0);}
 if(candidate.tag_name!=='ota-'+channel+'-'+m.commit)throw Error('Tag mismatch');
 if(!canUpdate(await local('/api/state'))){report('waiting-idle',{channel,commit:m.commit});process.exit(0);}
 const disk=statfsSync(slots);if(disk.bavail*disk.bsize<268435456)throw Error('At least 256 MiB free staging space required');
 const bytes=await download(url+'tunebox-release.tar.gz',33554432);verifyArchive(bytes,m);
 const dest=slots+'/'+m.commit;if(realpathSync(app)===dest)throw Error('Candidate is already active');if(readdirSync(slots).length>=8)throw Error('Release storage full; remove unused slots through SSH');if(existsSync(dest))rmSync(dest,{recursive:true});mkdirSync(dest,{mode:0o755});
 const archive=base+'/candidate.tar.gz';writeFileSync(archive,bytes,{mode:0o600});run('python3',[new URL('./safe-extract.py',import.meta.url).pathname,archive,dest]);verifyTree(dest,m.release);
 run('chown',['-R','dawupdatebuild:dawupdatebuild',dest]);
 run('runuser',['-u','dawupdatebuild','--','env','-i','PATH=/usr/bin:/bin','HOME=/var/lib/daw-one-update-build','npm','ci','--prefix',dest,'--omit=dev','--ignore-scripts','--no-audit','--no-fund']);
 // node_modules is generated as an unprivileged user; freeze before activation.
 run('chown',['-R','root:root',dest]);run('chmod',['-R','go-w',dest]);verifyTree(dest,m.release);
 for(const f of ['kiosk.sh','set-display-mode.sh','health.sh','deployment-target','read-sensors.py'])if(existsSync(app+'/'+f))copyFileSync(app+'/'+f,dest+'/'+f);
 for(const f of ['kiosk.sh','set-display-mode.sh','health.sh'])if(existsSync(dest+'/'+f))run('chmod',['755',dest+'/'+f]);
 atomic(dest+'/deployment-ota.json',{commit:m.commit});run('chmod',['644',dest+'/deployment-ota.json']);
 if(!canUpdate(await local('/api/state'))){report('waiting-idle',{channel,commit:m.commit});process.exit(0);}
 // First installation is migrated only after the verified candidate is ready.
 if(realpathSync(app)===app){const old=slots+'/legacy-'+Date.now();atomic(base+'/pending.json',{previous:old,candidate:m.commit,kiosk:false});renameSync(app,old);symlinkSync(old,app);}
 report('installing',{channel,commit:m.commit});await activate(host,m);if(kiosk)run('systemctl',['start','daw-one-kiosk.service']);report('installed',{channel,commit:m.commit});
 const previous=json(base+'/installed.json').previous?.split('/').pop();const entries=readdirSync(slots).filter(name=>lstatSync(slots+'/'+name).isDirectory()&&!lstatSync(slots+'/'+name).isSymbolicLink()).map(name=>({name,modified:lstatSync(slots+'/'+name).mtimeMs}));for(const name of prunableSlots(entries,m.commit,previous))rmSync(slots+'/'+name,{recursive:true});
}catch(error){if(kiosk&&!existsSync(base+'/pending.json')){try{run('systemctl',['start','daw-one-kiosk.service']);}catch{}}report('error',{error:String(error.message).slice(0,180)});process.exitCode=1;}
