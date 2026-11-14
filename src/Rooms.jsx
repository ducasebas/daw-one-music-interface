import React, {useCallback, useEffect, useRef, useState} from 'react';
import {tr} from '../shared/i18n.js';
import {groupCandidate, groupVolume, roomLeader, roomOutputs} from '../shared/multiroom.js';
import {Icon} from './Icon.jsx';
import {Modal} from './Modal.jsx';
import {TouchVolume, useVolumeRequests} from './TouchVolume.jsx';
import './rooms.css';

const Spinner = () => <span className="rooms-spinner" aria-hidden="true"/>;
function RoomVolume({value, muted, disabled, limit, onValue, group=false}) {
  const lane = useVolumeRequests(async event => onValue(event.value));
  return <TouchVolume label={group?'Group volume':'Room volume'} value={value} muted={muted} disabled={disabled} limit={limit} target={lane.target} onValue={lane.request}/>;
}
const reasons = {offline:'Room unavailable', 'other-group':'Remove from its other group first', 'group-leader':'Already leads a group', incompatible:'Not compatible with this group', unsupported:'Grouping unavailable'};

export function Rooms({offline, controlToken, onSnapshot, onSetup}) {
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState(null), [dialog, setDialog] = useState(null);
  const current = useRef(null), alive = useRef(true), online = useRef(!offline), token = useRef(controlToken);
  const request = useRef(null), epoch = useRef(0), mutation = useRef(false);
  current.current=data; online.current=!offline; token.current=controlToken;

  const refresh = useCallback(async (manual=false) => {
    if (!online.current || mutation.current || request.current) return;
    const controller = new AbortController(), version = ++epoch.current;
    request.current=controller;
    const timer=setTimeout(()=>controller.abort(),10000);
    if (manual || !current.current) setLoading(true);
    try {
      const response=await fetch('/api/rooms',{signal:controller.signal,cache:'no-store'}), value=await response.json();
      if (!response.ok) throw Error(value.error || 'Rooms could not be refreshed. Check the Music Assistant connection.');
      if (alive.current && version===epoch.current) {setData({...value,stale:false});if(manual)setError('');}
    } catch (e) {
      if (alive.current && version===epoch.current && !controller.signal.aborted) {setData(old=>old?{...old,stale:true}:null);setError(e.message);}
      if (alive.current && version===epoch.current && controller.signal.aborted) {setData(old=>old?{...old,stale:true}:null);setError('Rooms took too long to respond. Try refreshing.');}
    } finally {
      clearTimeout(timer);if(request.current===controller)request.current=null;
      if(alive.current&&version===epoch.current)setLoading(false);
    }
  },[]);

  useEffect(()=>{
    alive.current=true;
    if (!offline) refresh();
    else {setLoading(false);setData(old=>old?{...old,stale:true}:null);}
    const timer=setInterval(()=>{if(document.visibilityState!=='hidden')refresh();},3000);
    const visible=()=>{if(document.visibilityState!=='hidden')refresh();};
    window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);
    return()=>{alive.current=false;++epoch.current;request.current?.abort();request.current=null;clearInterval(timer);window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);};
  },[offline,refresh]);

  const act = async (body,key) => {
    if (mutation.current || !online.current || !current.current || !token.current) return false;
    mutation.current=true;++epoch.current;request.current?.abort();request.current=null;
    setLoading(false);setBusyKey(key);setError('');
    let responded=false;
    try {
      const response=await fetch('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json','X-TuneBox-Control':token.current},body:JSON.stringify({revision:current.current.revision,...body}),signal:AbortSignal.timeout(30000)});
      const value=await response.json();
      responded=true;
      if (!alive.current) return false;
      if (value.rooms) setData({...value.rooms,stale:false});
      if (!response.ok) throw Error(value.error || 'The room change could not be confirmed. Check the current rooms before trying again.');
      if (value.snapshot) onSnapshot?.(value.snapshot);
      return true;
    } catch(e) {
      if (alive.current) {if(!responded)setData(old=>old?{...old,stale:true}:null);setError(!responded?'The room change could not be confirmed. Check the current rooms before trying again.':e.message);}
      return false;
    } finally {
      mutation.current=false;if(alive.current)setBusyKey(null);
    }
  };

  const rooms=data?.rooms||[], selected=rooms.find(p=>p.id===data?.selectedId), leader=roomLeader(rooms,selected?.id);
  const connected=!offline&&data?.connected&&!data.stale, usable=connected&&!!controlToken;
  const writable=usable&&data.controlEnabled, changing=!!busyKey||(data?.busy&&!busyKey);
  const grouped=!!leader&&(leader.members.length>0||leader.type==='group');
  const groupOutputs=leader?roomOutputs(rooms,leader.id):[], level=leader?groupVolume(rooms,leader.id):null;
  const groupMuted=groupOutputs.length>0&&groupOutputs.every(p=>p.muted===true);
  const blocked = key => !writable || (changing && busyKey!==key);
  const editGroup=()=>{if(leader)setDialog({kind:'group',playerId:leader.id,revision:data.revision,members:[...leader.members]});};
  const moveMusic=()=>{if(leader)setDialog({kind:'transfer',playerId:leader.id,revision:data.revision,sourceKey:data.sourceKey,targetId:null});};
  const dialogRoom=dialog&&rooms.find(p=>p.id===dialog.playerId);
  const staleDialog=!!dialog&&(data?.revision!==dialog.revision||(dialog.kind==='transfer'&&data?.sourceKey!==dialog.sourceKey));
  const choices=dialog?.kind==='group'?[
    ...dialogRoom?.members.map(id=>rooms.find(p=>p.id===id)||{id,name:tr('Unavailable room'),available:false})||[],
    ...rooms.filter(p=>p.id!==dialogRoom?.id&&!dialogRoom?.members.includes(p.id)),
  ]:[];
  const targets=rooms.filter(p=>p.id!==leader?.id&&p.available&&!p.parentId&&(data?.queuePlayers||[]).includes(p.id));
  const saveGroup=async()=>{if(await act({action:'group',playerId:dialog.playerId,revision:dialog.revision,members:dialog.members,confirmed:true},'group'))setDialog(null);};
  const confirmMove=async()=>{if(await act({action:'transfer',playerId:dialog.playerId,targetId:dialog.targetId,sourceKey:dialog.sourceKey,revision:dialog.revision,confirmed:true},'transfer'))setDialog(null);};
  const confirmLeave=async()=>{if(await act({action:'leave',playerId:dialog.playerId,revision:dialog.revision,confirmed:true},'leave'))setDialog(null);};

  return <section className="multiroom" aria-label={tr('Multiroom')} aria-busy={loading}>
    <div className="rooms-toolbar">
      <div><span className="rooms-eyebrow">{tr('LISTENING IN')}</span><h2>{selected?.name||tr('Choose a room')}</h2></div>
      <div className="rooms-toolbar-actions">
        {data?.connected&&<><button onClick={editGroup} disabled={!writable||changing||data.locked||!leader?.available||!leader.canGroup}><Icon name="network"/>{tr('Group rooms')}</button><button onClick={moveMusic} disabled={!writable||changing||data.locked||!leader?.available||!data.canTransfer||!targets.length}><Icon name="rooms"/>{tr('Move music')}</button></>}
        <button aria-label={tr('Refresh rooms')} disabled={offline||changing||loading} onClick={()=>refresh(true)}>{loading?<Spinner/>:<Icon name="update"/>}<span>{tr(loading?'Refreshing…':'Refresh')}</span></button>
      </div>
    </div>
    {error&&!dialog&&<p className="rooms-error" role="alert"><Icon name="alert"/>{tr(error)}</p>}
    {offline||data?.stale?<p className="rooms-notice" role="status">{tr('Reconnect to control rooms. Displayed room details may be out of date.')}</p>:data?.configured&&!data.connected?<p className="rooms-notice" role="status">{tr('Music Assistant is disconnected. Reconnect before changing rooms.')} <button onClick={onSetup}>{tr('Connection settings')}</button></p>:data?.connected&&!data.controlEnabled?<p className="rooms-notice">{tr('Read-only. Enable Music Assistant control in connection settings.')} <button onClick={onSetup}>{tr('Connection settings')}</button></p>:data?.locked?<p className="rooms-notice">{tr('Unlock settings to edit groups or move music. Room volume remains available.')}</p>:null}
    {loading&&!data?<div className="rooms-empty" role="status"><Spinner/><h3>{tr('Finding your rooms…')}</h3></div>:!data?.configured?<div className="rooms-empty"><Icon name="network" size={46}/><h3>{tr('Your music, in every room')}</h3><p>{tr('Connect Music Assistant to see your players and synchronized groups.')}</p><button onClick={onSetup} disabled={offline}>{tr('Connect Music Assistant')}</button></div>:!rooms.length?<div className="rooms-empty"><Icon name="speaker" size={46}/><h3>{tr(data.connected?'No audio players found':'Music Assistant is disconnected')}</h3><p>{tr('Add or reconnect your players in Music Assistant, then refresh Rooms.')}</p><button onClick={onSetup}>{tr('Connection settings')}</button></div>:<>
      {grouped&&<section className="rooms-group" aria-label={tr('Selected group')}>
        <div><Icon name="network" size={30}/><div><h3>{leader.name}</h3><p>{groupOutputs.map(p=>rooms.find(r=>r.id===p.id)?.name||tr('Unavailable room')).join(' · ')}</p><small>{tr('Group level follows the loudest room. Room balance is preserved.')}</small></div></div>
        <RoomVolume group value={level} muted={groupMuted} limit={data.limit} disabled={level===null||blocked('group-volume:'+leader.id)} onValue={value=>act({action:'group-volume',playerId:leader.id,value},'group-volume:'+leader.id)}/>
        <button className="rooms-mute" aria-label={tr(groupMuted?'Unmute group':'Mute group')} disabled={blocked('group-mute')||groupOutputs.some(p=>!p.available||!p.canMute)} onClick={()=>act({action:'group-mute',playerId:leader.id,value:!groupMuted},'group-mute')}><Icon name={groupMuted?'mute':'volume'} size={26}/></button>
      </section>}
      <div className="rooms-scroll" tabIndex={0} aria-label={tr('Available rooms')}>
        <div className="rooms-grid">{rooms.map(room=>{
          const parent=rooms.find(p=>p.id===room.parentId), volumeKey='volume:'+room.id;
          const isSelected=room.id===data.selectedId, isGroup=room.type==='group';
          return <article className="rooms-card" key={room.id} aria-label={room.name} data-selected={isSelected} data-offline={!room.available}>
            <div className="rooms-card-heading"><span className="rooms-card-icon"><Icon name={isGroup?'network':'speaker'} size={30}/></span><div><h3>{room.name}</h3><p><i data-state={room.available?room.state:'offline'}/>{tr(!room.available?'Offline':room.state==='playing'?'Playing':room.state==='paused'?'Paused':'Ready')}{room.isLocal&&<span className="rooms-local">{tr('This TuneBox')}</span>}</p></div><button className="rooms-select" aria-label={tr('Control room')+' '+room.name} aria-pressed={isSelected} disabled={!usable||changing||!room.available||isSelected} onClick={()=>act({action:'select',playerId:room.id},'select:'+room.id)}>{busyKey==='select:'+room.id?<Spinner/>:<Icon name={isSelected?'check':'rooms'}/>}<span>{tr(isSelected?'Selected':'Control room')}</span></button></div>
            <div className="rooms-track"><strong>{room.title||tr(room.available?'Nothing playing':'Room unavailable')}</strong><span>{parent?tr('Grouped with')+' '+parent.name:room.artist||tr(room.members.length?'Group leader':'Independent room')}</span></div>
            <div className="rooms-card-controls"><RoomVolume value={isGroup?groupVolume(rooms,room.id):room.volume} muted={room.muted===true} disabled={blocked(volumeKey)||!room.available||isGroup||!room.canVolume||room.volume===null} limit={data.limit} onValue={value=>act({action:'volume',playerId:room.id,value},volumeKey)}/><button className="rooms-mute" aria-label={tr(room.muted?'Unmute room':'Mute room')} aria-pressed={room.muted===true} disabled={blocked('mute:'+room.id)||!room.available||isGroup||!room.canMute} onClick={()=>act({action:'mute',playerId:room.id,value:!room.muted},'mute:'+room.id)}><Icon name={room.muted?'mute':'volume'} size={25}/></button></div>
            {parent&&<button className="rooms-leave" disabled={!writable||changing||data.locked||!room.available||parent.staticMembers.includes(room.id)} onClick={()=>setDialog({kind:'leave',playerId:room.id,revision:data.revision})}>{tr(parent.staticMembers.includes(room.id)?'Permanent group member':'Leave group')}</button>}
          </article>;
        })}</div>
        <p className="rooms-help">{tr('Choose a room to control it. Selecting a room does not start music or change its volume.')}</p>
      </div>
    </>}
    {dialog&&<Modal className="rooms-dialog" label={dialog.kind==='group'?'Edit room group':dialog.kind==='transfer'?'Move music':'Leave group'} onCancel={()=>{if(!busyKey)setDialog(null);}}>
      <header><div><span className="rooms-eyebrow">{tr('ROOMS')}</span><h2>{tr(dialog.kind==='group'?'Play together':dialog.kind==='transfer'?'Move music':'Remove this room?')}</h2></div><button aria-label={tr('Close room dialog')} disabled={!!busyKey} onClick={()=>setDialog(null)}><Icon name="close" size={28}/></button></header>
      {staleDialog?<div className="rooms-dialog-stale" role="alert"><Icon name="alert"/><p>{tr('Rooms or the playing track changed. Review the current rooms before confirming.')}</p><button disabled={!!busyKey} onClick={()=>dialog.kind==='group'?editGroup():dialog.kind==='transfer'?moveMusic():setDialog(null)}>{tr('Review current rooms')}</button></div>:<>
        <p className="rooms-dialog-description">{tr(dialog.kind==='group'?'Selected rooms follow the group leader. Any music already playing in a newly joined room is replaced.':dialog.kind==='transfer'?'Moves the current queue and listening position. The destination queue is replaced. Paused music stays paused.':'This room leaves the group. The other rooms keep their current music.')}</p>
        {dialog.kind==='group'?<><div className="rooms-dialog-leader"><Icon name="speaker"/><strong>{dialogRoom?.name}</strong><span>{tr('Group leader')}</span></div><div className="rooms-choice-list">{choices.map(room=>{
          const member=dialogRoom.members.includes(room.id), permanent=dialogRoom.staticMembers.includes(room.id);
          const reason=member?null:groupCandidate(dialogRoom,room), disabled=!!busyKey||permanent||!!reason;
          return <label key={room.id} data-disabled={disabled}><input type="checkbox" aria-label={room.name} checked={dialog.members.includes(room.id)} disabled={disabled} onChange={e=>setDialog(d=>({...d,members:e.target.checked?[...d.members,room.id]:d.members.filter(id=>id!==room.id)}))}/><span><strong>{room.name}</strong><small>{tr(permanent?'Permanent group member':member?'In this group':reasons[reason]||'Available to join')}</small></span><Icon name={member?'network':'speaker'}/></label>;
        })}</div>{!choices.some(r=>!dialogRoom.members.includes(r.id)&&!groupCandidate(dialogRoom,r))&&<p className="rooms-help">{tr('No other compatible rooms are available. Squeezelite players can group when Music Assistant reports compatibility.')}</p>}</>:dialog.kind==='transfer'?<div className="rooms-choice-list rooms-targets">{targets.map(room=><button key={room.id} aria-pressed={dialog.targetId===room.id} disabled={!!busyKey} onClick={()=>setDialog(d=>({...d,targetId:room.id}))}><Icon name={room.type==='group'?'network':'speaker'} size={30}/><span><strong>{room.name}</strong><small>{tr(room.state==='playing'?'Playing — queue will be replaced':'Available destination')}</small></span>{dialog.targetId===room.id&&<Icon name="check"/>}</button>)}</div>:<div className="rooms-dialog-leader"><Icon name="speaker"/><strong>{dialogRoom?.name}</strong></div>}
      </>}
      {error&&<p className="rooms-error" role="alert">{tr(error)}</p>}
      <footer><button disabled={!!busyKey} onClick={()=>setDialog(null)}>{tr('Cancel')}</button><button className="rooms-primary" disabled={!!busyKey||staleDialog||!writable||data?.locked||(dialog.kind==='transfer'&&!dialog.targetId)} onClick={dialog.kind==='group'?saveGroup:dialog.kind==='transfer'?confirmMove:confirmLeave}>{busyKey&&<Spinner/>}{tr(busyKey?'Applying…':dialog.kind==='group'?'Save group':dialog.kind==='transfer'?'Move music':'Remove room')}</button></footer>
    </Modal>}
  </section>;
}
