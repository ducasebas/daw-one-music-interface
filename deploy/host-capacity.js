import { readFileSync, statfsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { cpus, loadavg, arch } from "node:os";
import { localServerAssessment } from "../shared/host-capacity.js";
function read(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}
const memory = read("/proc/meminfo");
const mib = (key) => {
  const match = memory.match(new RegExp(`^${key}:\\s+(\\d+)`, "m"));
  return match ? Number(match[1]) / 1024 : null;
};
let freeDiskMiB = null,
  throttled = null;
try {
  const s = statfsSync("/var/lib");
  freeDiskMiB = (s.bavail * s.bsize) / 1048576;
} catch {}
try {
  const s = execFileSync("vcgencmd", ["get_throttled"], {
    encoding: "utf8",
    timeout: 2000,
  });
  const m = s.match(/throttled=0x([0-9a-f]+)/i);
  if (m) throttled = parseInt(m[1], 16);
} catch {}
const temperature = read("/sys/class/thermal/thermal_zone0/temp").trim();
const report = localServerAssessment({
  target: process.argv[2],
  arch: arch(),
  totalMiB: mib("MemTotal"),
  availableMiB: mib("MemAvailable"),
  freeDiskMiB,
  temperatureC: temperature ? Number(temperature) / 1000 : null,
  throttled,
  load1: loadavg()[0],
  cores: cpus().length,
});
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.eligible ? 0 : 3;
