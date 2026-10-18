import React, { useState } from "react";
import { devicePresentation } from "../shared/presentation.js";
function Speaker({ side, driven }) {
  return (
    <div
      className="speaker"
      data-driven={driven}
      aria-label={`${side} speaker ${driven ? "driven" : "silent"}`}
    >
      <div className="tweeter" />
      <div className="woofer">
        <div />
      </div>
      <span>
        {side === "Left" ? "L" : "R"} · {driven ? "SIGNAL" : "SILENT"}
      </span>
    </div>
  );
}
export function DeviceView({
  snapshot,
  offline,
  prefs,
  send,
  now,
  onDemo,
  onOpenDisplay,
}) {
  const [selected, setSelected] = useState("amplifier");
  const view = devicePresentation(snapshot, {
    offline,
    volume: prefs.volume,
    now,
  });
  const module = view.modules.find((m) => m.id === selected),
    { device, playback } = snapshot,
    track = playback.queue[playback.index];
  const actions = {
    controller: {
      label: snapshot.sensors?.heartbeatEnabled
        ? "Stop heartbeat"
        : "Restore heartbeat",
      event: {
        type: "heartbeat-enabled",
        value: !snapshot.sensors?.heartbeatEnabled,
      },
    },
    power: {
      label: snapshot.sensors?.powerGood
        ? "Drop power-good"
        : "Restore power-good",
      event: { type: "power-good", value: !snapshot.sensors?.powerGood },
    },
    wifi: {
      label: snapshot.sensors?.wifi ? "Disconnect Wi-Fi" : "Restore Wi-Fi",
      event: { type: "wifi", value: !snapshot.sensors?.wifi },
    },
    music: {
      label: playback.connected ? "Disconnect source" : "Reconnect source",
      event: { type: playback.connected ? "disconnect" : "reconnect" },
    },
    amplifier: {
      label: "Inject amp fault",
      event: { type: "amplifier-fault" },
    },
    display: {
      label: view.displayAwake ? "Sleep display" : "Wake display",
      event: { type: view.displayAwake ? "display-timeout" : "presence" },
    },
    pi: { label: "Simulate reboot", event: { type: "boot" } },
    speakers: {
      label: playback.playing ? "Pause signal" : "Play signal",
      event: { type: "button", button: "play-pause" },
    },
  };
  const displayTouch = () => {
    if (view.displayAwake) onOpenDisplay();
    else if (!offline) send({ type: "presence", value: true });
  };
  return (
    <section className="device-view" aria-label="DAW ONE exterior">
      <div className="device-heading">
        <h1>Your DAW ONE</h1>
        <span>INTERACTIVE CONCEPT · SIMULATED HARDWARE</span>
        <button className="case-demo" disabled={offline} onClick={onDemo}>
          Playback demo
        </button>
        <b
          className={`case-led ${view.led}`}
          aria-label={`Status LED ${view.led}`}
        />
      </div>
      <div className="listening-room">
        <Speaker side="Left" driven={view.driven} />
        <div className="chassis">
          <div className="chassis-top" />
          <div className="chassis-face">
            <div className="case-signature">
              DAW <b>ONE</b>
              <small>INTELLIGENT AMPLIFIER</small>
            </div>
            <div
              className="case-screen"
              data-awake={view.displayAwake}
              role="button"
              tabIndex={0}
              aria-label="Device display"
              onClick={displayTouch}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  displayTouch();
                }
              }}
            >
              <span>
                {offline
                  ? "TELEMETRY UNAVAILABLE"
                  : !view.displayAwake
                    ? "DISPLAY ASLEEP"
                    : playback.playing
                      ? "NOW PLAYING"
                      : "READY TO LISTEN"}
              </span>
              <strong>{view.displayAwake ? track.title : "DAW ONE"}</strong>
              <small>
                {view.displayAwake
                  ? track.artist
                  : "Audio may continue while display sleeps"}
              </small>
              <div className="case-meter" data-active={view.driven}>
                ▂ ▄ ▆ ▃ ▇ ▄ ▂ ▅ ▃ ▆ ▄ ▂
              </div>
            </div>
            <div className="case-controls">
              <button
                className={`case-power ${view.led}`}
                aria-label={
                  device.mode === "standby"
                    ? "Wake device"
                    : "Case power button"
                }
                aria-pressed={device.mode === "ready"}
                disabled={
                  offline ||
                  ["booting", "shutting-down", "fault"].includes(device.mode)
                }
                onClick={() =>
                  send({
                    type: "button",
                    button: device.mode === "standby" ? "wake" : "standby",
                  })
                }
              >
                ⏻
              </button>
              <span>{view.led.toUpperCase()}</span>
            </div>
          </div>
          <div className="case-feet">
            <i />
            <i />
          </div>
        </div>
        <Speaker side="Right" driven={view.driven} />
      </div>
      <div className="module-rack" aria-label="Simulated modules">
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
      <div className="module-detail" role="status">
        <b>{module.label}</b>
        <span>{module.detail}</span>
        <button
          disabled={offline}
          onClick={() => send(actions[selected].event)}
        >
          {actions[selected].label}
        </button>
        <button
          aria-label={
            playback.playing ? "Case pause playback" : "Case play playback"
          }
          onClick={() => send({ type: "button", button: "play-pause" })}
          disabled={offline}
        >
          {playback.playing ? "Ⅱ Pause" : "▶ Play"}
        </button>
        <button
          onClick={() => send({ type: "presence", value: true })}
          disabled={offline}
        >
          Presence
        </button>
      </div>
    </section>
  );
}
