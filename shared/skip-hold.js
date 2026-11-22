/**
 * Calm track changes while skipping (owner, 21 Nov 2026): keep showing the track that was playing, with a loading
 * state, until Music Assistant reports a different track. A brief report of the old track after the new one has
 * appeared (stale state) is ignored for a short settle time. Pure, so it can be tested without a browser.
 */
export const skipHoldMs=8000,settleMs=2500;
export const trackKey=t=>t?[t.id??'',t.title??'',t.artist??'',t.album??''].join('\u0001'):'';
/** Start a hold when the user taps next/previous. */
export function startSkipHold(track,now){return track?{phase:'holding',from:track,fromKey:trackKey(track),shown:track,startedAt:now}:null;}
/** Given the live track, return the next hold state, the track to display and whether to show loading. */
export function observeSkip(hold,live,now){
 if(!hold)return {hold:null,display:live,loading:false};
 const key=trackKey(live);
 if(hold.phase==='holding'){
  if(live&&key!==hold.fromKey)return {hold:{...hold,phase:'settling',shown:live,shownKey:key,settledAt:now},display:live,loading:false};
  if(now-hold.startedAt>skipHoldMs)return {hold:null,display:live,loading:false};
  return {hold,display:hold.from,loading:true};
 }
 // Settling: a stale report of the old track does not bring it back; any other new track is accepted.
 if(now-hold.settledAt>settleMs)return {hold:null,display:live,loading:false};
 if(!live||key===hold.fromKey)return {hold,display:hold.shown,loading:false};
 return {hold:{...hold,shown:live,shownKey:key},display:live,loading:false};
}
