import { useTemperatureDisplay } from "./useTemperatureDisplay.js";
import React, { useState, useEffect } from "react";
import { Pager } from "./Pager.jsx";
import { bootSettings } from "../shared/boot.js";
export const bootPhaseLabels = {
  booting: "Opstarten",
  checking: "Controleren",
  ready: "Gereed",
  attention: "Aandacht",
  offline: "Offline",
  fault: "Fout",
  standby: "Standby",
  shutdown: "Afsluiten",
};
const states = {
  pass: "OK",
  warning: "Aandacht",
  fail: "Fout",
  unavailable: "Niet beschikbaar",
  optional: "Optioneel",
  pending: "Bezig",
};
export function BootPanel({ snapshot, onSnapshot, offline = false }) {
  const [page, setPage] = useState(0),
    [draft, setDraft] = useState(() => bootSettings(snapshot.boot?.settings)),
    [notice, setNotice] = useState(""),
    [pending, setPending] = useState(false);
  const boot = snapshot.boot,
    live = snapshot.mode === "music-assistant";
  useEffect(() => {
    setDraft(bootSettings(snapshot.boot?.settings));
  }, [
    snapshot.boot?.settings?.radioEnabled,
    snapshot.boot?.settings?.station,
    snapshot.boot?.settings?.volume,
  ]);
  async function save() {
    setPending(true);
    try {
      const r = await fetch("/api/boot/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!r.ok) throw Error();
      onSnapshot?.(await r.json());
      setNotice("Opgeslagen · geldt vanaf volgende koude simulatieboot");
    } catch {
      setNotice("Opslaan niet gelukt · backendverbinding vereist");
    } finally {
      setPending(false);
    }
  }
  const telemetry = snapshot.hardwareTelemetry;
  const displayTemperature = useTemperatureDisplay(
    telemetry?.temperature,
    offline,
  );
  const sensorCard = (key, label, unit, digits, source) => {
    const reading = telemetry?.[key];
    const valid =
      !offline && reading?.status === "ok" && Number.isFinite(reading.value);
    return {
      id: key,
      label,
      status: valid ? "pass" : "unavailable",
      value: valid
        ? `${(key === "temperature" ? (displayTemperature ?? reading.value) : reading.value).toFixed(digits)} ${unit}`
        : "Onbekend",
      reason: `${source} · ${offline ? "backend offline" : !telemetry?.enabled ? "sensorservice niet ingeschakeld" : reading?.status === "stale" ? "meting verouderd" : valid ? (key === "temperature" ? "echte meting · rustig gefilterd" : "echte meting") : "geen geldige meting"}`,
    };
  };
  const physicalSensors = [
    sensorCard("temperature", "Omgevingstemperatuur", "°C", 1, "PCT2075"),
    sensorCard("light", "Lichtsterkte", "lux", 0, "TSL2591"),
  ];
  const temperatureCheck = boot?.checks?.find((c) => c.id === "temperature");
  const cpuCard = {
    id: "cpu",
    label: boot?.simulated ? "Temperatuur · simulatie" : "CPU-temperatuur",
    status: offline ? "unavailable" : temperatureCheck?.status || "unavailable",
    reason: offline
      ? "Backend offline · actuele status onbekend"
      : temperatureCheck?.reason || "Hostmeting niet beschikbaar",
  };
  return (
    <div className="boot-panel" aria-label="Opstartcontrole">
      <Pager
        label="Boot"
        items={[
          "Voeding en hardware",
          "Audio en koeling",
          "Netwerk en speler",
          "Autoradio",
          "Sensoren",
        ]}
        index={page}
        onChange={setPage}
      >
        {page < 3 ? (
          <div className="boot-checks">
            <small>
              {boot?.simulated
                ? "GESIMULEERDE CHECKS"
                : "HOSTMETINGEN · HARDWARE NIET GEVERIFIEERD"}
            </small>
            {boot?.checks?.slice(page * 3, page * 3 + 3).map((entry) => {
              const check = offline
                ? {
                    ...entry,
                    status: "unavailable",
                    reason: "Backend offline · actuele status onbekend",
                  }
                : entry;
              return (
                <article key={check.id} data-status={check.status}>
                  <b>{check.label}</b>
                  <span>{states[check.status]}</span>
                  <small>{check.reason}</small>
                </article>
              );
            })}
            {!boot && (
              <p>Opstartstatus niet beschikbaar · backend controleren</p>
            )}
          </div>
        ) : page === 4 ? (
          <div
            className="boot-checks sensor-cards"
            aria-label="Echte sensormetingen"
          >
            <small>
              Echte I²C-metingen · apart van CPU en simulatie · geen
              versterkervrijgave
            </small>
            {[...physicalSensors, cpuCard].map((card) => (
              <article
                key={card.id}
                data-status={card.status}
                aria-label={card.label}
              >
                <b>{card.label}</b>
                <span>{states[card.status]}</span>
                {card.value && <strong>{card.value}</strong>}
                <small>{card.reason}</small>
              </article>
            ))}
          </div>
        ) : (
          <div className="boot-radio">
            <label>
              <input
                aria-label="Autoradio bij koude boot"
                type="checkbox"
                checked={draft.radioEnabled}
                disabled={live || offline}
                onChange={(e) =>
                  setDraft({ ...draft, radioEnabled: e.target.checked })
                }
              />{" "}
              Autoradio bij koude boot · simulatie
            </label>
            <label>
              Voorbeeldstation
              <select
                aria-label="Voorbeeldstation"
                disabled={live || offline}
                value={draft.station}
                onChange={(e) =>
                  setDraft({ ...draft, station: e.target.value })
                }
              >
                <option value="ambient">Ambient Radio</option>
                <option value="classical">Classical Radio</option>
              </select>
            </label>
            <label>
              Startvolume {draft.volume}%
              <input
                aria-label="Radio startvolume"
                type="range"
                min="0"
                max="40"
                disabled={live || offline}
                value={draft.volume}
                onChange={(e) =>
                  setDraft({ ...draft, volume: +e.target.value })
                }
              />
            </label>
            <button disabled={live || offline || pending} onClick={save}>
              {pending ? "Opslaan…" : "Opstartinstellingen opslaan"}
            </button>
            <small role="status">
              {notice ||
                (live
                  ? "Live autoradio geblokkeerd: station/route-adapter nog niet geverifieerd"
                  : `Koude boot: ${boot?.radioStatus || "onbekend"} · nooit automatisch bij reconnect of wake`)}
            </small>
          </div>
        )}
      </Pager>
    </div>
  );
}
