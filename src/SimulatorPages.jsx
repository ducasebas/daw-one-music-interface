import React, { useState } from "react";
import { Pager } from "./Pager.jsx";
import { faultNames } from "../shared/device.js";
import { scenarios } from "../shared/runtime.js";
const pages = [
  "Scenarios",
  "Sensors",
  "Connections",
  "Safety",
  "Timeline",
  "Boot power",
  "Boot devices",
];
export function SimulatorPages({
  snapshot,
  scenario,
  setScenario,
  run,
  send,
  videoAvailable,
  setVideoAvailable,
  matched,
  setMatched,
}) {
  const [index, setIndex] = useState(0),
    [logPage, setLogPage] = useState(0);
  const { device, playback, sensors: s = {} } = snapshot;
  const toggle = (label, checked, action) => (
    <label className="toggle-control" key={label}>
      <span>{label}</span>
      <input
        aria-label={label}
        type="checkbox"
        checked={checked ?? false}
        onChange={(e) => action(e.target.checked)}
      />
    </label>
  );
  const events = (snapshot.log || []).slice().reverse(),
    maxLogPage = Math.max(0, Math.ceil(events.length / 3) - 1),
    safeLogPage = Math.min(logPage, maxLogPage);
  return (
    <Pager label="Simulator" items={pages} index={index} onChange={setIndex}>
      <div className="sim-state">
        <b>SIMULATED</b> {device.mode} · display{" "}
        {device.displayAwake ? "awake" : "asleep"} · audio{" "}
        {playback.playing ? "playing" : "paused"} · amp{" "}
        {device.amplifierEnabled ? "enabled" : "inhibited"}
        <span role="alert">
          {device.faults.join(", ") || "No latched faults"}
        </span>
      </div>
      {index === 0 ? (
        <div className="control-grid">
          <label>
            Automated scenario
            <select
              aria-label="Automated scenario"
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
            >
              {Object.keys(scenarios).map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <div className="button-row">
            <button onClick={run}>Run scenario</button>
            <button
              onClick={() => send({ type: "button", button: "play-pause" })}
            >
              {playback.playing ? "Pause" : "Play"}
            </button>
            <button onClick={() => send({ type: "next" })}>Next track</button>
          </div>
          <div className="button-row">
            {[
              "boot",
              "boot-complete",
              "standby",
              "presence",
              "display-timeout",
            ].map((type) => (
              <button key={type} onClick={() => send({ type })}>
                {type}
              </button>
            ))}
          </div>
          <p>
            Run Playback, then open Device to see the case, speakers and modules
            respond.
          </p>
        </div>
      ) : index === 1 ? (
        <div className="control-grid">
          {toggle("Presence", s.presence, (value) =>
            send({ type: "presence", value }),
          )}
          <label>
            Ambient light {s.ambient ?? 60}%
            <input
              aria-label="Ambient light"
              type="range"
              min="0"
              max="100"
              value={s.ambient ?? 60}
              onChange={(e) =>
                send({ type: "ambient", value: +e.target.value })
              }
            />
          </label>
          <label>
            Temperature °C
            <input
              aria-label="Temperature"
              type="number"
              value={s.temperature ?? 35}
              onChange={(e) =>
                send({ type: "temperature", value: +e.target.value })
              }
            />
          </label>
          <div className="video-toggles">
            {toggle("Video available", videoAvailable, setVideoAvailable)}
            {toggle("Match confirmed", matched, setMatched)}
          </div>
        </div>
      ) : index === 2 ? (
        <div className="control-grid">
          {[
            ["Power good", "powerGood", "power-good"],
            ["Wi-Fi available", "wifi", "wifi"],
            ["RP2040 heartbeat", "heartbeatEnabled", "heartbeat-enabled"],
          ].map(([label, key, type]) =>
            toggle(label, s[key], (value) => send({ type, value })),
          )}
          <div className="button-row">
            {["disconnect", "reconnect", "simulation-verified"].map((type) => (
              <button key={type} onClick={() => send({ type })}>
                {type}
              </button>
            ))}
          </div>
        </div>
      ) : index === 3 ? (
        <div className="fault-grid">
          {[
            ...faultNames,
            "acknowledge",
            "shutdown",
            "standby",
            "display-timeout",
          ].map((type) => (
            <button key={type} onClick={() => send({ type })}>
              {type}
            </button>
          ))}
        </div>
      ) : index === 5 ? (
        <div className="control-grid">
          <label>
            PD-contract (W)
            <input
              aria-label="Simulated PD watts"
              type="number"
              min="0"
              max="240"
              value={snapshot.boot?.inputs?.pdWatts ?? ""}
              onChange={(e) =>
                send({
                  type: "startup-signal",
                  key: "pdWatts",
                  value: e.target.value === "" ? null : +e.target.value,
                })
              }
            />
          </label>
          {toggle(
            "Simulated group active",
            snapshot.boot?.inputs?.groupActive,
            (value) =>
              send({ type: "startup-signal", key: "groupActive", value }),
          )}
          <p>
            Alleen simulatie. Onbekend of minder dan 100 W blokkeert
            verificatie. Herstel voeding en reset de fout voor opnieuw testen.
          </p>
        </div>
      ) : index === 6 ? (
        <div className="control-grid">
          {toggle(
            "USB audio present",
            snapshot.boot?.inputs?.usbAudio,
            (value) => send({ type: "startup-signal", key: "usbAudio", value }),
          )}
          {toggle(
            "Digital output verified",
            snapshot.boot?.inputs?.digitalVerified,
            (value) =>
              send({ type: "startup-signal", key: "digitalVerified", value }),
          )}
          {toggle("Fan required", snapshot.boot?.inputs?.fanExpected, (value) =>
            send({ type: "startup-signal", key: "fanExpected", value }),
          )}
          <label>
            Fan feedback (RPM)
            <input
              aria-label="Simulated fan RPM"
              type="number"
              min="0"
              max="10000"
              value={snapshot.boot?.inputs?.fanRpm ?? ""}
              onChange={(e) =>
                send({
                  type: "startup-signal",
                  key: "fanRpm",
                  value: e.target.value === "" ? null : +e.target.value,
                })
              }
            />
          </label>
        </div>
      ) : (
        <div className="paged-timeline" aria-label="Device timeline">
          <div className="log-controls">
            <button
              aria-label="Newer events"
              disabled={safeLogPage === 0}
              onClick={() => setLogPage((p) => Math.max(0, p - 1))}
            >
              ← Newer
            </button>
            <span>
              {safeLogPage + 1} / {maxLogPage + 1} · {events.length} events
            </span>
            <button
              aria-label="Older events"
              disabled={safeLogPage === maxLogPage}
              onClick={() => setLogPage((p) => p + 1)}
            >
              Older →
            </button>
          </div>
          {events.slice(safeLogPage * 3, safeLogPage * 3 + 3).map((e) => (
            <article key={e.id}>
              <time>{e.at.slice(11, 23)}</time>
              <b>{e.type}</b>
              <span>{e.reason}</span>
            </article>
          ))}
        </div>
      )}
    </Pager>
  );
}
