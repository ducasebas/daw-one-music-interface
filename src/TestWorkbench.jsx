import {tr} from "../shared/i18n.js";
import { panelProfile, panelProfiles } from "../shared/display.js";
import { BuildBadge } from "./BuildBadge.jsx";
import React, { useRef, useState, useEffect } from "react";
import { devicePresentation } from "../shared/presentation.js";
import { SimulatorPages } from "./SimulatorPages.jsx";
export function TestWorkbench({
  gui2 = false,
  snapshot,
  offline,
  prefs,
  send,
  now,
  simulatorProps,
  product,
  onReplayStartup,
}) {
  const panel = panelProfile(location.search), dimensions = panelProfiles[panel];
  const [tab, setTab] = useState("Controls"),
    [selected, setSelected] = useState("amplifier"),
    [history, setHistory] = useState(0),
    [scale, setScale] = useState(0.5);
  const scene = useRef(null),
    top = useRef(null);
  const [caseWidth, setCaseWidth] = useState(1100);
  const frame = useRef(null),
    view = devicePresentation(snapshot, {
      offline,
      volume: snapshot.audio?.volume ?? prefs.volume,
      now,
    }),
    live = snapshot.mode === "music-assistant",
    d = snapshot.device,
    s = snapshot.sensors || {},
    p = snapshot.playback;
  useEffect(() => {
    const observer = new ResizeObserver((entries) =>
      setScale(entries[0].contentRect.width / 1280),
    );
    if (frame.current) observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const observer = new ResizeObserver((entries) =>
      setCaseWidth(
        Math.max(
          120,
          (entries[0].contentRect.height -
            (top.current?.offsetHeight || 64) -
            29) *
            (dimensions.width / dimensions.height) +
            22,
        ),
      ),
    );
    if (scene.current) observer.observe(scene.current);
    return () => observer.disconnect();
  }, []);
  const actions = {
    pi: ["Simulate reboot", { type: "boot" }],
    controller: [
      s.heartbeatEnabled ? "Stop heartbeat" : "Restore heartbeat",
      { type: "heartbeat-enabled", value: !s.heartbeatEnabled },
    ],
    power: [
      s.powerGood ? "Drop power-good" : "Restore power-good",
      { type: "power-good", value: !s.powerGood },
    ],
    wifi: [
      s.wifi ? "Disconnect Wi-Fi" : "Restore Wi-Fi",
      { type: "wifi", value: !s.wifi },
    ],
    music: [
      p.connected ? "Disconnect source" : "Reconnect source",
      { type: p.connected ? "disconnect" : "reconnect" },
    ],
    amplifier: ["Inject amp fault", { type: "amplifier-fault" }],
    display: [
      view.displayAwake ? "Sleep display" : "Wake display",
      { type: view.displayAwake ? "display-timeout" : "presence" },
    ],
    speakers: [
      p.playing ? "Pause signal" : "Play signal",
      { type: "button", button: "play-pause" },
    ],
  };
  const events = (snapshot.log || []).slice().reverse(),
    primaryEvents = events.filter((e) => e.type !== "startup-check"),
    maxPage = Math.max(0, Math.ceil(events.length / 4) - 1),
    eventPage = Math.min(history, maxPage),
    module = view.modules.find((m) => m.id === selected);
  const power = () =>
    send({ type: "button", button: d.mode === "standby" ? "wake" : "standby" });
  return (
    <div className="test-workbench" data-panel={panel}>
      <div className="bench-toolbar">
        <b>{tr("DAW ONE ")}<span>{tr("TEST WORKBENCH")}</span>
        </b>
        <span className="bench-mode">
          {tr(offline
            ? "BACKEND OFFLINE"
            : live
              ? "LIVE MUSIC · HARDWARE SIMULATED"
              : "SIMULATED DEVICE · SHARED RUNTIME")}
        </span>
        <button
          disabled={offline || !view.displayAwake || d.mode === "fault"}
          onClick={onReplayStartup}
        >{tr("Replay startup")}</button>
        <a
          className="bench-product-link"
          href={
            gui2 ? "/?gui=2&screen=1&display=hdmi-development&panel="+panel : "/?screen=1"
          }
          target="_blank"
          rel="noopener noreferrer"
        >{tr("Product only ↗")}</a>
        <div className="bench-build">
          <BuildBadge snapshot={snapshot} offline={offline} />
          <small>{tr("display-r3 diagnostics")}</small>
        </div>
      </div>
      <div className="bench-layout">
        <section className="bench-preview" aria-label={tr("Physical device preview")}>
          <div className="bench-preview-title">
            <span>{tr("DEVICE EXTERIOR")}</span>
            <strong>{tr(offline ? "unknown" : d.mode)}</strong>
          </div>
          <div className="bench-scene" ref={scene}>
            <div
              className="bench-speaker"
              data-driven={view.driven}
              aria-label={tr(`Left speaker ${view.driven ? "driven" : "silent"}`)}
            >
              <i />
              <div />
              <small>{tr("L · ")}{tr(view.driven ? "SIGNAL" : "SILENT")}</small>
            </div>
            <div
              className="physical-device"
              style={{ maxWidth: caseWidth }}
              aria-label={tr("DAW ONE exterior")}
            >
              <div className="physical-top" ref={top}>
                <span>{tr("DAW ONE")}</span>
                <button
                  className={`top-power ${view.led}`}
                  aria-label={
                    tr(d.mode === "standby" ? "Wake device" : "Case power button")
                  }
                  aria-pressed={d.mode === "ready"}
                  disabled={
                    offline ||
                    live ||
                    ["booting", "shutting-down", "fault"].includes(d.mode)
                  }
                  onClick={power}
                >
                  <span>⏻</span>
                </button>
                <b
                  className={`top-status case-led ${view.led}`}
                  aria-label={tr(`Status LED ${view.led}`)}
                />
              </div>
              <div className="physical-front">
                <div
                  className="bench-screen"
                  ref={frame}
                  style={{ height: dimensions.height * scale + 4 }}
                >
                  <div
                    className="virtual-display-surface"
                    role="region"
                    aria-label={tr("DAW ONE product display")}
                    style={{ width: dimensions.width, height: dimensions.height, transform: `scale(${scale})` }}
                  >
                    {tr(product)}
                  </div>
                  {!view.displayAwake && !live && panel !== "wall-16-10" && (
                    <button
                      className="screen-sleep"
                      aria-label={tr("Wake device display")}
                      disabled={offline}
                      onClick={() => send({ type: "presence", value: true })}
                    >
                      <b>{tr("DAW ONE")}</b>
                      <span>
                        {tr(offline
                          ? "Telemetry unavailable"
                          : "Touch to wake display")}
                      </span>
                    </button>
                  )}
                </div>
              </div>
              <div className="physical-feet">
                <i />
                <i />
              </div>
            </div>
            <div
              className="bench-speaker"
              data-driven={view.driven}
              aria-label={tr(`Right speaker ${view.driven ? "driven" : "silent"}`)}
            >
              <i />
              <div />
              <small>{tr("R · ")}{tr(view.driven ? "SIGNAL" : "SILENT")}</small>
            </div>
          </div>
          <div className="bench-caption" aria-label={tr("Safety explanation")}>
            {d.faults.length ? (
              <>
                <span>{tr("SIMULATED · Latched: ")}{tr(d.faults.join(", "))}{tr(". Output inhibited.")}</span>
                <button
                  disabled={offline || live}
                  onClick={() => send({ type: "acknowledge" })}
                >{tr("Acknowledge faults")}</button>
              </>
            ) : !d.verified && d.mode === "standby" ? (
              <span>{tr("Safe standby · amplifier remains unverified and off. Restore sensors, then run Playback to verify the simulation.")}</span>
            ) : (
              <span>{tr("Concept enclosure · top-mounted illuminated button · dimensions and electrical behaviour unverified")}</span>
            )}
          </div>
          <section
            className="bench-live-events"
            aria-label={tr("Latest state changes")}
          >
            <span>{tr("LATEST EVENTS")}</span>
            {(primaryEvents.length ? primaryEvents : events)
              .slice(0, 2)
              .map((e) => (
                <div key={e.id}>
                  <time>{tr(e.at.slice(11, 19))}</time>
                  <b>{tr(e.type)}</b>
                  <span>{tr(e.reason)}</span>
                </div>
              ))}
          </section>
        </section>
        <aside
          className="bench-tools"
          aria-label={tr("Separate hardware test panel")}
        >
          <div className="bench-tabs" role="tablist" aria-label={tr("Test panels")}>
            {["Controls", "Modules", "States", "Events"].map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                aria-controls="bench-active-panel"
                onClick={() => setTab(t)}
              >
                {tr(t)}
              </button>
            ))}
          </div>
          <div
            className="bench-tab-content"
            id="bench-active-panel"
            role="tabpanel"
            aria-label={tr(tab)}
          >
            {tab === "Controls" ? (
              live ? (
                null
              ) : (
                <SimulatorPages {...simulatorProps} />
              )
            ) : tab === "Modules" ? (
              <>
                <div className="bench-modules" aria-label={tr("Simulated modules")}>
                  {view.modules.map((m) => (
                    <button
                      key={m.id}
                      data-module={m.id}
                      data-status={m.status}
                      aria-pressed={selected === m.id}
                      onClick={() => setSelected(m.id)}
                    >
                      <i />
                      <span>
                        {tr(m.label)}
                        <b>{tr(m.status.toUpperCase())}</b>
                      </span>
                    </button>
                  ))}
                </div>
                <div className="bench-module-detail">
                  <b>{tr(module.label)}</b>
                  <p>{tr(module.detail)}</p>
                  <button
                    disabled={offline || live}
                    onClick={() => send(actions[selected][1])}
                  >
                    {tr(actions[selected][0])}
                  </button>
                </div>
              </>
            ) : tab === "States" ? (
              <section className="bench-states" aria-label={tr("Device states")}>
                <h2>{tr("Shared device state")}</h2>
                <div className="state-flow">{tr("BOOT → READY ⇄ STANDBY")}<br />{tr("FAULT → ACKNOWLEDGE → STANDBY")}</div>
                <dl>
                  {[
                    ["Mode", offline ? "unknown" : d.mode],
                    ["Playback", p.playing ? "playing" : "paused"],
                    ["Display", d.displayAwake ? "awake" : "sleep"],
                    ["Verified", String(d.verified)],
                    ["Amplifier enable request", String(d.amplifierEnabled)],
                    ["Heartbeat generator", s.heartbeatEnabled ? "on" : "off"],
                    ["Power-good", String(s.powerGood)],
                    ["Temperature", `${s.temperature ?? "—"} °C · simulated`],
                    ["Latched faults", d.faults.join(", ") || "none"],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt>{tr(k)}</dt>
                      <dd>{tr(offline ? "unknown" : v)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : (
              <section className="bench-history" aria-label={tr("Device timeline")}>
                <div className="log-controls">
                  <button
                    disabled={eventPage === 0}
                    onClick={() => setHistory((v) => Math.max(0, v - 1))}
                  >{tr("← Newer")}</button>
                  <span>
                    {tr(eventPage + 1)} / {tr(maxPage + 1)}
                  </span>
                  <button
                    disabled={eventPage === maxPage}
                    onClick={() => setHistory((v) => v + 1)}
                  >{tr("Older →")}</button>
                </div>
                {events.slice(eventPage * 4, eventPage * 4 + 4).map((e) => (
                  <article key={e.id}>
                    <time>{tr(e.at)}</time>
                    <b>{tr(e.type)}</b>
                    <p>{tr(e.reason)}</p>
                  </article>
                ))}
              </section>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
