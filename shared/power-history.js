/**
 * Remembers the highest USB-C PD contract this TuneBox has actually read from the HUSB238, so a later,
 * lower contract can be explained instead of silently accepted. Read-only: it never requests power.
 */
export const powerDropWatts = 10;
export const powerDropHoldMs = 60000;
const active = power => power?.pd?.status === 'active' && Number.isFinite(power.pd.watts) && Number.isFinite(power.observedAt);
export function nextPowerHistory(history = {}, power, now = Date.now()) {
  const h = {highestWatts: null, highestVolts: null, highestAmps: null, highestAt: null, lowerSince: null, ...(history && typeof history === 'object' ? history : {})};
  if (!active(power) || now - power.observedAt > 30000) return {...h, lowerSince: null};
  const {watts, volts, amps} = power.pd;
  if (!Number.isFinite(h.highestWatts) || watts > h.highestWatts) return {...h, highestWatts: watts, highestVolts: volts, highestAmps: amps, highestAt: new Date(now).toISOString(), lowerSince: null};
  if (watts <= h.highestWatts - powerDropWatts) return {...h, lowerSince: h.lowerSince ?? now};
  return {...h, lowerSince: null};
}
/** A lower contract that has lasted a minute, with the most likely reason. Null when power is as before. */
export function powerDrop(history, power, now = Date.now()) {
  if (!active(power) || !Number.isFinite(history?.lowerSince) || now - history.lowerSince < powerDropHoldMs) return null;
  const profiles = Array.isArray(power.pd.profiles) ? power.pd.profiles : [];
  const capped3A = profiles.length > 0 && profiles.every(p => p.amps <= 3);
  return {nowWatts: power.pd.watts, bestWatts: history.highestWatts, bestAt: history.highestAt, capped3A};
}
