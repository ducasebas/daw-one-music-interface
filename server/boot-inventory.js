import { readFileSync, readdirSync } from "node:fs";
import { networkInterfaces } from "node:os";
const read = (p) => {
  try {
    return readFileSync(p, "utf8").trim();
  } catch {
    return "";
  }
};
const list = (p) => {
  try {
    return readdirSync(p);
  } catch {
    return [];
  }
};
/** Read-only, bounded inventory. Never writes GPIO/I2C/backlight or sends ping. */
export function bootInventory() {
  const raw = read("/sys/class/thermal/thermal_zone0/temp");
  const cards = read("/proc/asound/cards");
  const audioCards = cards
    .split("\n")
    .filter((s) => /^\s*\d+\s+\[/.test(s))
    .map((s) => s.trim().slice(0, 160))
    .slice(0, 16);
  const fans = list("/sys/class/hwmon")
    .flatMap((dir) =>
      list(`/sys/class/hwmon/${dir}`)
        .filter((name) => /^fan\d+_input$/.test(name))
        .map((name) => read(`/sys/class/hwmon/${dir}/${name}`)),
    )
    .filter((s) => s !== "" && Number.isFinite(Number(s)));
  return {
    temperatureC:
      raw && Number.isFinite(Number(raw)) ? Number(raw) / 1000 : null,
    audioCards,
    fanRpm: fans.length ? Number(fans[0]) : null,
    networkReady: Object.values(networkInterfaces())
      .flat()
      .some((n) => n && !n.internal),
  };
}
