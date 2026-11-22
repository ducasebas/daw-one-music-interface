import {presentationTiming} from './presentation-timing.js';
import {referenceTiming} from './timing-reference.js';
import { screenSettings } from "./wall.js";
import {widgetSelection,widgetDefaults} from "./now-playing.js";
import {soundSettings,soundDefaults} from "./dsp-settings.js";
export const defaults = {
  // New TuneBoxes start from the measured reference, not from zero; a device's own measurement overrides it.
  timing: presentationTiming(referenceTiming.timing),
  syncAutomatic: false,
  seekEnabled: true,
  visualizer: "off",
  visualizerBands: 32,
  volume: 32,
  volumeControl: "linear",
  volumeLimitConfigured: false,
  brightness: 80,
  artwork: "cover",
  correction: 0,
  startupAnimation: 'auto',
  backdrop: 'art',
  widgets: [...widgetDefaults],
  font: 'inter',
  keepPlaying: true,
  sound: {...soundDefaults},
};
export function settings(input = {}) {
  input = input && typeof input === "object" ? input : {};
  return {
    timing: presentationTiming(input.timing===undefined?referenceTiming.timing:input.timing),
    syncAutomatic: input.syncAutomatic===true,
    seekEnabled: typeof input.seekEnabled==='boolean'?input.seekEnabled:true,
    volumeLimitConfigured: input.volumeLimitConfigured===true,
    startupAnimation: ['off','auto','video','still'].includes(input.startupAnimation)?input.startupAnimation:'auto',
    screen: screenSettings(input.screen),
    backdrop: input.backdrop === 'off' ? 'off' : 'art',
    font: ['inter','manrope-heavy','skin'].includes(input.font) ? input.font : 'inter',
    keepPlaying: input.keepPlaying !== false,
    sound: soundSettings(input.sound),
    widgets: widgetSelection(input.widgets),
    widgetPlacement: input.widgetPlacement === 'top' ? 'top' : 'bottom',
    headerAutoHide: input.headerAutoHide !== false,
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
