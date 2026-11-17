import {canUpdate} from '../deploy/ota/policy.mjs';
import {updatePhases} from '../shared/update-settings.js';
import {validateRequest} from '../shared/device-manager.js';
import {roomLeader,roomOutputs} from '../shared/multiroom.js';

const conflict=message=>Object.assign(Error(message),{status:409});

function installArguments(request){
  // Validate the envelope before any playback side effect. Group consent belongs
  // to this API; the installed root manager still receives the fixed command.
  validateRequest({...request,args:{}});
  if(request.command!=='install')throw conflict('Choose Install update to pause playback.');
  const args=request.args??{};
  if(typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(k=>!['pauseGroup','roomsRevision'].includes(k)))throw conflict('Invalid update confirmation.');
  if(args.pauseGroup!==undefined&&typeof args.pauseGroup!=='boolean'||args.roomsRevision!==undefined&&(args.pauseGroup!==true||typeof args.roomsRevision!=='string'||! /^[a-f0-9]{64}$/.test(args.roomsRevision))||args.pauseGroup===true&&args.roomsRevision===undefined)throw conflict('Invalid update confirmation.');
  return args;
}

/** Explicit installation may pause music. The timer/updater never uses this path. */
export class ManualUpdate {
  constructor({snapshot,status,manage,music,multiroom,pauseSimulation,sleep=ms=>new Promise(r=>setTimeout(r,ms)),now=()=>performance.now()}){
    Object.assign(this,{snapshot,status,manage,music,multiroom,pauseSimulation,sleep,now});
    this.busy=false;
  }

  assertAvailable(){
    if(this.busy)throw conflict('Wait while playback is prepared for the update.');
  }

  async install(request){
    const args=installArguments(request);
    this.assertAvailable();this.busy=true;
    let paused=false;
    try{
      const update=await this.status();
      if(!update?.manager?.managed||!update.manager.configured)throw conflict('Configure signed updates before installing.');
      if(updatePhases.includes(update.status)||update.status==='checking')throw conflict('Wait for the current update action to finish.');
      if(!update.available?.commit||! /^[a-f0-9]{40}$/.test(update.available.commit))throw conflict('Check for an update before installing.');
      if(this.multiroom?.busy||this.music?.controlBusy||this.music?.roomCommandBusy)throw conflict('Wait for the room change to finish.');
      if(this.music)await this.music.refresh();
      const state=this.snapshot();
      const localPlaying=state.activity?.localPlayback;
      if(typeof state.playback?.playing!=='boolean'||typeof localPlaying!=='boolean')throw conflict('Playback state is unavailable. Reconnect Music Assistant before installing.');
      // Keep every existing fault/activity gate. Only the effects of an actual
      // pause are projected; the virtual amplifier is a simulator-only value.
      const afterPause={...state,device:state.mode==='simulation'?{...state.device,amplifierEnabled:false}:state.device,playback:{...state.playback,playing:false},activity:{...state.activity,localPlayback:false}};
      if(!canUpdate(afterPause))throw conflict('Finish audio activity and resolve device faults before installing.');
      if(this.music&&(state.playback.playing||localPlaying)){
        const rooms=this.multiroom.status(),local=rooms.rooms.find(p=>p.id===rooms.localId),leader=roomLeader(rooms.rooms,rooms.localId);
        if(!local?.available||!leader?.available)throw conflict('The local TuneBox player is unavailable.');
        if(state.playback.playing&&rooms.selectedId!==local.id&&rooms.selectedId!==leader.id)throw conflict('Select the local TuneBox player before installing. Other rooms will keep playing.');
        const outputs=roomOutputs(rooms.rooms,leader.id);
        if(!outputs.length||outputs.some(p=>!p.available))throw conflict('Refresh the affected rooms before installing.');
        if(!leader.canPause)throw conflict('This player cannot pause. Stop its music before installing.');
        const grouped=leader.id!==local.id||outputs.some(p=>p.id!==local.id);
        if(grouped&&(args.pauseGroup!==true||args.roomsRevision!==rooms.revision)){
          throw Object.assign(conflict('Installing will pause these rooms. Confirm before continuing.'),{code:'update-group-confirmation',rooms:outputs.map(p=>({id:p.id,name:p.name})),roomsRevision:rooms.revision});
        }
        if(args.pauseGroup===true&&args.roomsRevision!==rooms.revision)throw conflict('Rooms changed. Check them before installing.');
        // The room service rechecks the graph and serializes the one pause
        // command. No queue, volume, grouping or selected player is changed.
        await this.multiroom.act({action:'pause',playerId:local.id,revision:rooms.revision});
        paused=true;
        const deadline=this.now()+8000;
        while(!canUpdate(this.snapshot())){
          if(this.now()>=deadline)throw conflict('Playback did not confirm a pause. The update has not started.');
          await this.sleep(200);await this.music.refresh();
        }
      }else if(!this.music&&state.playback.playing){
        await this.pauseSimulation();paused=true;
      }
      if(!canUpdate(this.snapshot()))throw conflict('Playback or device state changed. The update has not started.');
      const result=await this.manage({command:'install',args:{}});
      return {...result,pausedForUpdate:paused};
    }catch(error){
      // Never retry pause or resume unexpectedly after an error/rollback.
      if(paused&&!error.code)error.message+=' Music remains paused.';
      throw error;
    }finally{this.busy=false;}
  }
}
