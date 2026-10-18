import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { initialDevice, transition, faultNames } from "../shared/device.js";
import {
  initialPlayback,
  playbackEvent,
  positionAt,
} from "../shared/playback.js";
import { settings as normalize } from "../shared/settings.js";
import { endSync } from "../shared/video.js";
import { scenarios } from "../shared/runtime.js";
import {
  normalizeThemePreferences,
  resolveTheme,
  themeVariables,
} from "../shared/themes.js";
import { ThemeSettings } from "./Themes.jsx";
import "./style.css";
function load() {
  try {
    return normalize(JSON.parse(localStorage.getItem("daw-settings") || "{}"));
  } catch {
    return normalize();
  }
}
const time = (n) =>
  `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
function loadThemes() {
  try {
    return normalizeThemePreferences(
      JSON.parse(localStorage.getItem("daw-themes") || "null"),
    );
  } catch {
    return normalizeThemePreferences();
  }
}
function App() {
  const [snapshot, setSnapshot] = useState({
      device: transition(initialDevice(), { type: "boot-complete" }),
      playback: initialPlayback(),
      mode: "simulation",
    }),
    [prefs, setPrefs] = useState(load),
    [themePreferences, setThemePreferences] = useState(loadThemes),
    [page, setPage] = useState("playing"),
    [offline, setOffline] = useState(false),
    [clock, setClock] = useState(Date.now()),
    [notice, setNotice] = useState(""),
    [videoAvailable, setVideoAvailable] = useState(true),
    [matched, setMatched] = useState(true),
    [scenario, setScenario] = useState("Cold boot");
  useEffect(() => {
    try {
      localStorage.setItem("daw-settings", JSON.stringify(prefs));
    } catch {
      setNotice("Settings storage unavailable");
    }
  }, [prefs]);
  useEffect(() => {
    try {
      localStorage.setItem("daw-themes", JSON.stringify(themePreferences));
    } catch {
      setNotice("Theme storage unavailable; changes apply for this session");
    }
  }, [themePreferences]);
  useEffect(() => {
    let live = true;
    const poll = () =>
      fetch("/api/state")
        .then((r) => {
          if (!r.ok) throw Error();
          return r.json();
        })
        .then((s) => {
          if (live) {
            setSnapshot(s);
            setOffline(false);
          }
        })
        .catch(() => {
          if (live) setOffline(true);
        });
    poll();
    const id = setInterval(poll, 1500);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  async function send(e) {
    if (offline) {
      setNotice("Offline preview · command not sent");
      return;
    }
    try {
      const r = await fetch("/api/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(e),
      });
      if (!r.ok) throw Error();
      setSnapshot(await r.json());
      setNotice("");
    } catch {
      setOffline(true);
      setNotice("Connection lost · settings remain available");
    }
  }
  async function run() {
    try {
      const r = await fetch("/api/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: scenario }),
      });
      if (!r.ok) throw Error();
      setSnapshot(await r.json());
    } catch {
      setNotice("Scenario unavailable while backend is offline");
    }
  }
  const { device, playback } = snapshot,
    track = playback.queue[playback.index],
    position = positionAt(playback, clock),
    video = endSync({
      audioPosition: position,
      audioDuration: track.duration,
      videoDuration: 360,
      correction: prefs.correction,
      intro: 10,
      matched,
      available: videoAvailable,
      playing: playback.playing,
    }),
    update = (key, value) => setPrefs((p) => normalize({ ...p, [key]: value }));
  const theme = resolveTheme(
    themePreferences,
    { device, playback, offline },
    new Date(clock),
  );
  return (
    <main
      data-diagnostics={theme.diagnostics}
      data-theme={theme.id}
      data-meter={theme.tokens.meter}
      style={{
        ...themeVariables(theme),
        "--brightness": prefs.brightness / 100,
      }}
    >
      <header>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("playing");
          }}
        >
          DAW <b>ONE</b>
          <span>INTELLIGENT STREAMING AMPLIFIER</span>
        </a>
        <div className="status">
          <i className={offline ? "amber" : ""} />
          {offline ? "OFFLINE PREVIEW" : "SIMULATED SYSTEM"}
          <span className="divider" /> {device.mode.toUpperCase()}
        </div>
        <button
          className="power"
          aria-label="Standby"
          onClick={() => send({ type: "standby" })}
        >
          ⏻
        </button>
      </header>
      <div className="shell">
        <nav aria-label="Main navigation">
          {[
            ["playing", "◉", "Now playing"],
            ["queue", "≋", "Queue"],
            ["settings", "⚙", "Settings"],
            ["simulation", "⌘", "Hardware Simulator"],
          ].map(([id, icon, label]) => (
            <button
              key={id}
              aria-label={label}
              aria-current={page === id ? "page" : undefined}
              className={page === id ? "selected" : ""}
              onClick={() => setPage(id)}
            >
              <span>{icon}</span>
              <small>{label}</small>
            </button>
          ))}
        </nav>
        {page === "playing" ? (
          <section className="now" aria-label="Now playing">
            <div
              className={`art ${prefs.artwork === "video" && video.status === "active" ? "motion" : ""}`}
            >
              <div className="orb" />
              <span className="art-label">
                {prefs.artwork === "video"
                  ? "VIDEO ARTWORK · MOCK"
                  : "AMBIENT TRANSMISSIONS"}
              </span>
              {prefs.artwork === "video" && (
                <div className="video-info">
                  {video.status} · {time(video.position)}
                  <small>End-Sync {video.offset ?? "—"}s</small>
                </div>
              )}
            </div>
            <div className="track">
              <div className="eyebrow">
                {playback.connected ? "MUSIC LIBRARY" : "SERVER UNAVAILABLE"}{" "}
                <span>•</span> LOSSLESS EXPERIENCE
              </div>
              <h1>{track.title}</h1>
              <p>
                {track.artist}
                <span className="dot"> · </span>
                <span className="album">{track.album}</span>
              </p>
              <div className="progress">
                <input
                  aria-label="Playback position"
                  type="range"
                  min="0"
                  max={track.duration}
                  value={position}
                  onChange={(e) =>
                    send({ type: "seek", position: +e.target.value })
                  }
                />
                <div>
                  <span>{time(position)}</span>
                  <span>{time(track.duration)}</span>
                </div>
              </div>
              <div className="transport">
                <button
                  aria-label="Previous track"
                  onClick={() => send({ type: "previous" })}
                >
                  Ⅰ◀
                </button>
                <button
                  className="play"
                  aria-label={playback.playing ? "Pause" : "Play"}
                  onClick={() =>
                    send({ type: playback.playing ? "pause" : "play" })
                  }
                >
                  {playback.playing ? "Ⅱ" : "▶"}
                </button>
                <button
                  aria-label="Next track"
                  onClick={() => send({ type: "next" })}
                >
                  ▶Ⅰ
                </button>
                <button
                  className="art-toggle"
                  onClick={() =>
                    update(
                      "artwork",
                      prefs.artwork === "cover" ? "video" : "cover",
                    )
                  }
                >
                  {prefs.artwork === "cover"
                    ? "◈ Video artwork"
                    : "◈ Cover artwork"}
                </button>
              </div>
            </div>
            <aside className="volume">
              <div className="eyebrow">VOLUME</div>
              <strong>
                {prefs.volume}
                <small>%</small>
              </strong>
              <input
                aria-label="Volume"
                type="range"
                min="0"
                max="100"
                value={prefs.volume}
                onChange={(e) => update("volume", +e.target.value)}
              />
              <span>SIMULATED OUTPUT</span>
              <div className="signal" aria-label="Simulated level meter">
                {theme.tokens.meter === "dots"
                  ? "● ● ◉ ● ◉ ●"
                  : theme.tokens.meter === "line"
                    ? "━━━━━━╸"
                    : "▂ ▅ ▃ ▇ ▄ ▂ ▅ ▃ ▆ ▂"}
              </div>
              {theme.diagnostics && (
                <dl
                  className="diagnostic-widgets"
                  aria-label="Nerd diagnostics"
                >
                  <div>
                    <dt>Controller</dt>
                    <dd>
                      {snapshot.sensors?.heartbeatEnabled
                        ? "MOCK HB ON"
                        : "MOCK HB OFF"}
                    </dd>
                  </div>
                  <div>
                    <dt>Temp / PD</dt>
                    <dd>
                      {snapshot.sensors?.temperature ?? "—"} °C /{" "}
                      {snapshot.sensors?.powerGood ? "GOOD" : "NOT GOOD"}
                    </dd>
                  </div>
                  <div>
                    <dt>Enable / faults</dt>
                    <dd>
                      {String(device.amplifierEnabled)} / {device.faults.length}
                    </dd>
                  </div>
                </dl>
              )}
              <small>
                Hardware unverified
                <br />
                Amplifier physically disabled
              </small>
            </aside>
          </section>
        ) : (
          <section className="panel">
            <div className="panel-title">
              <div className="eyebrow">DAW ONE CONTROL</div>
              <h1>
                {page === "settings"
                  ? "Make it yours"
                  : page === "queue"
                    ? "Up next"
                    : "Hardware Simulator"}
              </h1>
            </div>
            {page === "settings" ? (
              <>
                <div className="settings-grid">
                  <label>
                    Display brightness <output>{prefs.brightness}%</output>
                    <input
                      aria-label="Display brightness"
                      type="range"
                      min="10"
                      max="100"
                      value={prefs.brightness}
                      onChange={(e) => update("brightness", +e.target.value)}
                    />
                  </label>
                  <label>
                    Artwork mode
                    <select
                      value={prefs.artwork}
                      onChange={(e) => update("artwork", e.target.value)}
                    >
                      <option value="cover">Album cover</option>
                      <option value="video">Video artwork · mock</option>
                    </select>
                  </label>
                  <label>
                    Manual video correction (seconds)
                    <input
                      aria-label="Manual video correction"
                      type="number"
                      min="-600"
                      max="600"
                      value={prefs.correction}
                      onChange={(e) => update("correction", +e.target.value)}
                    />
                  </label>
                  <p>
                    Saved on this browser. Available offline.
                    <br />
                    Brightness and volume are preview controls.
                  </p>
                </div>
                <ThemeSettings
                  preferences={themePreferences}
                  theme={theme}
                  onChange={setThemePreferences}
                />
              </>
            ) : page === "queue" ? (
              <div className="queue">
                {playback.queue.map((t, i) => (
                  <article key={t.id}>
                    <span>
                      {i === playback.index
                        ? "◉"
                        : String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <b>{t.title}</b>
                      <small>{t.artist}</small>
                    </div>
                    <span>{time(t.duration)}</span>
                  </article>
                ))}
              </div>
            ) : (
              <>
                <div className="scenario-bar">
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
                  <button onClick={run}>Run scenario</button>
                  <b>SIMULATED · NO PHYSICAL OUTPUT</b>
                </div>
                <div className="sim">
                  <div className="sim-actions">
                    {[
                      "boot",
                      "boot-complete",
                      "standby",
                      "presence",
                      "display-timeout",
                      "shutdown",
                      "acknowledge",
                      "simulation-verified",
                      "disconnect",
                      "reconnect",
                      ...faultNames,
                    ].map((type) => (
                      <button key={type} onClick={() => send({ type })}>
                        {type}
                      </button>
                    ))}
                  </div>
                  <div className="telemetry">
                    <b>SIMULATION ONLY</b>
                    <div className="sensor-controls">
                      <label>
                        Ambient light {snapshot.sensors?.ambient ?? 60}%
                        <input
                          aria-label="Ambient light"
                          type="range"
                          min="0"
                          max="100"
                          value={snapshot.sensors?.ambient ?? 60}
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
                          value={snapshot.sensors?.temperature ?? 35}
                          onChange={(e) =>
                            send({
                              type: "temperature",
                              value: +e.target.value,
                            })
                          }
                        />
                      </label>
                      {[
                        ["powerGood", "Power good", "power-good"],
                        ["wifi", "Wi-Fi available", "wifi"],
                        [
                          "heartbeatEnabled",
                          "RP2040 heartbeat",
                          "heartbeat-enabled",
                        ],
                      ].map(([key, label, type]) => (
                        <label key={key}>
                          <input
                            type="checkbox"
                            checked={snapshot.sensors?.[key] ?? false}
                            onChange={(e) =>
                              send({ type, value: e.target.checked })
                            }
                          />
                          {label}
                        </label>
                      ))}
                      <label>
                        <input
                          type="checkbox"
                          checked={snapshot.sensors?.presence ?? false}
                          onChange={(e) =>
                            send({ type: "presence", value: e.target.checked })
                          }
                        />
                        Presence
                      </label>
                      <button
                        onClick={() =>
                          send({ type: "button", button: "play-pause" })
                        }
                      >
                        Physical play/pause button
                      </button>
                    </div>
                    <p>
                      Display: {device.displayAwake ? "awake" : "asleep"} ·
                      Playback: {playback.playing ? "playing" : "paused"}
                      <br />
                      Simulated enable: {device.amplifierEnabled
                        ? "ON"
                        : "OFF"}{" "}
                      · Verified: {String(device.verified)}
                    </p>
                    <p role="alert">
                      {device.faults.join(", ") || "No latched faults"}
                    </p>
                    <label>
                      <input
                        type="checkbox"
                        checked={videoAvailable}
                        onChange={(e) => setVideoAvailable(e.target.checked)}
                      />{" "}
                      Video available
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={matched}
                        onChange={(e) => setMatched(e.target.checked)}
                      />{" "}
                      Match confirmed
                    </label>
                  </div>
                </div>
                <div className="timeline" aria-label="Device timeline">
                  <h2>Event timeline</h2>
                  {(snapshot.log || [])
                    .slice()
                    .reverse()
                    .map((e) => (
                      <div key={e.id}>
                        <time>{e.at}</time>
                        <b>{e.type}</b>
                        <span>{e.reason}</span>
                      </div>
                    ))}
                </div>
              </>
            )}
          </section>
        )}
      </div>
      <footer>
        <span>
          <i />{" "}
          {offline
            ? "BACKEND OFFLINE"
            : playback.connected
              ? "MOCK SOURCE CONNECTED"
              : "MUSIC SERVER DISCONNECTED"}
        </span>
        <span role="status">
          {notice ||
            (device.faults.length
              ? "FAULT LATCHED · OUTPUT INHIBITED"
              : !device.displayAwake
                ? "DISPLAY SLEEP SIMULATED · AUDIO INDEPENDENT"
                : "DESIGNED FOR LISTENING")}
        </span>
        <span>
          DAW ONE <b>01</b>
        </span>
      </footer>
    </main>
  );
}
createRoot(document.getElementById("root")).render(<App />);
if (import.meta.env.PROD && "serviceWorker" in navigator)
  navigator.serviceWorker.register("/sw.js").catch(() => {});
