/** Presentation only: never feed this value into thermal protection. */
export function smoothTemperature(previous, value, at) {
  if (!Number.isFinite(value) || !Number.isFinite(at)) return null;
  if (!previous || at - previous.at > 15000) return { value, raw: value, at };
  if (at <= previous.at) return previous;
  const dt = (at - previous.at) / 1000,
    rise = value - previous.value;
  const fast =
    rise >= 1 ||
    (value - previous.raw >= 0.3 && (value - previous.raw) / dt >= 0.1);
  const tau = fast ? 2 : 15;
  return {
    value:
      previous.value + (1 - Math.exp(-dt / tau)) * (value - previous.value),
    raw: value,
    at,
  };
}
