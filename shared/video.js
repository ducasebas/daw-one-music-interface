/** Align ends: videoTime = audioPosition + videoDuration - audioDuration + correction.
 * intro is an explicit user-verified minimum useful video position, never guessed. */
export function endSync({
  audioPosition,
  audioDuration,
  videoDuration,
  correction = 0,
  intro = 0,
  matched = true,
  available = true,
  playing = false,
}) {
  if (
    !matched ||
    !available ||
    ![audioPosition, audioDuration, videoDuration, correction, intro].every(
      Number.isFinite,
    ) ||
    audioDuration <= 0 ||
    videoDuration <= 0
  )
    return { status: "fallback", position: 0, playing: false };
  const offset = videoDuration - audioDuration + correction,
    raw = audioPosition + offset;
  return {
    offset,
    position: Math.max(0, Math.min(videoDuration, raw)),
    status: raw < intro ? "waiting" : raw >= videoDuration ? "ended" : "active",
    playing: playing && raw >= intro && raw < videoDuration,
  };
}

/** Explicit per-video mapping. Legacy end alignment is preserved for old links. */
export function videoTiming(value={}){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['mode','offsetSeconds'].includes(k))||!['starts','ends'].includes(value.mode)||!Number.isFinite(value.offsetSeconds)||Math.abs(value.offsetSeconds)>600)throw Error('Invalid video timing');
 return {mode:value.mode,offsetSeconds:Math.round(value.offsetSeconds*1000)/1000};
}
export function localVideoSync({audioPosition,audioDuration,videoDuration,mode='starts',offsetSeconds=0,screenDelayMs=0,playing=false,available=true}){
 if(!available||!['starts','ends'].includes(mode)||![audioPosition,audioDuration,videoDuration,offsetSeconds,screenDelayMs].every(Number.isFinite)||audioDuration<=0||videoDuration<=0)return {status:'fallback',position:0,playing:false};
 const offset=(mode==='ends'?videoDuration-audioDuration:0)+offsetSeconds;
 const raw=audioPosition-Math.max(0,Math.min(2000,screenDelayMs))/1000+offset;
 return {offset,position:Math.max(0,Math.min(videoDuration,raw)),status:raw<0?'waiting':raw>=videoDuration?'ended':'active',playing:playing&&raw>=0&&raw<videoDuration};
}
/** Follow a clock without repeatedly seeking or changing the music itself. */
export function videoAdjustment({target,current,playing,ready=true,seeking=false,now=0,lastSeek=-Infinity,force=false}){
 if(![target,current,now].every(Number.isFinite)||!ready)return {kind:'wait',rate:1};
 const error=target-current;
 if(seeking)return {kind:'wait',rate:1,error};
 if(force||Math.abs(error)>(playing ? .65 : .035)){
  if(!force&&playing&&now-lastSeek<1000)return {kind:'wait',rate:1,error};
  return {kind:'seek',position:target,rate:1,error};
 }
 return {kind:'rate',rate:playing&&Math.abs(error)>.05?1+Math.max(-.04,Math.min(.04,error*.12)):1,error};
}
