import {spawn} from 'node:child_process';
/** Hold the updater's kernel lock through source entry, including its final idle check. */
export async function withUpdateLock(action,path='/run/daw-one-update.lock'){
 const child=spawn('/usr/bin/flock',['--nonblock',path,'/bin/sh','-c','printf "ready\\n"; exec /bin/cat >/dev/null'],{stdio:['pipe','pipe','ignore']});
 child.stdin.on('error',()=>{});
 let exited=false;const done=new Promise(resolve=>child.once('close',()=>{exited=true;resolve();}));
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Audio ownership lock timed out')),3000);const finish=fn=>value=>{clearTimeout(timer);fn(value);};child.once('error',finish(reject));child.once('exit',finish(()=>reject(Error('Wait for the software update or audio source change to finish'))));child.stdout.once('data',finish(data=>data.toString()==='ready\n'?resolve():reject(Error('Audio ownership lock unavailable'))));});
  return await action();
 }finally{
  child.stdin.end();if(!exited){const timer=setTimeout(()=>child.kill('SIGTERM'),1000);await done;clearTimeout(timer);}
 }
}
