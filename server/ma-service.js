import { mediaImage } from "../shared/media.js";
import { EventEmitter } from "node:events";
import {createHash} from 'node:crypto';
import { MusicAssistantTransport } from "./ma-transport.js";
import {normalizeRooms,roomLeader,roomOutputs,groupVolume} from '../shared/multiroom.js';
const emptyTrack = {
  id: "none",
  title: "Nothing playing",
  artist: "Music Assistant",
  album: "",
  duration: null,
};
export function normalizeMusic(
  { player, queue, items = [] },
  now = Date.now(),
) {
  const activeQueue = queue && queue.active !== false;
  const media = activeQueue
    ? queue.current_item || player.current_media
    : player.current_media;
  const convert = (item) => ({
    id: String(item?.queue_item_id || item?.uri || "current"),
    mediaKey: createHash('sha256').update(item?.media_item?.uri || item?.uri || JSON.stringify([item?.media_item?.name||item?.title||item?.name,item?.media_item?.artists||item?.artist,item?.media_item?.album?.name||item?.album,item?.duration])).digest('hex'),
    title:
      item?.media_item?.name || item?.title || item?.name || "Unknown title",
    artist:
      item?.media_item?.artists?.map((a) => a.name).join(", ") ||
      item?.artist ||
      "",
    album: item?.media_item?.album?.name || item?.album || "",
    artwork:
      mediaImage(item?.media_item || item) || mediaImage(item)
        ? `/api/artwork/${mediaImage(item?.media_item || item) || mediaImage(item)}`
        : null,
    duration:
      Number.isFinite(item?.duration) && item.duration > 0
        ? item.duration
        : null,
  });
  const track = media ? convert(media) : emptyTrack;
  const format=media?.streamdetails?.audio_format;
  const sourceFormat=format?{codec:typeof format.content_type==='string'?format.content_type.slice(0,40):null,sampleRate:Number.isFinite(format.sample_rate)?format.sample_rate:null,bitDepth:Number.isFinite(format.bit_depth)?format.bit_depth:null}:null;
  let list = activeQueue ? items.map(convert) : [];
  if (!list.length || list[0].id !== track.id)
    list = [track, ...list.filter((t) => t.id !== track.id)];
  const stamp = activeQueue
    ? queue.elapsed_time_last_updated
    : player.elapsed_time_last_updated;
  const position = activeQueue ? queue.elapsed_time : player.elapsed_time;
  const volume = Number.isFinite(player.volume_level)
    ? Math.max(0, Math.min(100, player.volume_level))
    : null;
  return {
    connected: player.available !== false,
    playing:
      (player.playback_state || player.state || queue?.state) === "playing",
    position: Number.isFinite(position) ? Math.max(0, position) : 0,
    observedAt: Number.isFinite(stamp) ? Math.min(now, stamp * 1000) : now,
    index: 0,
    queue: list,
    volume,
    muted: player.volume_muted === true,
    playerName: player.name || player.player_id,
    playerId: player.player_id,
    capabilities: player.supported_features || [],
    source: "music-assistant",
    sourceFormat,
  };
}
export class LiveMusicService extends EventEmitter {
  constructor(
    config,
    { transport = new MusicAssistantTransport(config), retryMs = 1000 } = {},
  ) {
    super();
    this.config = {...config};
    this.defaultVolumeLimit = config.volumeLimit;
    this.transport = transport;
    this.retryMs = retryMs;
    this.retryCount = 0;
    this.stopped = true;
    this.refreshing = false;
    this.refreshPromise = null;
    this.dirty = false;
    this.timer = null;
    this.retryTimer = null;
    this.pollTimer = null;
    this.queueIds = [];
    this.queueActive = false;
    this.players = [];
    this.playerId = config.playerId;
    this.status = "disconnected";
    this.error = null;
    this.errorCode = null;
    this.playback = {
      connected: false,
      playing: false,
      position: 0,
      observedAt: Date.now(),
      index: 0,
      queue: [emptyTrack],
      volume: null,
      muted: false,
      capabilities: [],
      source: "music-assistant",
    };
    this.unsubscribe = transport.subscribe((e) => {
      if (e.event === "disconnected") this.failed("Connection lost");
      else if (
        e.event?.startsWith("player") || e.event?.startsWith("queue")
      )
        this.scheduleRefresh();
    });
  }
  publicStatus() {
    return {
      mode: "music-assistant",
      connected: this.status === "connected",
      status: this.status,
      error: this.error,
      errorCode: this.errorCode,
      serverVersion: this.transport.info?.server_version || null,
      schemaVersion: this.transport.info?.schema_version ?? null,
      playerId: this.playerId,
      controlEnabled: this.config.controlEnabled,
      volumeLimit: this.config.volumeLimit,
      defaultVolumeLimit: this.defaultVolumeLimit,
      players: normalizeRooms(this.players,this.config.playerId).map((p) => ({
        id: p.id,
        name: p.name,
        available: p.available,
      })),
    };
  }
  notify() {
    this.emit("change");
  }
  setVolumeLimit(value) {
    if(!Number.isInteger(value)||value<0||value>100)throw Error('Invalid volume limit');
    this.config.volumeLimit=value;
  }
  async start() {
    this.stopped = false;
    clearInterval(this.pollTimer);
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.status = "connecting";
    this.notify();
    try {
      await this.transport.connect();
      if (this.stopped) return;
      await this.refresh();
      if (this.stopped) return;
      this.retryCount = 0;
      this.status = "connected";
      this.error = null;
      this.errorCode = null;
      this.pollTimer = setInterval(() => this.scheduleRefresh(),5000);
      this.pollTimer.unref?.();
      this.notify();
    } catch (error) {
      const auth = {
        20: [
          "Authentication required; configure server-side MA token",
          "auth-required",
        ],
        21: ["Authentication failed; check token", "auth-failed"],
        22: ["Insufficient MA permissions", "permissions"],
      }[error?.code];
      this.failed(
        auth?.[0] ||
          "Connection or player sync failed; check server settings and version",
        auth?.[1] || "connection",
      );
    }
  }
  failed(reason, code = "connection") {
    if (this.stopped) return;
    this.status = "disconnected";
    clearInterval(this.pollTimer);
    this.error = reason;
    this.errorCode = code;
    this.playback = {
      ...this.playback,
      connected: false,
      playing: false,
      observedAt: Date.now(),
    };
    this.transport.close();
    this.notify();
    if (!this.retryTimer) {
      const delay = Math.min(
        30000,
        this.retryMs * 2 ** Math.min(this.retryCount++, 5),
      );
      this.retryTimer = setTimeout(() => this.start(), delay);
      this.retryTimer.unref?.();
    }
  }
  scheduleRefresh() {
    if (this.stopped || this.status === "disconnected") return;
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.refresh().catch(() => this.failed("State refresh failed"));
    }, 150);
  }
  async refresh() {
    if (this.refreshing) {
      this.dirty = true;
      return this.refreshPromise;
    }
    this.refreshing = true;
    this.refreshPromise = (async () => {
     try {
      do {
        this.dirty = false;
        const players = await this.transport.command("players/all", {}, {maxItems:256});
        if (!Array.isArray(players)) throw Error("Invalid player list");
        this.players = players;
        if (this.playerId) {
          if (!players.some((p) => p.player_id === this.playerId))
            throw Error("Configured player unavailable");
          const selected = this.playerId;
          const data = await this.transport.snapshot(selected);
          if (selected === this.playerId) {
            this.queueId = data.queue?.queue_id;
            this.queueActive = !!data.queue && data.queue.active !== false;
            this.queueIds = Array.isArray(data.queueIds) ? data.queueIds : data.queue ? [data.queue.queue_id] : [];
            this.playback = normalizeMusic(data);
            const rooms=normalizeRooms(players,this.config.playerId),selectedRoom=rooms.find(p=>p.id===selected);
            if(selectedRoom?.type==='group'){
              const outputs=roomOutputs(rooms,selected),volume=groupVolume(rooms,selected);
              this.playback.volume=volume;
              this.playback.muted=outputs.length>0&&outputs.every(p=>p.muted===true);
              const capabilities=new Set(this.playback.capabilities);
              if(volume!==null)capabilities.add('volume_set');else capabilities.delete('volume_set');
              if(outputs.length&&outputs.every(p=>p.available&&p.canMute))capabilities.add('volume_mute');else capabilities.delete('volume_mute');
              this.playback.capabilities=[...capabilities];
            }
          }
        }
        this.notify();
      } while (this.dirty && !this.stopped);
     } finally {
      this.refreshing = false;
      this.refreshPromise = null;
     }
    })();
    return this.refreshPromise;
  }
  async selectPlayer(id,{fromRooms=false}={}) {
    if((this.roomCommandBusy||this.controlBusy)&&!fromRooms)throw Error('Wait for the room change to finish.');
    if (!normalizeRooms(this.players,this.config.playerId).some((p) => p.id === id && p.available))
      throw Error("Choose an available player");
    this.playerId = id;
    this.playback = { ...this.playback, connected: false, playing: false };
    await this.refresh();
    this.notify();
  }
  async control(event) {
    if(this.roomCommandBusy)throw Error('Wait for the room change to finish.');
    if (
      this.status !== "connected" ||
      !this.playback.connected ||
      !this.playerId
    )
      throw Error("Music Assistant player unavailable");
    if (!this.config.controlEnabled)
      throw Error(
        "Music Assistant is read-only; set MA_ALLOW_CONTROL=true on server",
      );
    if(event.type==='play'||event.type==='queue-select'||event.type==='mute'&&event.value===false){
      const rooms=normalizeRooms(this.players,this.config.playerId),owner=roomLeader(rooms,this.playerId);
      if(owner&&(owner.members.length||owner.type==='group')){
        const outputs=roomOutputs(rooms,owner.id);
        if(!outputs.length||outputs.some(p=>!p.available||!Number.isFinite(p.volume)||p.volume>this.config.volumeLimit))throw Error('Lower every affected room to the saved volume limit before starting or grouping music.');
      }
    }
    if(['queue-select','queue-remove'].includes(event.type)) {
      if(typeof event.id!=='string'||event.id==='none'||!this.playback.queue.some(t=>t.id===event.id))throw Error('Queue selection expired. Refresh the queue.');
      if(!this.queueId)throw Error('The selected player has no Music Assistant queue.');
      const player=this.players.find(p=>p.player_id===this.playerId);
      const parent=player?.active_group||player?.synced_to;
      if(parent&&parent!==this.playerId&&this.queueId!==parent)throw Error('Select the group leader to edit this queue.');
      if(event.type==='queue-select'&&(!Number.isFinite(this.playback.volume)||this.playback.volume>this.config.volumeLimit))throw Error('Lower the player volume to the saved limit first.');
      if(event.type==='queue-remove'&&event.id===this.playback.queue[this.playback.index]?.id)throw Error('Skip the current track before removing it.');
      await this.transport.command(event.type==='queue-select'?'player_queues/play_index':'player_queues/delete_item',{
        queue_id:this.queueId,...(event.type==='queue-select'?{index:event.id}:{item_id_or_index:event.id}),
      });
      await this.refresh();
      return;
    }
    const map = {
      play: "play",
      pause: "pause",
      next: "next",
      previous: "previous",
      seek: "seek",
      volume: "volume",
      mute: "mute",
    };
    const action = map[event.type];
    if (
      (action === "play" || (action === "mute" && event.value === false)) &&
      Number.isFinite(this.playback.volume) &&
      this.playback.volume > this.config.volumeLimit
    )
      throw Error(
        "Lower selected player volume to the configured ceiling first",
      );
    if (!action)
      throw Error("Simulation controls are disabled in live music mode");
    let value;
    if (action === "volume") {
      if (!Number.isFinite(event.value)) throw Error("Invalid volume");
      if (!this.playback.capabilities.includes("volume_set"))
        throw Error("Player has no volume control");
      value = Math.max(
        0,
        Math.min(this.config.volumeLimit, Math.round(event.value)),
      );
    }
    if (action === "seek") {
      if (
        !Number.isFinite(event.position) ||
        event.position < 0 ||
        !this.playback.capabilities.includes("seek")
      )
        throw Error("Seek unavailable");
      const duration = this.playback.queue[0].duration;
      if (!duration) throw Error("Cannot seek without a duration");
      value = Math.min(duration, event.position);
    }
    if (action === "mute") {
      if (
        typeof event.value !== "boolean" ||
        !this.playback.capabilities.includes("volume_mute")
      )
        throw Error("Mute unavailable");
      value = event.value;
    }
    try {
      await this.transport.control(this.playerId, action, value);
      await this.refresh();
    } catch {
      throw Error("Music Assistant command failed; command was not retried");
    }
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    clearTimeout(this.retryTimer);
    clearInterval(this.pollTimer);
    this.unsubscribe();
    this.transport.close();
  }
}
