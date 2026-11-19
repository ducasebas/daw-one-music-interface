import {trackGenres} from '../shared/automatic-dsp.js';
import { mediaImage } from "../shared/media.js";
import { EventEmitter } from "node:events";
import {createHash} from 'node:crypto';
import {youtubeTrackVideoId} from '../shared/youtube.js';
import { MusicAssistantTransport } from "./ma-transport.js";
import {normalizeRooms,roomLeader,roomOutputs,groupVolume} from '../shared/multiroom.js';
const emptyTrack = {
  id: "none",
  title: "Nothing playing",
  artist: "Music Assistant",
  album: "",
  duration: null,
};
export function seekCapabilities(features, queue, duration) {
  const list = Array.isArray(features) ? features.filter((f) => typeof f === "string") : [];
  if (!list.includes("seek") && queue && typeof queue.queue_id === "string" && duration) list.push("queue_seek");
  return list;
}
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
    youtubeVideoId: youtubeTrackVideoId(item),
    genres: trackGenres(item?.media_item?.metadata?.genres||item?.media_item?.genres||item?.metadata?.genres||item?.genres),
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
    // A player without native seek (e.g. Squeezelite) can still seek through its active
    // Music Assistant queue, which restarts the stream at the chosen position.
    capabilities: seekCapabilities(player.supported_features, activeQueue ? queue : null, track.duration),
    queueId: activeQueue && typeof queue.queue_id === "string" ? queue.queue_id : null,
    // null: this Music Assistant version does not report "Don't stop the music".
    keepPlaying: typeof queue?.dont_stop_the_music_enabled === "boolean" ? queue.dont_stop_the_music_enabled : null,
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
    // Mute for players without native mute: the volume to restore, kept in memory only.
    this.softMute = null;
    // "Keep the music playing": what the owner wants, and the last request per queue (no loops).
    this.keepPlayingWanted = null;
    this.keepPlayingSent = null;
    this.keepPlayingError = null;
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
      keepPlaying: {wanted: this.keepPlayingWanted, active: this.playback.keepPlaying ?? null, error: this.keepPlayingError},
      // The saved server address (validated, without credentials) so setup can show it again
      // when the connection drops. The access token never leaves the server.
      serverUrl: typeof this.config.url === "string" ? this.config.url : null,
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
      // The server answered but this TuneBox's own player is not registered with it.
      const missing=!auth&&error?.message==="Configured player unavailable";
      this.failed(
        auth?.[0] ||
          (missing?"TuneBox player not found in Music Assistant; check that the local player is running":
          "Connection or player sync failed; check server settings and version"),
        auth?.[1] || (missing?"player-missing":"connection"),
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
            }else this.applySoftMute(selected);
          }
        }
        this.syncKeepPlaying();
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
        !["seek", "queue_seek"].some((c) => this.playback.capabilities.includes(c))
      )
        throw Error("Seek unavailable");
      const duration = this.playback.queue[0].duration;
      if (!duration) throw Error("Cannot seek without a duration");
      value = Math.min(duration, event.position);
    }
    if (action === "mute") {
      if (
        typeof event.value !== "boolean" ||
        !["volume_mute", "volume_mute_soft"].some((c) => this.playback.capabilities.includes(c))
      )
        throw Error("Mute unavailable");
      value = event.value;
      if (!this.playback.capabilities.includes("volume_mute")) return this.softMuteControl(value);
    }
    try {
      if (action === "seek" && !this.playback.capabilities.includes("seek"))
        await this.transport.queueSeek(this.playback.queueId, value);
      else await this.transport.control(this.playerId, action, value);
      await this.refresh();
    } catch {
      throw Error("Music Assistant command failed; command was not retried");
    }
  }
  /** Read-only readiness check when someone switches "Keep the music playing" on.
   * Changes nothing: it asks Music Assistant which sources can suggest similar tracks. */
  async checkKeepPlaying() {
    const own = this.config.playerId;
    if (this.status !== "connected") return {ok: false, reason: "disconnected"};
    if (!this.config.controlEnabled) return {ok: false, reason: "read-only"};
    if (!own || this.playerId !== own || this.queueId !== own) return {ok: false, reason: "not-own-queue"};
    if (this.playback.keepPlaying === null || this.playback.keepPlaying === undefined) return {ok: false, reason: "unsupported-version"};
    let providers = null;
    try {
      const list = await this.transport.command("providers", {}, {maxItems: 128});
      if (Array.isArray(list)) providers = list
        .filter((p) => p && p.available !== false && Array.isArray(p.supported_features) && p.supported_features.includes("similar_tracks"))
        .map((p) => String(p.name || p.domain || p.instance_id || "").slice(0, 40)).filter(Boolean);
    } catch {}
    if (providers === null) return {ok: true, reason: "sources-unknown", providers: [], active: this.playback.keepPlaying};
    if (!providers.length) return {ok: false, reason: "no-similar-sources", providers: []};
    return {ok: true, reason: "ready", providers: [...new Set(providers)].slice(0, 8), active: this.playback.keepPlaying};
  }
  /** Set by the server from the saved preference. Applied to TuneBox's own queue only. */
  wantKeepPlaying(enabled) {
    if (typeof enabled !== "boolean" || enabled === this.keepPlayingWanted) return;
    this.keepPlayingWanted = enabled;
    this.keepPlayingSent = null;
    this.keepPlayingError = null;
    this.syncKeepPlaying();
  }
  syncKeepPlaying() {
    const wanted = this.keepPlayingWanted, queueId = this.queueId, own = this.config.playerId;
    if (wanted === null || this.status !== "connected" || !this.config.controlEnabled) return;
    // Only the local TuneBox player's own queue: never a group or another room's queue.
    if (!own || this.playerId !== own || queueId !== own) return;
    const current = this.playback.keepPlaying;
    if (current === null || current === undefined || current === wanted) { if (current === wanted) this.keepPlayingError = null; return; }
    const key = `${queueId}:${wanted}`;
    if (this.keepPlayingSent === key) return;
    this.keepPlayingSent = key;
    Promise.resolve(this.transport.setKeepPlaying?.(queueId, wanted))
      .then(() => { this.keepPlayingError = null; this.dirty = true; return this.refresh?.(); })
      .catch(() => { this.keepPlayingError = "unsupported"; this.notify?.(); });
  }
  /** A player with volume but no native mute (e.g. Squeezelite in Music Assistant) gets a
   * soft mute: volume 0 while muted, then exactly the previous level back. Never louder. */
  applySoftMute(selected) {
    const caps = this.playback.capabilities;
    if (caps.includes("volume_mute") || !caps.includes("volume_set") || !Number.isFinite(this.playback.volume)) {
      this.softMute = null;
      return;
    }
    this.playback.capabilities = [...caps, "volume_mute_soft"];
    // Someone raised the volume elsewhere (or another player is selected): the mute has ended.
    // A short grace period covers Music Assistant still reporting the old level right after muting.
    if (this.softMute && (this.softMute.playerId !== selected || (this.playback.volume > 0 && Date.now() - this.softMute.at > 3000))) this.softMute = null;
    this.playback.muted = !!this.softMute;
  }
  async softMuteControl(muted) {
    const playerId = this.playerId;
    try {
      if (muted) {
        if (this.softMute) return;
        const restore = this.playback.volume;
        if (!Number.isFinite(restore)) throw Error("Volume unknown");
        if (restore > 0) await this.transport.control(playerId, "volume", 0);
        this.softMute = {playerId, restore, at: Date.now()};
      } else {
        const saved = this.softMute;
        this.softMute = null;
        if (saved && saved.playerId === playerId && saved.restore > 0 && this.playback.volume === 0)
          await this.transport.control(playerId, "volume", Math.min(saved.restore, this.config.volumeLimit));
      }
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
