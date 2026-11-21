/**
 * Reference presentation timing for a new TuneBox (owner request, 21 November 2026: "once we have a timing
 * correction, use it as the zero line for new TuneBoxes"). Measured on the owner's appliance: Pi 4, Waveshare 7"
 * DSI panel, Louder HAT output, Squeezelite with PCM analysis. A TuneBox's own sync measurement always overrides it;
 * other hardware should measure again. Update this from a fresh, valid sync result (status.json `result.timing`).
 */
export const referenceTiming=Object.freeze({
 // Deferred by the owner (21 Nov 2026): keep zero until a good, precise measurement exists.
 timing:Object.freeze({screenDelayMs:0,visualizerTrimMs:0}),
 source:'pending: no reference yet; fill in from a valid, precise sync result on the owner appliance',
});
