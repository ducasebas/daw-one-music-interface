const text = (value, max = 160) => typeof value === 'string' ? value.replace(/[\x00-\x1f\x7f]/g, '').slice(0, max) : '';
const ids = value => Array.isArray(value) ? [...new Set(value.filter(v => typeof v === 'string' && v.length > 0 && v.length <= 200 && !/[\x00-\x1f\x7f]/.test(v)))].slice(0, 128) : [];
const level = value => Number.isFinite(value) && value >= 0 && value <= 100 ? Math.round(value) : null;
const audioTypes = new Set(['player', 'stereo_pair', 'group']);

/** Only playback targets and explicitly public fields cross the room API. */
export function normalizeRooms(players, localId) {
  const seen = new Set();
  return (Array.isArray(players) ? players : []).slice(0, 256).filter(p => {
    if (!p || typeof p.player_id !== 'string' || !p.player_id || p.player_id.length > 200 || /[\x00-\x1f\x7f]/.test(p.player_id) || seen.has(p.player_id)) return false;
    seen.add(p.player_id);
    return p.enabled !== false && p.hide_in_ui !== true && p.private !== true && audioTypes.has(p.type || 'player');
  }).map(p => {
    const features = ids(p.supported_features), id = p.player_id;
    const parent = p.active_group || p.synced_to;
    const media = p.current_media || {};
    return {
      id, name: text(p.name || p.display_name) || 'Unnamed room', provider: text(p.provider), type: p.type || 'player',
      available: p.available === true, state: ['playing', 'paused', 'idle'].includes(p.playback_state || p.state) ? (p.playback_state || p.state) : 'idle',
      volume: level(p.volume_level), muted: typeof p.volume_muted === 'boolean' ? p.volume_muted : null,
      canVolume: features.includes('volume_set'), canMute: features.includes('volume_mute'), canPause: features.includes('pause'),
      canGroup: features.includes('set_members'), canGroupWith: ids(p.can_group_with),
      parentId: typeof parent === 'string' && parent !== id ? text(parent, 200) : null,
      members: ids(p.group_members).filter(v => v !== id), staticMembers: ids(p.static_group_members).filter(v => v !== id),
      title: text(media.title || media.name), artist: text(media.artist), isLocal: id === localId,
    };
  });
}

export function roomLeader(rooms, id) {
  const visited = new Set();
  let room = rooms.find(p => p.id === id);
  while (room?.parentId) {
    if (visited.has(room.id)) return null;
    visited.add(room.id);
    room = rooms.find(p => p.id === room.parentId);
  }
  return room || null;
}

/** A virtual group has no speaker of its own; a native sync leader does. */
export function roomOutputs(rooms, id) {
  const result = [], visited = new Set();
  const visit = key => {
    if (visited.has(key)) return;
    visited.add(key);
    const room = rooms.find(p => p.id === key);
    if (!room) { result.push({id:key, available:false, volume:null, canVolume:false}); return; }
    if (room.type !== 'group') result.push(room);
    for (const member of room.members) visit(member);
  };
  visit(id);
  return result;
}

export function groupCandidate(leader, room) {
  if (!leader || !room || room.id === leader.id) return 'same-room';
  if (!leader.canGroup || leader.parentId) return 'unsupported';
  if (!room.available) return 'offline';
  if (room.type === 'group' || room.members.length > 0) return 'group-leader';
  if (room.parentId && room.parentId !== leader.id) return 'other-group';
  return leader.canGroupWith.includes(room.id) || (!!room.provider && leader.canGroupWith.includes(room.provider)) ? null : 'incompatible';
}

/** Offer an idle local endpoint the existing native leader, never reverse it. */
export function startupJoinTargets(state) {
  if(!state?.connected||!state.controlEnabled)return [];
  const rooms=state.rooms||[],local=rooms.find(p=>p.id===state.localId);
  if(!local?.available||local.parentId||local.members.length||local.state==='playing')return [];
  return rooms.filter(p=>p.id!==local.id&&p.available&&!p.parentId&&p.state==='playing'&&!p.members.includes(local.id)&&!groupCandidate(p,local));
}

export function groupVolume(rooms, id) {
  const outputs = roomOutputs(rooms, id);
  if (!outputs.length || outputs.some(p => !p.available || !p.canVolume || !Number.isFinite(p.volume))) return null;
  return Math.max(...outputs.map(p => p.volume));
}

/** Every individual command remains below the ceiling, including unbalanced groups. */
export function groupVolumeTargets(outputs, value, limit) {
  if (!Number.isInteger(value) || value < 0 || value > limit) throw Error('Volume exceeds the saved limit.');
  if (!outputs.length || outputs.some(p => !p.available || !p.canVolume || !Number.isFinite(p.volume))) throw Error('Read every room volume before adjusting the group.');
  const base = Math.max(...outputs.map(p => p.volume));
  return outputs.map(p => {
    const target = value <= base ? (base === 0 ? 0 : p.volume * value / base) : p.volume + (100 - p.volume) * (value - base) / (100 - base);
    return {id:p.id, value:Math.min(limit, Math.max(0, Math.round(target)))};
  });
}

const actions = {
  select: [], volume: ['value'], mute: ['value'], pause: [],
  group: ['members', 'confirmed'], leave: ['confirmed'],
  'group-volume': ['value'], 'group-mute': ['value'],
  transfer: ['targetId', 'sourceKey', 'confirmed'], join: ['targetId','confirmed'],
};
export function roomRequest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.hasOwn(actions, value.action)) throw Error('Invalid room action.');
  const validId = id => typeof id === 'string' && id.length > 0 && id.length <= 200 && !/[\x00-\x1f\x7f]/.test(id);
  const allowed = ['action', 'playerId', 'revision', ...actions[value.action]];
  if (Object.keys(value).some(k => !allowed.includes(k)) || !validId(value.playerId) || typeof value.revision !== 'string' || !/^[a-f0-9]{64}$/.test(value.revision)) throw Error('Invalid room request.');
  if (actions[value.action].includes('confirmed') && value.confirmed !== true) throw Error('Confirm the room change first.');
  if (['volume','group-volume'].includes(value.action) && (!Number.isInteger(value.value) || value.value < 0 || value.value > 100)) throw Error('Invalid room volume.');
  if (['mute','group-mute'].includes(value.action) && typeof value.value !== 'boolean') throw Error('Invalid room mute state.');
  if (value.action === 'group' && (!Array.isArray(value.members) || value.members.length > 32 || value.members.some(id => !validId(id) || id === value.playerId) || new Set(value.members).size !== value.members.length)) throw Error('Choose distinct group members.');
  if(value.action==='join'&&!validId(value.targetId))throw Error('Choose a playing room to join.');
  if (value.action === 'transfer' && (!validId(value.targetId) || typeof value.sourceKey !== 'string' || !/^[a-f0-9]{64}$/.test(value.sourceKey))) throw Error('Choose a valid music source and destination.');
  return value;
}
