/** Shared boot checks. A pass is evidence for a check, never amplifier permission. */
export const bootDefaults = Object.freeze({
  radioEnabled: false,
  station: "ambient",
  volume: 15,
});
export function bootSettings(value = {}) {
  if (!value || typeof value !== "object") value = {};
  return {
    radioEnabled: value.radioEnabled === true,
    station: value.station === "classical" ? "classical" : "ambient",
    volume: Number.isFinite(value.volume)
      ? Math.max(0, Math.min(40, Math.round(value.volume)))
      : 15,
  };
}
export const initialBootInputs = () => ({
  pdWatts: 100,
  usbAudio: false,
  digitalVerified: false,
  fanExpected: false,
  fanRpm: null,
  groupActive: false,
});
export function setBootInput(inputs, key, value) {
  if (!Object.hasOwn(initialBootInputs(), key))
    throw Error("Unknown startup signal");
  if (["pdWatts", "fanRpm"].includes(key)) {
    if (
      value !== null &&
      (!Number.isFinite(value) || value < 0 || value > 10000)
    )
      throw Error("Invalid startup measurement");
  } else if (typeof value !== "boolean")
    throw Error("Boolean startup signal required");
  return { ...inputs, [key]: value };
}
export function bootReport({
  simulated = true,
  device = {},
  sensors = {},
  playback = {},
  inputs = {},
  inventory = {},
  music = {},
} = {}) {
  const checks = [];
  const add = (id, label, status, reason) =>
    checks.push({ id, label, status, reason, simulated });
  const pd = simulated ? inputs.pdWatts : null;
  add(
    "power",
    "Voeding / PD",
    Number.isFinite(pd) && pd >= 100 ? "pass" : "warning",
    Number.isFinite(pd)
      ? `${pd} W contract · ${pd >= 100 ? "doel bevestigd" : "minder dan 100 W"}`
      : "100 W niet bevestigd · geen geverifieerde PD-driver",
  );
  add(
    "hardware",
    "Hardwareveiligheid",
    simulated && device.verified ? "pass" : "unavailable",
    simulated
      ? device.verified
        ? "Simulatie geverifieerd"
        : "Uitgangen geblokkeerd tot verificatie"
      : "Fysieke versterkerbesturing niet geïmplementeerd",
  );
  const temp = simulated ? sensors.temperature : inventory.temperatureC;
  add(
    "temperature",
    "Temperatuur",
    !Number.isFinite(temp) ? "unavailable" : temp >= 75 ? "fail" : "pass",
    Number.isFinite(temp)
      ? `${temp.toFixed(1)} °C · ${simulated ? "simulatiegrens 75 °C" : "CPU, geen kastmeting of thermische vrijgave"}`
      : "Geen temperatuurmeting beschikbaar",
  );
  const fan = simulated ? inputs.fanRpm : inventory.fanRpm;
  add(
    "fan",
    "Ventilator",
    simulated && !inputs.fanExpected
      ? "optional"
      : Number.isFinite(fan)
        ? fan > 0
          ? "pass"
          : "fail"
        : "unavailable",
    simulated && !inputs.fanExpected
      ? "Niet vereist in dit simulatieprofiel"
      : Number.isFinite(fan)
        ? `${fan} RPM feedback`
        : "Geen tach-feedback beschikbaar; aanwezigheid onbekend",
  );
  add(
    "audio",
    "USB / audio-uitgang",
    simulated ? "pass" : inventory.audioCards?.length ? "pass" : "unavailable",
    simulated
      ? inputs.usbAudio
        ? "USB-audio gedetecteerd · uitgang nog kiezen"
        : "Gesimuleerde preview-uitgang"
      : inventory.audioCards?.length
        ? `${inventory.audioCards.length} ALSA-kaart(en) gedetecteerd; route niet geverifieerd`
        : "Geen ALSA-kaarten gerapporteerd",
  );
  add(
    "digital",
    "TOSLINK / S/PDIF",
    simulated ? (inputs.digitalVerified ? "pass" : "optional") : "unavailable",
    simulated && inputs.digitalVerified
      ? "Expliciet geverifieerde simulatie-uitgang"
      : simulated ? "Optioneel · USB-detectie bewijst geen optische aansluiting" : "USB-detectie bewijst geen optische aansluiting",
  );
  const network = simulated ? sensors.wifi : inventory.networkReady;
  add(
    "network",
    "Netwerk",
    network === true ? "pass" : network === false ? "fail" : "unavailable",
    network === true
      ? simulated
        ? "Gesimuleerde wifi en route beschikbaar"
        : "Host heeft een netwerkadres; geen bewijs van internettoegang"
      : network === false
        ? "Geen netwerkverbinding"
        : "Netwerkstatus onbekend",
  );
  const connected = simulated ? playback.connected : music.connected;
  add(
    "music",
    "Music Assistant",
    connected ? "pass" : music.status === "connecting" ? "pending" : "fail",
    connected
      ? simulated
        ? "Gesimuleerde server verbonden"
        : "API geauthenticeerd"
      : music.status === "connecting"
        ? "Verbinding maken…"
        : music.errorCode === "auth-required"
          ? "Authenticatie vereist · token instellen"
          : music.errorCode === "auth-failed"
            ? "Authenticatie mislukt · token controleren"
            : music.errorCode === "permissions"
              ? "Onvoldoende Music Assistant-rechten"
              : "Server niet verbonden; lokale instellingen blijven beschikbaar",
  );
  const player = simulated
    ? playback.connected
    : music.playerId && playback.connected;
  add(
    "player",
    "Speler",
    player ? "pass" : "unavailable",
    player
      ? simulated
        ? "Simulatiespeler beschikbaar"
        : "Geselecteerde speler meldt beschikbaar; geen hoorbaarheidstest"
      : "Geen beschikbare geselecteerde speler",
  );
  const phase =
    device.mode === "booting"
      ? "booting"
      : device.mode === "fault"
        ? "fault"
        : device.mode === "standby"
          ? "standby"
          : device.mode === "shutting-down"
            ? "shutdown"
            : checks.some((c) => c.status === "pending")
              ? "checking"
              : network === false || !connected
                ? "offline"
                : checks.some((c) =>
                      ["warning", "fail", "unavailable"].includes(c.status),
                    )
                  ? "attention"
                  : "ready";
  return {
    phase,
    simulated,
    checks,
    displayControl: simulated ? "simulated" : "unavailable",
    attribution: "Geen hardwarevrijgave door deze checks",
  };
}
export class BootMonitor {
  constructor() {
    this.previous = new Map();
  }
  update(report, record, now) {
    for (const check of [
      { id: "phase", status: report.phase, reason: report.phase },
      ...report.checks,
    ]) {
      const key = `${check.status}:${check.reason}`;
      if (this.previous.get(check.id) !== key) {
        this.previous.set(check.id, key);
        record(
          now,
          "startup-check",
          report.phase,
          `${check.id}: ${check.status}; ${check.reason}`,
          report.simulated,
        );
      }
    }
    return report;
  }
}
export class ColdBootRadio {
  constructor(settings) {
    this.settings = bootSettings(settings);
    this.attempted = false;
    this.status = "waiting";
  }
  consider({ simulated, device, sensors, playback, inputs }) {
    if (this.attempted) return null;
    if (!this.settings.radioEnabled) {
      this.status = "disabled";
      return null;
    }
    if (!simulated) {
      this.attempted = true;
      this.status = "blocked-live-adapter";
      return null;
    }
    if (["fault", "standby", "shutting-down"].includes(device.mode)) {
      this.attempted = true;
      this.status = "cancelled";
      return null;
    }
    if (
      device.mode === "ready" &&
      (!sensors.wifi ||
        !playback.connected ||
        playback.playing ||
        inputs.groupActive)
    ) {
      this.attempted = true;
      this.status =
        playback.playing || inputs.groupActive
          ? "skipped-busy"
          : "skipped-offline";
      return null;
    }
    if (
      device.mode !== "ready" ||
      !device.verified ||
      !device.controllerReady ||
      !sensors.powerGood ||
      !Number.isFinite(sensors.temperature) ||
      sensors.temperature >= 75 ||
      !sensors.wifi ||
      !playback.connected ||
      !Number.isFinite(inputs.pdWatts) ||
      inputs.pdWatts < 100 ||
      (inputs.fanExpected && !(inputs.fanRpm > 0))
    )
      return null;
    this.attempted = true;
    if (playback.playing || inputs.groupActive) {
      this.status = "skipped-busy";
      return null;
    }
    this.status = "requested-simulated";
    return this.settings;
  }
}
