import {createHash,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {normalizeRooms, roomLeader, roomOutputs, groupCandidate, groupVolumeTargets, roomRequest, startupJoinTargets} from '../shared/multiroom.js';
const bootSession=(()=>{try{return readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim();}catch{return randomUUID();}})();

const conflict = message => Object.assign(Error(message), {status:409});
export class MultiroomService {
  constructor(music, {settleMs=1500,joinSettleMs=8000,localId=music?.config.playerId}={}) { this.music = music; this.busy = false; this.settleMs=settleMs; this.joinSettleMs=joinSettleMs; this.localId=localId||null; }

  localPlayback() {
    if(!this.music)return false;
    const rooms=normalizeRooms(this.music.players,this.localId),local=rooms.find(p=>p.isLocal);
    if(!local?.available)return null;
    const leader=roomLeader(rooms,local.id);
    if(local.state==='playing'||leader?.state==='playing')return true;
    return leader?.available?false:null;
  }

  status() {
    const music = this.music;
    const rooms = normalizeRooms(music?.players, this.localId);
    const selectedId = music?.playerId || null;
    const graph = rooms.map(({id, provider, type, available, canVolume, canMute, canPause, canGroup, canGroupWith, parentId, members, staticMembers}) => ({id, provider, type, available, canVolume, canMute, canPause, canGroup, canGroupWith:[...canGroupWith].sort(), parentId, members:[...members].sort(), staticMembers:[...staticMembers].sort()})).sort((a,b) => a.id.localeCompare(b.id));
    const revision = createHash('sha256').update(JSON.stringify([selectedId, graph])).digest('hex');
    return {
      connected: music?.status === 'connected', configured: !!music, mode: music ? 'music-assistant' : 'simulation',
      controlEnabled: music?.config.controlEnabled === true, limit: music?.config.volumeLimit ?? 40,
      selectedId, localId: this.localId, bootId:bootSession, revision, rooms, busy:this.busy||this.music?.controlBusy===true,
      sourceKey: music?.playback.queue[0]?.mediaKey || null,
      canTransfer: !!music?.queueId && music?.queueActive !== false && music?.playback.queue[0]?.id !== 'none',
      queuePlayers: music?.queueIds || [], observedAt:Date.now(),
    };
  }

  async read() {
    if (this.music?.status === 'connected' && !this.busy && !this.music.controlBusy) await this.music.refresh();
    return this.status();
  }

  async act(body) {
    const value = roomRequest(body);
    if (this.busy||this.music?.controlBusy) throw conflict('Another room change is in progress.');
    if (!this.music || this.music.status !== 'connected') throw conflict('Connect Music Assistant to control rooms.');
    if (value.action !== 'select' && !this.music.config.controlEnabled) throw conflict('Music Assistant is read-only.');
    this.busy = true;
    this.music.roomCommandBusy = true;
    let commandSent = false;
    let confirmed = null;
    try {
      await this.music.refresh();
      const state = this.status();
      if (state.revision !== value.revision) throw conflict('Rooms changed. Review the current rooms and try again.');
      const room = state.rooms.find(p => p.id === value.playerId);
      if (!room || !room.available) throw conflict('This room is unavailable.');
      const command = async (name, args) => {
        if (name==='players/cmd/volume_set'&&args.volume_level>this.music.config.volumeLimit) throw conflict('Volume exceeds the saved limit.');
        commandSent = true;return this.music.transport.command(name, args);
      };
      const outputs = id => roomOutputs(state.rooms, id);
      const audible = players => {
        if (!players.length || players.some(p => !p.available || !Number.isFinite(p.volume) || p.volume > state.limit)) throw conflict('Lower every affected room to the saved volume limit before starting or grouping music.');
      };
      const memberCommand = (add, remove) => command('players/cmd/set_members', {target_player:room.id, player_ids_to_add:add, player_ids_to_remove:remove});
      if (value.action === 'select') {
        await this.music.selectPlayer(room.id,{fromRooms:true});
        confirmed = next => next.selectedId===room.id;
      } else if (value.action === 'volume') {
        if (room.type === 'group' || !room.canVolume) throw conflict('Use the group volume control for this room.');
        if (value.value > state.limit) throw conflict('Volume exceeds the saved limit.');
        await command('players/cmd/volume_set', {player_id:room.id, volume_level:value.value});
        confirmed = next => next.rooms.find(p=>p.id===room.id)?.volume===value.value;
      } else if (value.action === 'group-volume') {
        if (room.parentId || (!room.members.length && room.type !== 'group')) throw conflict('Select a group leader first.');
        const targets=groupVolumeTargets(outputs(room.id), value.value, state.limit);
        for (const target of targets) await command('players/cmd/volume_set', {player_id:target.id, volume_level:target.value});
        confirmed = next => targets.every(t=>next.rooms.find(p=>p.id===t.id)?.volume===t.value);
      } else if (value.action === 'mute' || value.action === 'group-mute') {
        const targets = value.action === 'group-mute' ? outputs(room.id) : [room];
        if (targets.some(p => !p.available || !p.canMute || p.type === 'group')) throw conflict('Mute is unavailable for one of these rooms.');
        if (!value.value) audible(targets);
        for (const target of targets) await command('players/cmd/volume_mute', {player_id:target.id, muted:value.value});
        confirmed = next => targets.every(t=>next.rooms.find(p=>p.id===t.id)?.muted===value.value);
      } else if (value.action === 'pause') {
        const leader = roomLeader(state.rooms, room.id);
        if (!leader?.available || !leader.canPause) throw conflict('Pause is unavailable for this room.');
        await command('players/cmd/pause', {player_id:leader.id});
        confirmed = next => next.rooms.find(p=>p.id===leader.id)?.state!=='playing';
      } else if(value.action==='join') {
        if(room.id!==this.localId||!startupJoinTargets(state).some(p=>p.id===value.targetId))throw conflict('Choose a compatible playing room while this TuneBox is idle.');
        // The existing rooms are already audible. Check only the new local
        // endpoint; never lower or copy the leader's existing volume.
        audible([room]);
        await command('players/cmd/set_members',{target_player:value.targetId,player_ids_to_add:[room.id],player_ids_to_remove:[]});
        await this.music.selectPlayer(room.id,{fromRooms:true});
        confirmed=next=>next.rooms.find(p=>p.id===value.targetId)?.members.includes(room.id)&&next.rooms.find(p=>p.id===room.id)?.parentId===value.targetId;
      } else if (value.action === 'group') {
        if (room.parentId || !room.canGroup) throw conflict('This player does not support editing a group.');
        const add = value.members.filter(id => !room.members.includes(id));
        const remove = room.members.filter(id => !value.members.includes(id));
        if (remove.some(id => room.staticMembers.includes(id))) throw conflict('Permanent group members cannot be removed here.');
        for (const id of add) {
          const member = state.rooms.find(p => p.id === id);
          if (groupCandidate(room, member)) throw conflict('Choose an available compatible room outside another group.');
        }
        if (add.length) audible([...outputs(room.id), ...add.flatMap(outputs)]);
        if (add.length || remove.length) await memberCommand(add, remove);
        confirmed = next => {
          const actual=next.rooms.find(p=>p.id===room.id)?.members;
          return !!actual&&actual.length===value.members.length&&value.members.every(id=>actual.includes(id));
        };
      } else if (value.action === 'leave') {
        const parent = state.rooms.find(p => p.id === room.parentId);
        if (!parent?.available || !parent.canGroup || !parent.members.includes(room.id)) throw conflict('The group leader is unavailable.');
        if (parent.staticMembers.includes(room.id)) throw conflict('Permanent group members cannot leave here.');
        await command('players/cmd/set_members', {target_player:parent.id, player_ids_to_add:[], player_ids_to_remove:[room.id]});
        confirmed = next => !next.rooms.find(p=>p.id===parent.id)?.members.includes(room.id)&&next.rooms.find(p=>p.id===room.id)?.parentId!==parent.id;
      } else if (value.action === 'transfer') {
        const source = roomLeader(state.rooms, state.selectedId);
        const target = state.rooms.find(p => p.id === value.targetId);
        if (!source || source.id !== room.id || !state.canTransfer || state.sourceKey !== value.sourceKey) throw conflict('The playing track or selected room changed. Review the move again.');
        if (!target?.available || target.parentId || target.id === source.id || !state.queuePlayers.includes(target.id)) throw conflict('Choose a different available room or group with a Music Assistant queue.');
        const queues = await this.music.transport.command('player_queues/all');
        if (!Array.isArray(queues) || !queues.some(q => q.queue_id === this.music.queueId) || !queues.some(q => q.queue_id === target.id)) throw conflict('The source or destination queue is unavailable.');
        audible(outputs(target.id));
        await command('player_queues/transfer', {source_queue_id:this.music.queueId, target_queue_id:target.id, auto_play:this.music.playback.playing === true});
        await this.music.selectPlayer(target.id,{fromRooms:true});
        confirmed = next => next.selectedId===target.id&&next.sourceKey===value.sourceKey;
      }
      const until=Date.now()+(value.action==='join'?this.joinSettleMs:this.settleMs);
      while(true){
        await this.music.refresh();
        if(!confirmed||confirmed(this.status()))break;
        if(Date.now()>=until)throw conflict('The room change could not be confirmed. Check the current rooms before trying again.');
        await new Promise(resolve=>setTimeout(resolve,100));
      }
    } catch (error) {
      if (commandSent) {
        try { await this.music.refresh(); } catch { this.music.failed('Room state refresh failed'); }
        throw conflict('The room change could not be confirmed. Check the current rooms before trying again.');
      }
      if (error.status) throw error;
      throw conflict('Rooms could not be refreshed. Check the Music Assistant connection.');
    } finally { this.busy = false; this.music.roomCommandBusy=false; }
    return this.status();
  }
}
