import { screenSettings } from "./wall.js";
export const defaults = {
  visualizer: "off",
  visualizerBands: 32,
  volume: 32,
  volumeControl: "linear",
  brightness: 80,
  artwork: "cover",
  correction: 0,
  startupAnimation: 'auto',
};
export function settings(input = {}) {
  input = input && typeof input === "object" ? input : {};
  return {
    startupAnimation: ['off','auto','video','still'].includes(input.startupAnimation)?input.startupAnimation:'auto',
    screen: screenSettings(input.screen),
    visualizer: ["meters","spectrum"].includes(input.visualizer)?input.visualizer:"off",
    visualizerBands: input.visualizerBands===16?16:32,
    volumeControl: input.volumeControl === "circular" ? "circular" : "linear",
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
