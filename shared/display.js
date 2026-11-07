/** Presentation only: changing display mode never changes hardware or playback. */
export const displaySize = Object.freeze({ width: 1280, height: 400 });
export function displayMode(search = "") {
  const query = new URLSearchParams(search);
  const mode = query.get("display");
  if (mode === "hdmi-development" || mode === "dsi-production") return mode;
  return query.get("screen") === "1" ? "dsi-production" : null;
}
export const panelProfiles = Object.freeze({
  "legacy-wide": { width: 1280, height: 400 },
  "wall-16-10": { width: 1280, height: 800 },
});
export function panelProfile(search = "") {
  return new URLSearchParams(search).get("panel") === "wall-16-10" ? "wall-16-10" : "legacy-wide";
}
export function displayGeometry(mode, width, height, panel = "legacy-wide") {
  const displaySize = panelProfiles[panel] || panelProfiles["legacy-wide"];
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
