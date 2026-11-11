import {existsSync,readFileSync} from 'node:fs';
const helper='/usr/local/lib/daw-one-control/deploy/manager/power-off.sh';
/** Fixed, delayed systemd action. No caller-supplied commands, units or paths. */
export function powerController({run,exists=existsSync,read=readFileSync}){
  let queued=false;
  function supported(){
    try{return /^Raspberry Pi [34] Model B/.test(read('/proc/device-tree/model','utf8'))&&exists('/usr/bin/systemd-run')&&exists(helper);}catch{return false;}
  }
  return {
    supported,get queued(){return queued;},
    async queue(){
      if(!supported())throw Error('Power off requires the installed Raspberry Pi device manager');
      if(queued)throw Error('Power off already queued');
      const status=(await run('/usr/bin/systemctl',['is-active','daw-one-update.service']).catch(()=>'' )).trim();
      if(['active','activating','deactivating'].includes(status)||exists('/var/lib/daw-one-updater/request.json'))throw Error('Wait for the software update to finish before powering off');
      await run('/usr/bin/systemd-run',['--quiet','--unit=daw-one-power-off','--on-active=3s','--timer-property=AccuracySec=100ms',helper]);
      queued=true;
      return {queued:true,simulated:false,powerOff:true};
    }
  };
}
