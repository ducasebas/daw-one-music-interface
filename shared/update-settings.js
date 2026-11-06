export const updateDefaults = Object.freeze({ mode: 'notify', windowEnabled: false, start: '02:00', end: '05:00', timeZone: 'Europe/Amsterdam' });
export function updateSettings(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Invalid update settings');
  if (Object.keys(input).some(k => !Object.hasOwn(updateDefaults,k))) throw Error('Unknown update setting');
  const value = {...updateDefaults,...input};
  if (!['auto','notify','paused'].includes(value.mode) || typeof value.windowEnabled !== 'boolean' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.end) || typeof value.timeZone !== 'string' || value.timeZone.length>80) throw Error('Invalid update policy');
  try {new Intl.DateTimeFormat('en',{timeZone:value.timeZone}).format();} catch {throw Error('Invalid update timezone');}
  return value;
}
export function insideWindow(policy, now = new Date()) {
  if (!policy.windowEnabled) return true;
  const parts = new Intl.DateTimeFormat('en-GB',{timeZone:policy.timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
  const minute = parts.find(p=>p.type==='hour').value+':'+parts.find(p=>p.type==='minute').value;
  return policy.start===policy.end || (policy.start<policy.end ? minute>=policy.start && minute<policy.end : minute>=policy.start || minute<policy.end);
}
export function installationDecision(policy, request, idle, now = new Date()) {
  if (request==='check') return 'available';
  if (request!=='install' && policy.mode!=='auto') return policy.mode==='paused'?'paused':'available';
  if (!idle) return 'waiting-idle';
  if (request!=='install' && !insideWindow(policy,now)) return 'waiting-window';
  return 'install';
}
export const updatePhases = ['downloading','verifying','preparing','installing','restarting','checking-health','rolling-back'];
export function progressValue(value) {return typeof value==='number' && Number.isFinite(value)?Math.max(0,Math.min(100,Math.floor(value))):null;}
