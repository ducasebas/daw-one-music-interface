/**
 * Reference presentation timing for a new TuneBox (owner request, 21 November 2026: "once we have a timing
 * correction, use it as the zero line for new TuneBoxes"). Measured on the owner's appliance: Pi 4, Waveshare 7"
 * DSI panel, Louder HAT output, Squeezelite with PCM analysis. A TuneBox's own sync measurement always overrides it;
 * other hardware should measure again. Update this from a fresh, valid sync result (status.json `result.timing`).
 */
export const referenceTiming=Object.freeze({
 timing:Object.freeze({screenDelayMs:40,visualizerTrimMs:-40}),
 source:'owner appliance sync, 20 Nov 2026 10:33 UTC: valid, correlation 0.769, relative lag −5 ms, ±109 ms (3.15.0 analyser)',
});
