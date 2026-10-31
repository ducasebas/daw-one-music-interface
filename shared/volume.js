export const clampVolume = (value, limit = 100) =>
  Math.max(0, Math.min(limit, Math.round(value)));
export function linearVolume(x, left, width, limit = 100) {
  return clampVolume(((x - left) / Math.max(1, width)) * limit, limit);
}
export function knobAngle(x, y, rect) {
  return (
    (Math.atan2(
      x - (rect.left + rect.width / 2),
      rect.top + rect.height / 2 - y,
    ) *
      180) /
    Math.PI
  );
}
export function knobVolume(angle, limit = 100) {
  return Math.abs(angle) > 135
    ? null
    : clampVolume(((angle + 135) / 270) * limit, limit);
}
export function rotateVolume(value, previous, angle, limit = 100) {
  const delta = ((angle - previous + 540) % 360) - 180;
  return Math.max(0, Math.min(limit, value + (delta / 270) * limit));
}
