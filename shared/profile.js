/** Presentation constraints only; never grant hardware capability or verification. */
export function deviceProfile(search = "") {
  const light = new URLSearchParams(search).get("profile") === "pi3";
  return {
    id: light ? "pi3" : "standard",
    lowPower: light,
    clockMs: light ? 1000 : 250,
  };
}
export function profileSettings(settings, profile) {
  return profile.lowPower
    ? { ...settings, artwork: "cover", lowPower: true }
    : settings;
}
export function profileTheme(theme, profile) {
  return profile.lowPower
    ? { ...theme, tokens: { ...theme.tokens, glow: 0 } }
    : theme;
}
