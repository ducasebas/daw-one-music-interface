/**
 * After the owner confirms an audible room sweep, stop what would interfere with it:
 * a running picture/meter sync capture, Bluetooth audio, group membership and local
 * playback. Each step is a single attempt; any failure stops before the sweep starts.
 * Only this TuneBox is changed: other rooms keep playing without it.
 */
export async function prepareMeasurement({bluetooth,syncRunning,manage,music,multiroom,runtime}){
 const stopped=[];
 if(syncRunning()){await manage({command:'sync-stop',args:{}});stopped.push('sync');}
 if(bluetooth().active){await manage({command:'bluetooth-stop',args:{}});stopped.push('bluetooth');}
 if(music){
  if(music.status!=='connected')throw Error('Connect Music Assistant, or pause music on this TuneBox, before measuring');
  let state=multiroom.status(),local=state.rooms.find(p=>p.isLocal);
  if(local?.parentId){await multiroom.act({action:'leave',playerId:local.id,revision:state.revision,confirmed:true});stopped.push('group');}
  else if(local?.members?.length&&local.type!=='group'){
   await multiroom.act({action:'group',playerId:local.id,revision:state.revision,members:[],confirmed:true});stopped.push('group');
  }
  // After leaving any group, TuneBox leads itself, so this pauses only this player.
  state=multiroom.status();local=state.rooms.find(p=>p.isLocal);
  if(local?.available&&local.state==='playing'){
   if(!local.canPause)throw Error('Pause music on this TuneBox before measuring');
   await multiroom.act({action:'pause',playerId:local.id,revision:state.revision});stopped.push('playback');
  }
 }else if(runtime?.playback?.playing){runtime.dispatch({type:'pause'});stopped.push('playback');}
 return stopped;
}
