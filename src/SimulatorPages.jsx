import {tr} from "../shared/i18n.js";
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
      <span>{tr(label)}</span>
      <input
        aria-label={tr(label)}
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
    <Pager label={tr("Simulator")} items={pages} index={index} onChange={setIndex}>
      <div className="sim-state">
        <b>{tr("SIMULATED")}</b> {tr(device.mode)}{tr(" · display")}{tr(" ")}
        {tr(device.displayAwake ? "awake" : "asleep")}{tr(" · audio")}{tr(" ")}
        {tr(playback.playing ? "playing" : "paused")}{tr(" · amp")}{tr(" ")}
        {tr(device.amplifierEnabled ? "enabled" : "inhibited")}
        <span role="alert">
          {tr(device.faults.join(", ") || "No latched faults")}
        </span>
      </div>
      {index === 0 ? (
        <div className="control-grid">
          <label>{tr("Automated scenario")}<select
              aria-label={tr("Automated scenario")}
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
            >
              {Object.keys(scenarios).map((n) => (
                <option key={n}>{tr(n)}</option>
              ))}
            </select>
          </label>
          <div className="button-row">
            <button onClick={run}>{tr("Run scenario")}</button>
            <button
              onClick={() => send({ type: "button", button: "play-pause" })}
            >
              {tr(playback.playing ? "Pause" : "Play")}
            </button>
            <button onClick={() => send({ type: "next" })}>{tr("Next track")}</button>
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
                {tr(type)}
              </button>
            ))}
          </div>
          <p>{tr("Run Playback, then open Device to see the case, speakers and modules respond.")}</p>
        </div>
      ) : index === 1 ? (
        <div className="control-grid">
          {tr(toggle("Presence", s.presence, (value) =>
            send({ type: "presence", value }),
          ))}
          <label>{tr("Ambient light ")}{tr(s.ambient ?? 60)}%
            <input
              aria-label={tr("Ambient light")}
              type="range"
              min="0"
              max="100"
              value={s.ambient ?? 60}
              onChange={(e) =>
                send({ type: "ambient", value: +e.target.value })
              }
            />
          </label>
          <label>{tr("Temperature °C")}<input
              aria-label={tr("Temperature")}
              type="number"
              value={s.temperature ?? 35}
              onChange={(e) =>
                send({ type: "temperature", value: +e.target.value })
              }
            />
          </label>
          <div className="video-toggles">
            {tr(toggle("Video available", videoAvailable, setVideoAvailable))}
            {tr(toggle("Match confirmed", matched, setMatched))}
          </div>
        </div>
      ) : index === 2 ? (
        <div className="control-grid">
          {tr([
            ["Power good", "powerGood", "power-good"],
            ["Wi-Fi available", "wifi", "wifi"],
            ["RP2040 heartbeat", "heartbeatEnabled", "heartbeat-enabled"],
          ].map(([label, key, type]) =>
            toggle(label, s[key], (value) => send({ type, value })),
          ))}
          <div className="button-row">
            {["disconnect", "reconnect", "simulation-verified"].map((type) => (
              <button key={type} onClick={() => send({ type })}>
                {tr(type)}
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
              {tr(type)}
            </button>
          ))}
        </div>
      ) : index === 5 ? (
        <div className="control-grid">
          <label>{tr("PD-contract (W)")}<input
              aria-label={tr("Simulated PD watts")}
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
          {tr(toggle(
            "Simulated group active",
            snapshot.boot?.inputs?.groupActive,
            (value) =>
              send({ type: "startup-signal", key: "groupActive", value }),
          ))}
          <p>{tr("Alleen simulatie. Onbekend of minder dan 100 W blokkeert verificatie. Herstel voeding en reset de fout voor opnieuw testen.")}</p>
        </div>
      ) : index === 6 ? (
        <div className="control-grid">
          {tr(toggle(
            "USB audio present",
            snapshot.boot?.inputs?.usbAudio,
            (value) => send({ type: "startup-signal", key: "usbAudio", value }),
          ))}
          {tr(toggle(
            "Digital output verified",
            snapshot.boot?.inputs?.digitalVerified,
            (value) =>
              send({ type: "startup-signal", key: "digitalVerified", value }),
          ))}
          {tr(toggle("Fan required", snapshot.boot?.inputs?.fanExpected, (value) =>
            send({ type: "startup-signal", key: "fanExpected", value }),
          ))}
          <label>{tr("Fan feedback (RPM)")}<input
              aria-label={tr("Simulated fan RPM")}
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
        <div className="paged-timeline" aria-label={tr("Device timeline")}>
          <div className="log-controls">
            <button
              aria-label={tr("Newer events")}
              disabled={safeLogPage === 0}
              onClick={() => setLogPage((p) => Math.max(0, p - 1))}
            >{tr("← Newer")}</button>
            <span>
              {tr(safeLogPage + 1)} / {tr(maxLogPage + 1)} · {tr(events.length)}{tr(" events")}</span>
            <button
              aria-label={tr("Older events")}
              disabled={safeLogPage === maxLogPage}
              onClick={() => setLogPage((p) => p + 1)}
            >{tr("Older →")}</button>
          </div>
          {events.slice(safeLogPage * 3, safeLogPage * 3 + 3).map((e) => (
            <article key={e.id}>
              <time>{tr(e.at.slice(11, 23))}</time>
              <b>{tr(e.type)}</b>
              <span>{tr(e.reason)}</span>
            </article>
          ))}
        </div>
      )}
    </Pager>
  );
}
