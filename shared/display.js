/** Presentation only: changing display mode never changes hardware or playback. */
export const displaySize = Object.freeze({ width: 1280, height: 400 });
export function displayMode(search = "") {
  const query = new URLSearchParams(search);
  const mode = query.get("display");
  if (mode === "hdmi-development" || mode === "dsi-production") return mode;
  return query.get("screen") === "1" ? "dsi-production" : null;
}
export function displayGeometry(mode, width, height) {
  const scale =
    mode === "hdmi-development"
      ? Math.max(
          0,
          Math.min(1, width / displaySize.width, height / displaySize.height),
        )
      : 1;
  return {
    ...displaySize,
    scale,
    renderedWidth: displaySize.width * scale,
    renderedHeight: displaySize.height * scale,
  };
}
