import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { initialDevice, transition } from "../shared/device.js";
import { initialPlayback, positionAt } from "../shared/playback.js";
import { settings as normalize } from "../shared/settings.js";
import { endSync } from "../shared/video.js";
import {
  normalizeThemePreferences,
  resolveTheme,
  themeVariables,
} from "../shared/themes.js";
import { SettingsPages } from "./SettingsPages.jsx";
import { TestWorkbench } from "./TestWorkbench.jsx";
import { ReferenceAside } from "./ReferenceAside.jsx";
import { StartupScreen } from "./StartupScreen.jsx";
import { VolumeControl } from "./VolumeControl.jsx";
import "../design/brand-tokens.css";
import "./style.css";
function load() {
  try {
    return normalize(JSON.parse(localStorage.getItem("daw-settings") || "{}"));
  } catch {
    return normalize();
  }
}
const time = (n) =>
  Number.isFinite(n)
    ? `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`
    : "—";
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
    [startupPreview, setStartupPreview] = useState(0),
    [lab, setLab] = useState(
      new URLSearchParams(location.search).get("lab") === "1",
    ),
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
    const stream = new EventSource("/api/events");
    stream.onmessage = (e) => {
      if (!live) return;
      try {
        setSnapshot(JSON.parse(e.data));
        setOffline(false);
      } catch {}
    };
    stream.onerror = () => {
      if (live) setOffline(true);
    };
    poll();
    const id = setInterval(poll, 1500);
    return () => {
      live = false;
      clearInterval(id);
      stream.close();
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
      const data = await r.json();
      if (!r.ok) {
        setNotice(data.error || "Command rejected");
        return;
      }
      setSnapshot(data);
      setNotice("");
    } catch {
      setOffline(true);
      setNotice("Connection lost · settings remain available");
    }
  }
  async function run(name) {
    try {
      const r = await fetch("/api/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: typeof name === "string" ? name : scenario,
        }),
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
  const liveMusic = snapshot.mode === "music-assistant";
  const writable =
    !offline &&
    (!liveMusic ||
      (snapshot.musicAssistant?.controlEnabled && playback.connected));
  const playerVolume = liveMusic
    ? playback.volume
    : (snapshot.audio?.volume ?? prefs.volume);
  const volumeEnabled =
    writable &&
    (!liveMusic ||
      (playback.capabilities?.includes("volume_set") &&
        Number.isFinite(playerVolume)));
  const theme = resolveTheme(
    themePreferences,
    { device, playback, offline },
    new Date(clock),
  );
  const embedded = new URLSearchParams(location.search).get("screen") === "1";
  const layout =
    theme.id === "draft" || theme.id.startsWith("custom-")
      ? "reference-dark"
      : theme.id;
  const videoActive = layout === "cinematic" || prefs.artwork === "video";
  const openLab = () => {
    setLab(true);
    history.replaceState(null, "", "?lab=1");
  };
  const closeLab = () => {
    setLab(false);
    history.replaceState(null, "", location.pathname);
  };
  const simulatorProps = {
    snapshot,
    scenario,
    setScenario,
    run,
    send,
    videoAvailable,
    setVideoAvailable,
    matched,
    setMatched,
  };
  const product = (
    <main
      className="reference-product"
      data-layout={layout}
      data-daw-theme={layout === "warm-bronze" ? "bronze-vu" : layout}
      data-diagnostics={theme.diagnostics}
      data-theme={theme.id}
      data-meter={theme.tokens.meter}
      style={{
        ...themeVariables(theme),
        "--brightness": prefs.brightness / 100,
      }}
    >
      <StartupScreen
        mode={device.mode}
        offline={offline}
        preview={startupPreview}
      />
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
          {offline
            ? "OFFLINE PREVIEW"
            : liveMusic
              ? "LIVE MUSIC · MOCK HARDWARE"
              : "SIMULATED SYSTEM"}
          <span className="divider" /> {device.mode.toUpperCase()}
        </div>
        <button
          className="power"
          aria-label="Standby"
          disabled={liveMusic}
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
            ...(!embedded && !lab ? [["lab", "⌘", "Test bench"]] : []),
          ].map(([id, icon, label]) => (
            <button
              key={id}
              aria-label={label}
              aria-current={page === id ? "page" : undefined}
              className={page === id ? "selected" : ""}
              onClick={() => (id === "lab" ? openLab() : setPage(id))}
            >
              <span>{icon}</span>
              <small>{label}</small>
            </button>
          ))}
        </nav>
        {page === "playing" ? (
          <section className="now" aria-label="Now playing">
            <div
              className={`art ${videoActive && video.status === "active" ? "motion" : ""}`}
            >
              <div className="orb" />
              <span className="art-label">
                {videoActive ? "VIDEO ARTWORK · MOCK" : "AMBIENT TRANSMISSIONS"}
              </span>
              {videoActive && (
                <div className="video-info">
                  {video.status} · {time(video.position)}
                  <small>End-Sync {video.offset ?? "—"}s</small>
                </div>
              )}
            </div>
            <div className="track">
              <div className="eyebrow">
                {playback.connected
                  ? liveMusic
                    ? "MUSIC ASSISTANT"
                    : "MUSIC LIBRARY"
                  : "SERVER UNAVAILABLE"}{" "}
                <span>•</span> {liveMusic ? "PLAYER METADATA" : "MOCK LIBRARY"}
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
                  max={track.duration ?? 1}
                  disabled={
                    !writable ||
                    !track.duration ||
                    (liveMusic && !playback.capabilities?.includes("seek"))
                  }
                  value={track.duration ? position : 0}
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
                  disabled={!writable}
                  aria-label="Previous track"
                  onClick={() => send({ type: "previous" })}
                >
                  Ⅰ◀
                </button>
                <button
                  className="play"
                  disabled={!writable}
                  aria-label={playback.playing ? "Pause" : "Play"}
                  onClick={() =>
                    send({ type: playback.playing ? "pause" : "play" })
                  }
                >
                  {playback.playing ? "Ⅱ" : "▶"}
                </button>
                <button
                  disabled={!writable}
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
              <ReferenceAside
                layout={layout}
                snapshot={snapshot}
                prefs={prefs}
                update={update}
              />
              <div className="eyebrow volume-title">VOLUME</div>
              <VolumeControl
                value={playerVolume}
                muted={
                  liveMusic ? playback.muted : (snapshot.audio?.muted ?? false)
                }
                live={liveMusic}
                limit={
                  liveMusic ? (snapshot.musicAssistant?.volumeLimit ?? 40) : 100
                }
                disabled={!volumeEnabled}
                muteDisabled={
                  liveMusic && !playback.capabilities?.includes("volume_mute")
                }
                onValue={(value) => {
                  if (liveMusic) send({ type: "volume", value });
                  else {
                    update("volume", value);
                    send({ type: "volume", value });
                  }
                }}
                onMute={() => {
                  if (liveMusic) send({ type: "mute", value: !playback.muted });
                  else send({ type: "mute", value: !snapshot.audio?.muted });
                }}
              />
              <small>
                Hardware unverified
                <br />
                Amplifier physically disabled
              </small>
            </aside>
          </section>
        ) : (
          <section className="panel paginated-panel">
            <div className="panel-title">
              <div className="eyebrow">DAW ONE CONTROL</div>
              <h1>{page === "settings" ? "Make it yours" : "Up next"}</h1>
            </div>
            {page === "settings" ? (
              <SettingsPages
                snapshot={snapshot}
                onSnapshot={setSnapshot}
                prefs={prefs}
                update={update}
                themePreferences={themePreferences}
                theme={theme}
                setThemePreferences={setThemePreferences}
              />
            ) : (
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
              ? liveMusic
                ? "MUSIC ASSISTANT CONNECTED"
                : "MOCK SOURCE CONNECTED"
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
  return lab && !embedded ? (
    <TestWorkbench
      snapshot={snapshot}
      offline={offline}
      prefs={prefs}
      send={send}
      now={clock}
      onClose={closeLab}
      simulatorProps={simulatorProps}
      product={product}
      onReplayStartup={() => setStartupPreview((v) => v + 1)}
    />
  ) : (
    product
  );
}
createRoot(document.getElementById("root")).render(<App />);
if (import.meta.env.PROD && "serviceWorker" in navigator)
  navigator.serviceWorker.register("/sw.js").catch(() => {});
