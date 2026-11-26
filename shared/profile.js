/** Presentation constraints only; never grant hardware capability or verification. */
export function deviceProfile(search = "", preferences = {}, model = '') {
  const legacy = new URLSearchParams(search).get("profile") === "pi3";
  const recommended = /Raspberry Pi [234]|Compute Module [34]/i.test(model) ? 'smooth' : 'full';
  const selected = ['smooth','full'].includes(preferences.graphicsMode)?preferences.graphicsMode:recommended;
  const light = legacy || selected === 'smooth';
  return {
    id: legacy ? 'pi3' : light ? 'smooth' : 'standard',
    recommended,
    lowPower: light,
    clockMs: light ? 1000 : 250,
  };
}
export function profileSettings(settings, profile) {
  return profile.lowPower
    ? { ...settings, artwork: "cover", lowPower: true, presentationProfile: profile.id }
    : settings;
}
export function profileTheme(theme, profile) {
  return profile.lowPower
    ? { ...theme, tokens: { ...theme.tokens, glow: 0 } }
    : theme;
}
