import {existsSync,readFileSync} from 'node:fs';
const helper='/usr/local/lib/daw-one-control/deploy/manager/power-off.sh';
const rebootHelper='/usr/local/lib/daw-one-control/deploy/manager/reboot.sh';
/** Fixed, delayed systemd action. No caller-supplied commands, units or paths. */
export function powerController({run,exists=existsSync,read=readFileSync}){
  let queued=false;
  function supported(){
    try{return /^Raspberry Pi [34] Model B/.test(read('/proc/device-tree/model','utf8'))&&exists('/usr/bin/systemd-run')&&exists(helper);}catch{return false;}
  }
  async function updateRunning(){
    const status=(await run('/usr/bin/systemctl',['is-active','daw-one-update.service']).catch(()=>'' )).trim();
    return ['active','activating','deactivating'].includes(status)||exists('/var/lib/daw-one-updater/request.json');
  }
  return {
    supported,get queued(){return queued;},
    rebootSupported(){try{return supported()&&exists(rebootHelper);}catch{return false;}},
    /** Fixed delayed reboot through the installed helper. The caller checks that playback is idle. */
    async reboot(){
      if(!supported()||!exists(rebootHelper))throw Error('Restart requires the installed Raspberry Pi device manager');
      if(queued)throw Error('A power action is already queued');
      if(await updateRunning())throw Error('Wait for the software update to finish before restarting');
      await run('/usr/bin/systemd-run',['--quiet','--unit=daw-one-reboot','--on-active=3s','--timer-property=AccuracySec=100ms',rebootHelper]);
      queued=true;
      return {queued:true,simulated:false,reboot:true};
    },
    /** Restart only the TuneBox interface service. Audio players and the device manager keep running. */
    async restartService(){
      if(queued)throw Error('A power action is already queued');
      if(await updateRunning())throw Error('Wait for the software update to finish before restarting the service');
      await run('/usr/bin/systemctl',['restart','--no-block','daw-one.service']);
      return {restarting:true,simulated:false};
    },
    async queue(){
      if(!supported())throw Error('Power off requires the installed Raspberry Pi device manager');
      if(queued)throw Error('Power off already queued');
      if(await updateRunning())throw Error('Wait for the software update to finish before powering off');
      await run('/usr/bin/systemd-run',['--quiet','--unit=daw-one-power-off','--on-active=3s','--timer-property=AccuracySec=100ms',helper]);
      queued=true;
      return {queued:true,simulated:false,powerOff:true};
    }
  };
}
