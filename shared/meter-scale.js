/** Analogue meter scales. The needle and the printed marks use the same mapping, so a
 * label always sits where the needle points for that level. */
const scales = {
  // Peak dBFS meter: −60 … 0 dBFS, linear in dB. Above −6 dBFS is the red zone.
  meters: {
    min: -60,
    max: 0,
    hot: -6,
    unit: "dBFS",
    marks: [-60, -50, -40, -30, -20, -15, -10, -6, -3, 0],
    labels: [-60, -40, -20, -10, 0],
    curve: "db",
  },
  // Classic VU: −20 … +3 VU relative to the reference level. Above 0 VU is the red zone.
  vu: {
    min: -20,
    max: 3,
    hot: 0,
    unit: "VU",
    marks: [-20, -10, -7, -5, -3, -2, -1, 0, 1, 2, 3],
    labels: [-20, -10, -7, -5, -3, 0, 3],
    // Like a real VU movement the deflection follows voltage, so the top of the scale is spread out.
    curve: "voltage",
  },
};
export const meterSweep = 120; // degrees, from −60° to +60°

export function meterScale(mode) {
  return scales[mode === "vu" ? "vu" : "meters"];
}
/** 0 … 1 along the scale for a value in that scale's unit. */
export function meterFraction(value, mode) {
  const s = meterScale(mode);
  if (!Number.isFinite(value)) return 0;
  const v = Math.max(s.min, Math.min(s.max, value));
  if (s.curve === "voltage") {
    const volts = (db) => 10 ** (db / 20);
    return (volts(v) - volts(s.min)) / (volts(s.max) - volts(s.min));
  }
  return (v - s.min) / (s.max - s.min);
}
export function meterAngle(value, mode) {
  return -meterSweep / 2 + meterFraction(value, mode) * meterSweep;
}
const sign = (v) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : "0");
/** Printable marks: angle, whether it is labelled, and whether it is in the red zone. */
export function meterMarks(mode) {
  const s = meterScale(mode);
  return s.marks.map((value) => ({
    value,
    angle: meterAngle(value, mode),
    label: s.labels.includes(value) ? sign(value) : null,
    hot: value > s.hot || (value === s.max && s.hot < s.max),
  }));
}
/** A point on a circle around the needle pivot, for an angle measured from straight up. */
export function polar(cx, cy, radius, angle) {
  const a = (angle * Math.PI) / 180;
  return [cx + radius * Math.sin(a), cy - radius * Math.cos(a)];
}
