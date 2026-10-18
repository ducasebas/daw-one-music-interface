import React, { useRef, useState, useEffect } from "react";
import { devicePresentation } from "../shared/presentation.js";
import { SimulatorPages } from "./SimulatorPages.jsx";
export function TestWorkbench({
  snapshot,
  offline,
  prefs,
  send,
  now,
  onClose,
  simulatorProps,
  product,
  onReplayStartup,
}) {
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
            3.2 +
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
    maxPage = Math.max(0, Math.ceil(events.length / 4) - 1),
    eventPage = Math.min(history, maxPage),
    module = view.modules.find((m) => m.id === selected);
  const power = () =>
    send({ type: "button", button: d.mode === "standby" ? "wake" : "standby" });
  return (
    <div className="test-workbench">
      <div className="bench-toolbar">
        <b>
          DAW ONE <span>TEST WORKBENCH</span>
        </b>
        <span className="bench-mode">
          {offline
            ? "BACKEND OFFLINE"
            : live
              ? "LIVE MUSIC · HARDWARE SIMULATED"
              : "SIMULATED DEVICE · SHARED RUNTIME"}
        </span>
        <button
          disabled={offline || !view.displayAwake || d.mode === "fault"}
          onClick={onReplayStartup}
        >
          Replay startup
        </button>
        <button onClick={onClose}>Open product</button>
        <small className="bench-build">display-r3</small>
      </div>
      <div className="bench-layout">
        <section className="bench-preview" aria-label="Physical device preview">
          <div className="bench-preview-title">
            <span>DEVICE EXTERIOR</span>
            <strong>{offline ? "unknown" : d.mode}</strong>
          </div>
          <div className="bench-scene" ref={scene}>
            <div
              className="bench-speaker"
              data-driven={view.driven}
              aria-label={`Left speaker ${view.driven ? "driven" : "silent"}`}
            >
              <i />
              <div />
              <small>L · {view.driven ? "SIGNAL" : "SILENT"}</small>
            </div>
            <div
              className="physical-device"
              style={{ maxWidth: caseWidth }}
              aria-label="DAW ONE exterior"
            >
              <div className="physical-top" ref={top}>
                <span>DAW ONE</span>
                <button
                  className={`top-power ${view.led}`}
                  aria-label={
                    d.mode === "standby" ? "Wake device" : "Case power button"
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
                  aria-label={`Status LED ${view.led}`}
                />
              </div>
              <div className="physical-front">
                <div
                  className="bench-screen"
                  ref={frame}
                  style={{ height: 400 * scale + 4 }}
                >
                  <div
                    className="virtual-display-surface"
                    role="region"
                    aria-label="DAW ONE product display"
                    style={{ transform: `scale(${scale})` }}
                  >
                    {product}
                  </div>
                  {!view.displayAwake && !live && (
                    <button
                      className="screen-sleep"
                      aria-label="Wake device display"
                      disabled={offline}
                      onClick={() => send({ type: "presence", value: true })}
                    >
                      <b>DAW ONE</b>
                      <span>
                        {offline
                          ? "Telemetry unavailable"
                          : "Touch to wake display"}
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
              aria-label={`Right speaker ${view.driven ? "driven" : "silent"}`}
            >
              <i />
              <div />
              <small>R · {view.driven ? "SIGNAL" : "SILENT"}</small>
            </div>
          </div>
          <div className="bench-caption">
            Concept enclosure · top-mounted illuminated button · dimensions and
            electrical behaviour unverified
          </div>
          <section
            className="bench-live-events"
            aria-label="Latest state changes"
          >
            <span>LATEST EVENTS</span>
            {events.slice(0, 2).map((e) => (
              <div key={e.id}>
                <time>{e.at.slice(11, 19)}</time>
                <b>{e.type}</b>
                <span>{e.reason}</span>
              </div>
            ))}
          </section>
        </section>
        <aside
          className="bench-tools"
          aria-label="Separate hardware test panel"
        >
          <div className="bench-tabs" role="tablist" aria-label="Test panels">
            {["Controls", "Modules", "States", "Events"].map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                aria-controls="bench-active-panel"
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div
            className="bench-tab-content"
            id="bench-active-panel"
            role="tabpanel"
            aria-label={tab}
          >
            {tab === "Controls" ? (
              live ? (
                <p>
                  Hardware simulation controls are disabled while live music is
                  selected.
                </p>
              ) : (
                <SimulatorPages {...simulatorProps} />
              )
            ) : tab === "Modules" ? (
              <>
                <div className="bench-modules" aria-label="Simulated modules">
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
                        {m.label}
                        <b>{m.status.toUpperCase()}</b>
                      </span>
                    </button>
                  ))}
                </div>
                <div className="bench-module-detail">
                  <b>{module.label}</b>
                  <p>{module.detail}</p>
                  <button
                    disabled={offline || live}
                    onClick={() => send(actions[selected][1])}
                  >
                    {actions[selected][0]}
                  </button>
                </div>
              </>
            ) : tab === "States" ? (
              <section className="bench-states" aria-label="Device states">
                <h2>Shared device state</h2>
                <div className="state-flow">
                  BOOT → READY ⇄ STANDBY
                  <br />
                  FAULT → ACKNOWLEDGE → STANDBY
                </div>
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
                      <dt>{k}</dt>
                      <dd>{offline ? "unknown" : v}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : (
              <section className="bench-history" aria-label="Device timeline">
                <div className="log-controls">
                  <button
                    disabled={eventPage === 0}
                    onClick={() => setHistory((v) => Math.max(0, v - 1))}
                  >
                    ← Newer
                  </button>
                  <span>
                    {eventPage + 1} / {maxPage + 1}
                  </span>
                  <button
                    disabled={eventPage === maxPage}
                    onClick={() => setHistory((v) => v + 1)}
                  >
                    Older →
                  </button>
                </div>
                {events.slice(eventPage * 4, eventPage * 4 + 4).map((e) => (
                  <article key={e.id}>
                    <time>{e.at}</time>
                    <b>{e.type}</b>
                    <p>{e.reason}</p>
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
