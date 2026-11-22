import {powerIsFresh} from './power-status.js';
/** Now Playing presentation for GUI 3.11 LIVELY: the artwork backdrop and the widget tiles.
 * Every value comes from a real reading; anything unknown says so instead of guessing. */
export const widgetCatalog = ['clock','upnext','source','rooms','temperature','wifi','power','party'];
export const widgetLimit = 4;
export const widgetDefaults = ['clock','upnext','source'];
export function widgetSelection(value) {
  if (!Array.isArray(value)) return [...widgetDefaults];
  const seen = new Set();
  return value.filter((id) => widgetCatalog.includes(id) && !seen.has(id) && seen.add(id)).slice(0, widgetLimit);
}
export const backdropModes = ['art','off'];

/** What the backdrop shows: the current artwork, a static fallback, or nothing. */
export function backdropSource({snapshot, prefs = {}, offline = false}) {
  if (prefs.backdrop === 'off') return {mode: 'off', src: null};
  const p = snapshot?.playback || {}, track = Array.isArray(p.queue) ? p.queue[p.index || 0] : null;
  const src = !offline && typeof track?.artwork === 'string' && /^\/api\/artwork\/[a-f0-9]{64}$/.test(track.artwork) ? track.artwork : null;
  // Pi 3 / low-power: a static tint without the artwork layer (no blur, no crossfade).
  return {mode: prefs.lowPower ? 'static' : 'live', src, key: src || `none-${track?.id || 'none'}`};
}

const pad = (n) => String(n).padStart(2, '0');
const khz = (hz) => (hz / 1000).toFixed(hz % 1000 ? 1 : 0).replace(/\.0$/, '');
export function sourceQuality(format) {
  if (!format) return null;
  const parts = [];
  if (format.codec) parts.push(String(format.codec).toUpperCase());
  if (Number.isFinite(format.sampleRate)) parts.push(`${khz(format.sampleRate)} kHz`);
  if (Number.isFinite(format.bitDepth)) parts.push(`${format.bitDepth}-bit`);
  return parts.length ? parts.join(' · ') : null;
}
const unavailable = (base, detail) => ({...base, available: false, value: 'Not available', detail});

/** One tile. `context` carries readings that are fetched elsewhere (network) and the clock. */
/** How long the widget keeps showing the last good power reading when a new one is late (the sensor refreshes slowly). */
export const powerHoldMs = 600000;
export function nowPlayingWidget(id, snapshot = {}, {now = Date.now(), powerNow = now, lastPower = null, offline = false, network = null, hour12 = false} = {}) {
  const p = snapshot.playback || {}, simulated = snapshot.mode === 'simulation';
  switch (id) {
    case 'clock': {
      const d = new Date(now), h = d.getHours();
      const value = hour12 ? `${h % 12 || 12}:${pad(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}` : `${pad(h)}:${pad(d.getMinutes())}`;
      return {id, icon: 'clock', label: 'Clock', action: 'date', available: true, value, detail: d.toISOString().slice(0, 10)};
    }
    case 'upnext': {
      const base = {id, icon: 'queue', label: 'Up next', action: 'queue'};
      if (offline) return unavailable(base, 'Offline');
      if (snapshot.bluetooth?.active) return unavailable(base, 'Bluetooth has no queue');
      const next = Array.isArray(p.queue) ? p.queue[(p.index || 0) + 1] : null;
      return next ? {...base, available: true, value: next.title || 'Unknown title', detail: next.artist || ''} : {...base, available: true, value: 'End of queue', detail: ''};
    }
    case 'source': {
      const base = {id, icon: 'speaker', label: 'Source & quality', action: 'audio'};
      if (offline) return unavailable(base, 'Offline');
      if (snapshot.bluetooth?.active) return {...base, available: true, value: 'Bluetooth', detail: 'Codec not reported'};
      if (simulated) return {...base, available: true, value: 'Simulation', detail: 'No audio'};
      const quality = sourceQuality(p.sourceFormat);
      return quality ? {...base, available: true, value: quality, detail: p.playerName || 'Music Assistant'} : unavailable(base, 'Not reported by the player');
    }
    case 'rooms': {
      const base = {id, icon: 'rooms', label: 'Rooms', action: 'rooms'};
      if (offline || simulated) return unavailable(base, simulated ? 'Simulation' : 'Offline');
      const ma = snapshot.musicAssistant || {};
      if (!ma.connected) return unavailable(base, 'Music Assistant not connected');
      const rooms = (ma.players || []).filter((r) => r.available).length;
      return {...base, available: true, value: rooms === 1 ? '{count} room' : '{count} rooms', params: {count: rooms}, detail: p.playerName || ''};
    }
    case 'temperature': {
      const base = {id, icon: 'temperature', label: 'Temperature', action: 'sensors'};
      if (offline) return unavailable(base, 'Offline');
      const t = snapshot.hardwareTelemetry?.temperature, cpu = snapshot.hostTelemetry?.cpu?.temperatureC;
      if (t?.status === 'ok' && Number.isFinite(t.value)) return {...base, available: true, value: `${t.value.toFixed(1)} °C`, detail: 'Case'};
      if (Number.isFinite(cpu)) return {...base, available: true, value: `${cpu.toFixed(1)} °C`, detail: 'Processor'};
      return unavailable(base, 'No sensor reading');
    }
    case 'wifi': {
      const base = {id, icon: 'wifi', label: 'Wi-Fi', action: 'connections'};
      if (offline) return unavailable(base, 'Offline');
      if (network?.simulated) return {...base, available: true, value: 'Simulation', detail: ''};
      if (network?.connected === false) return unavailable(base, 'Not connected');
      return Number.isFinite(network?.signal) ? {...base, available: true, value: `${Math.round(network.signal)}%`, detail: network.ssid || ''} : unavailable(base, 'No signal reading');
    }
    case 'power': {
      const base = {id, icon: 'hardware', label: 'Power', action: 'sensors'};
      // Use the current reading, or the last good one for up to ten minutes (with its age); a slow refresh must not blank the tile.
      const current = snapshot.hostTelemetry?.power;
      const held = lastPower && Number.isFinite(lastPower.observedAt) && powerNow - lastPower.observedAt < powerHoldMs && lastPower.observedAt <= powerNow + 1000 ? lastPower : null;
      const power = powerIsFresh(current, powerNow) ? current : held;
      if (offline || !power) return unavailable(base, 'No current power reading');
      const contract = Number.isFinite(power.contractWatts) ? '{watts} W contract' : null;
      // Consumption only when the INA228 reading is confirmed and consistent (power.watts is null otherwise).
      const used = Number.isFinite(power.watts) ? '{used} W in use' : null;
      if (!contract && !used) return unavailable(base, 'PD contract unavailable');
      const age = power === current ? 0 : Math.max(0, Math.round((powerNow - power.observedAt) / 60000));
      if (age >= 1) return {...base, available: true, value: used || contract, detail: 'Last reading {age} min ago', params: {age, watts: Number.isFinite(power.contractWatts) ? Math.round(power.contractWatts) : null, used: Number.isFinite(power.watts) ? power.watts.toFixed(1) : null}};
      return {...base, available: true, value: used || contract, detail: used && contract ? contract : used ? '' : 'Consumption needs verified wiring', params: {watts: Number.isFinite(power.contractWatts) ? Math.round(power.contractWatts) : null, used: Number.isFinite(power.watts) ? power.watts.toFixed(1) : null}};
    }
    case 'party': {
      const base = {id, icon: 'phone', label: 'Party mode', action: 'remote'};
      const phones = Number.isInteger(snapshot.remoteControl?.phones) ? snapshot.remoteControl.phones : null;
      if (phones === null) return unavailable(base, 'Phone remote unavailable');
      return {...base, available: true, value: phones === 1 ? '{count} phone' : '{count} phones', params: {count: phones}, detail: snapshot.remoteControl?.pairing ? 'Code on screen' : 'Tap to pair a phone'};
    }
    default:
      return null;
  }
}
export function nowPlayingWidgets(ids, snapshot, context) {
  return widgetSelection(ids).map((id) => nowPlayingWidget(id, snapshot, context)).filter(Boolean);
}
/** Final text of a tile field, with its numbers filled in. */
export function widgetText(text, params = {}, translate = (v) => v) {
  return String(translate(text ?? '')).replace(/\{([a-z]+)\}/g, (all, k) => (params[k] ?? all));
}
