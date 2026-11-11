import {mkdirSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import {DeviceManager} from '../shared/device-manager.js';
import {updateSettings,installationDecision} from '../shared/update-settings.js';
import {canUpdate,activate,restorePrevious} from '../deploy/ota/policy.mjs';
import {release} from '../shared/release.js';
export function simulatedDevice({snapshot,directory='.tunebox-state',delay=350,onEvent=()=>{}}={}){
 let saved={};try{saved=JSON.parse(readFileSync(join(directory,'device.json'),'utf8'));}catch{}
 let policy=updateSettings(saved.policy),current={release:release.id,commit:null},previous=null,progress={status:'up-to-date'},available=null,running=false;
 const save=()=>{mkdirSync(directory,{recursive:true});writeFileSync(join(directory,'device.json.tmp'),JSON.stringify({policy,setupComplete:saved.setupComplete})+'\n',{mode:0o600});renameSync(join(directory,'device.json.tmp'),join(directory,'device.json'));};
 const report=status=>{progress={status,checkedAt:new Date().toISOString(),percent:null};onEvent(status);};
 const phase=async status=>{report(status);await new Promise(r=>setTimeout(r,delay));};
 const manager=new DeviceManager({
  status:async()=>({managed:true,simulated:true,configured:true,channel:'preview',policy,current:current.commit,previousAvailable:!!previous,setupComplete:saved.setupComplete!==false,networkSupported:true,audioTestSupported:true,progressDisplay:false,powerOffSupported:true}),
  async perform(command,args){
   if(command==='power-off'){if(running)throw Error('Wait for the software update to finish before powering off');return {queued:true,simulated:true,powerOff:true};}
   if(command==='policy'){policy=args;save();return {saved:true,policy};}
   if(command==='network')return {supported:true,connected:true,simulated:true,interfaces:[{name:'wlan0',type:'wifi',state:'connected'}]};
   if(command==='wifi')return {connected:true,simulated:true};
   if(command==='probe-music')return {simulated:true,serverVersion:'simulation',players:[{id:'simulated-tunebox',name:'TuneBox · simulation',available:true}]};
   if(command==='save-music')return {saved:false,simulated:true,message:'Simulation only; live server configuration unchanged'};
   if(command==='audio-test')return {played:false,simulated:true,message:'Simulated headphone test; no physical audio emitted'};
   if(command==='complete-setup'){saved.setupComplete=true;save();return {saved:true,simulated:true};}
   if(running)throw Error('Update already running');
   if(command==='check'){available={release:release.id+'-preview',commit:'f'.repeat(40),notes:'Simulated update: verify download, restart and recovery without changing installed software.'};report('available');return {queued:true,simulated:true};}
   if(command==='install'){
    if(!available)throw Error('Check for an update first');
    const decision=installationDecision(policy,'install',canUpdate(snapshot()));if(decision!=='install'){report(decision);return {queued:true,simulated:true};}
    running=true;
    void(async()=>{try{
     report('downloading');for(const percent of [10,35,70,100]){progress={...progress,percent,totalBytes:1000000,downloadedBytes:percent*10000};await new Promise(r=>setTimeout(r,delay));}
     await phase('verifying');await phase('preparing');
     if(!canUpdate(snapshot())){report('waiting-idle');return;}
     const host={current:async()=>current,journal:async()=>{},stop:async()=>{},select:async()=>{},start:async()=>{},healthy:async()=>true,commit:async()=>{previous=current;current=available;},clearJournal:async()=>{}};
     await activate(host,available,phase);available=null;report('installed');
    }catch{report('error');}finally{running=false;}})();return {queued:true,simulated:true};
   }
   if(command==='rollback'){
    if(!previous||!canUpdate(snapshot()))throw Error('Previous simulated version unavailable or playback/state unsafe');running=true;
    void(async()=>{try{const old=current;const target=previous;const host={current:async()=>old,journal:async()=>{},stop:async()=>{},select:async()=>{},start:async()=>{},healthy:async()=>true,commitRollback:async()=>{current=target;previous=old;policy={...policy,mode:'paused'};save();},clearJournal:async()=>{}};await restorePrevious(host,target,phase);report('rolled-back');}finally{running=false;}})();return {queued:true,simulated:true};
   }
  }
 });
 return {request:value=>manager.request(value),status:()=>({...progress,current,available,channel:'preview'})};
}
