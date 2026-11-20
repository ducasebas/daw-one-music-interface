/** What an owner can expect from an update, from the device's own data only. */
export const updateExpectations=Object.freeze([
 'Music on this TuneBox pauses and stays paused afterwards. Other rooms keep playing.',
 'The Pi does not reboot. While the app restarts, the screen switches to the update page and can go dark or flicker for a few seconds; a little longer when the display layer is updated.',
 'Your settings and Music Assistant configuration are kept.',
 'If the new version does not start correctly, TuneBox automatically returns to the previous version.',
]);
const activePhases=['downloading','verifying','preparing','installing','restarting','checking-health','rolling-back'];
/** Elapsed time and an estimate from this device's previous installs (median of the last five). */
export function updateTiming(info,now=Date.now()){
 const started=Date.parse(info?.startedAt),typical=Number.isInteger(info?.typicalSeconds)&&info.typicalSeconds>0?info.typicalSeconds:null;
 const elapsed=Number.isFinite(started)&&activePhases.includes(info?.status)?Math.max(0,Math.round((now-started)/1000)):null;
 return {elapsedSeconds:elapsed,typicalSeconds:typical,remainingSeconds:typical&&elapsed!==null?Math.max(0,typical-elapsed):null};
}
export const formatDuration=seconds=>{if(!Number.isFinite(seconds))return '';const m=Math.floor(seconds/60),s=Math.round(seconds%60);return m?`${m}:${String(s).padStart(2,'0')} min`:`${s} s`;};
/** Release notes as short list items: "Label — sentence. Sentence." → sentences. */
export function changelogItems(notes){
 const text=String(notes||'').includes(' — ')?String(notes).split(' — ').slice(1).join(' — '):String(notes||'');
 return text.split(/(?<=[.!?])\s+(?=[A-Z“"‘'(])/).map(s=>s.trim()).filter(Boolean).slice(0,12);
}
