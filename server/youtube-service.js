import {mkdirSync, readFileSync, writeFileSync, renameSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {youtubeSettings, youtubeDefaults} from '../shared/youtube.js';

function issue(value) {
  const message = typeof value === 'string' ? value.toLowerCase() : '';
  if (/premium/.test(message)) return 'premium-required';
  if (/po.?token|token server/.test(message)) return 'token-server-unavailable';
  if (/cookie|401|unauthor|login|authenticat/.test(message)) return 'account-expired';
  return message ? 'source-unavailable' : null;
}
function webUrl(address) {
  try {
    const url = new URL(address);
    if (url.username || url.password || url.search || url.hash || !['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) return null;
    url.protocol = ['https:', 'wss:'].includes(url.protocol) ? 'https:' : 'http:';
    url.pathname = url.pathname.replace(/\/ws\/?$/, '').replace(/\/$/, '') + '/';
    return url.href;
  } catch { return null; }
}

/** The Google login cookie stays in Music Assistant. No credentials or OAuth
 * claims are copied into snapshots, logs, browser storage or TuneBox's files. */
export class YoutubeService {
  constructor(music, directory, {now = () => performance.now()} = {}) {
    this.music = music; this.directory = directory; this.path = join(directory, 'youtube.json'); this.now = now;
    this.settings = {...youtubeDefaults}; this.cache = null; this.pending = null;
    try { const raw = readFileSync(this.path, 'utf8'); if (raw.length < 4096) this.settings = youtubeSettings(JSON.parse(raw)); } catch {}
  }
  get() { return {...this.settings}; }
  videoLink(track, link) {
    const options=this.get();
    if(!link.available&&!link.disabled&&options.followCurrent&&options.consent&&Number.isFinite(track?.duration)&&track.duration>0&&/^[\w-]{11}$/.test(track?.youtubeVideoId||'')) {
      // A computed link cannot share its revision with a saved link. Otherwise
      // an old automatic-preview save could overwrite newly stored timing.
      return {...link,available:true,source:'youtube',automatic:true,id:track.youtubeVideoId,videoId:track.youtubeVideoId,revision:'automatic:'+options.revision,sync:{mode:'starts',offsetSeconds:0},consent:true};
    }
    return {...link,...(link.source==='youtube'?{consent:options.consent}:{})};
  }
  save(value) {
    const next = youtubeSettings(value);
    if (next.revision !== this.settings.revision) throw Error('YouTube settings changed. Reload before saving.');
    next.revision++;
    mkdirSync(this.directory, {recursive: true, mode: 0o700});
    writeFileSync(this.path + '.tmp', JSON.stringify(next) + '\n', {mode: 0o600});
    renameSync(this.path + '.tmp', this.path); this.settings = next;
    return this.get();
  }
  reset() { rmSync(this.path, {force: true}); this.settings = {...youtubeDefaults}; }
  async status() {
    const music = this.music;
    const base = {settings: this.get(), connected: music?.status === 'connected', serverVersion: music?.transport?.info?.server_version || null, webUrl: webUrl(music?.config?.url), sources: [], sourceState: 'unavailable', subscription: 'not-verified'};
    if (!base.connected) return base;
    let data;
    if (this.pending) data = await this.pending;
    else if (this.cache && this.now() - this.cache.at < 3000) data = this.cache.data;
    else {
      this.pending = this.inspect().then(data => {this.cache = {at: this.now(), data}; return data;}).finally(() => this.pending = null);
      data = await this.pending;
    }
    const selected = data.sources.find(s => s.id === this.settings.providerId) || (data.sources.length === 1 ? data.sources[0] : null);
    return {...base, ...data, selectedId: selected?.id || null, sourceState: selected?.available ? 'connected' : selected ? 'needs-attention' : data.sources.length ? 'choose-account' : data.configReadable ? 'not-connected' : 'unknown', subscription: selected?.available ? 'accepted-by-music-assistant' : 'not-verified'};
  }
  async inspect() {
    const transport = this.music.transport;
    const [running, configured] = await Promise.allSettled([
      transport.command('providers', {provider_type: 'music'}, {maxItems: 256}),
      transport.command('config/providers', {provider_domain: 'ytmusic'}, {maxItems: 256}),
    ]);
    if (running.status === 'rejected' && configured.status === 'rejected') throw Error('Music Assistant could not read YouTube Music sources. Check the connection and account permissions.');
    const active = running.status === 'fulfilled' && Array.isArray(running.value) ? running.value.filter(v => v.domain === 'ytmusic') : [];
    const saved = configured.status === 'fulfilled' && Array.isArray(configured.value) ? configured.value.filter(v => v.domain === 'ytmusic') : [];
    const ids = [...new Set([...saved, ...active].map(v => v.instance_id).filter(id => typeof id === 'string' && /^[\w.-]{1,150}$/.test(id)))];
    const sources = ids.map(id => {
      const live = active.find(v => v.instance_id === id), config = saved.find(v => v.instance_id === id);
      return {id, name: String(config?.name || live?.name || 'YouTube Music').slice(0, 100), enabled: config?.enabled !== false, available: !!live && live.available === true && config?.enabled !== false, issue: issue(config?.last_error || live?.last_error)};
    });
    return {sources, configReadable: configured.status === 'fulfilled'};
  }
}
