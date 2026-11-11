/** Display policy only. It cannot change playback or amplifier permissions. */
export const displayDefaults = Object.freeze({ timeoutSeconds: 120, brightnessMode: 'manual', brightness: 80, minimum: 12, maximum: 100 });
export const timeoutChoices = [0, 30, 60, 120, 300, 600, 900, 1800];
export function displaySettings(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Invalid display settings');
  if (Object.keys(input).some(k => !Object.hasOwn(displayDefaults, k))) throw Error('Unknown display setting');
  const s = { ...displayDefaults, ...input };
  if (!timeoutChoices.includes(s.timeoutSeconds) || !['manual','auto'].includes(s.brightnessMode) || ![s.brightness,s.minimum,s.maximum].every(n => Number.isFinite(n) && n >= 5 && n <= 100) || s.minimum > s.maximum) throw Error('Invalid display settings');
  return { ...s, brightness: Math.round(s.brightness), minimum: Math.round(s.minimum), maximum: Math.round(s.maximum) };
}
export function luxBrightness(lux, settings) {
  if (!Number.isFinite(lux) || lux < 0) return null;
  const s = displaySettings(settings);
  const fraction = Math.max(0, Math.min(1, Math.log10(1 + lux) / Math.log10(1001)));
  return Math.round(s.minimum + fraction * (s.maximum - s.minimum));
}
