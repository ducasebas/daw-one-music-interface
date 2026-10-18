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
