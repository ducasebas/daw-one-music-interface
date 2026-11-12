import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,rmSync} from 'node:fs';
const path='/var/lib/daw-one-manager/measurement-restore.json',units=['tunebox-player.service','squeezelite.service'];
const run=args=>execFileSync('/usr/bin/systemctl',args,{timeout:12000,stdio:['ignore','pipe','ignore'],encoding:'utf8'});
if(process.argv[2]==='prepare'){const active=[];writeFileSync(path,'[]',{mode:0o600});for(const unit of units){let running=false;try{running=run(['is-active',unit]).trim()==='active';}catch{}if(running){active.push(unit);writeFileSync(path,JSON.stringify(active),{mode:0o600});run(['stop',unit]);}}}
else if(process.argv[2]==='restore'){let saved=[];try{saved=JSON.parse(readFileSync(path,'utf8'));}catch{}for(const unit of units)if(saved.includes(unit)){try{run(['start',unit]);}catch{process.exitCode=1;}}rmSync(path,{force:true});}
else process.exitCode=2;
