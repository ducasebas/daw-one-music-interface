export const defaults = {
  volume: 32,
  brightness: 80,
  artwork: "cover",
  correction: 0,
};
export function settings(input = {}) {
  input = input && typeof input === "object" ? input : {};
  return {
    volume: Number.isFinite(input.volume)
      ? Math.max(0, Math.min(100, input.volume))
      : defaults.volume,
    brightness: Number.isFinite(input.brightness)
      ? Math.max(10, Math.min(100, input.brightness))
      : defaults.brightness,
    artwork: input.artwork === "video" ? "video" : "cover",
    correction: Number.isFinite(input.correction)
      ? Math.max(-600, Math.min(600, input.correction))
      : 0,
  };
}
