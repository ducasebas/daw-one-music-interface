/**
 * Screen preservation: after the rest view has been showing for a while with nobody touching TuneBox,
 * the backlight turns off completely. Touch (or presence) wakes it. Music is never affected.
 */
export const screenOffChoices = [0, 900, 1800, 3600, 7200, 14400];
/** True when the screen should be fully off now. */
export function screenOffDue({ display, displayAwake, idleMs, playing = false }) {
  const after = display?.offAfterSeconds ?? 0;
  if (!after || displayAwake !== false || !Number.isFinite(idleMs)) return false;
  if (playing && display?.offWhilePlaying === false) return false;
  const rest = display.timeoutSeconds ? display.timeoutSeconds * 1000 : 0;
  return idleMs >= rest + after * 1000;
}
export function screenOffLabel(seconds) {
  if (!seconds) return 'Never';
  return seconds < 3600 ? seconds / 60 + ' minutes' : seconds === 3600 ? '1 hour' : seconds / 3600 + ' hours';
}
