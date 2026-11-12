import {setLanguage} from '../shared/i18n.js';
import {PhoneSetup} from './NetworkWizard.jsx';
import {FirstStartWizard} from './FirstStartWizard.jsx';
import {tr} from "../shared/i18n.js";
import "./audio-analysis.css";
import "./device-settings.css";
import {DeviceUpdatesProvider} from "./DeviceUpdates.jsx";
import {
  deviceProfile,
  profileSettings,
  profileTheme,
} from "../shared/profile.js";
import { BuildBadge } from "./BuildBadge.jsx";
import React, { useState, useEffect } from "react";
import {useLanguage} from './LanguageSettings.jsx';
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
import { DisplayViewport } from "./DisplayViewport.jsx";
import { displayMode, panelProfile } from "../shared/display.js";
import { VolumeControl } from "./VolumeControl.jsx";
import "../design/brand-tokens.css";
import "./style.css";
import { MusicShell } from "./MusicShell.jsx";
import "./music-shell.css";
import "./wall.css";
import "./settings-hub.css";
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
const profile = deviceProfile(location.search);
function App() {
  useLanguage();
  const [snapshot, setSnapshot] = useState({
      device: transition(initialDevice(), { type: "boot-complete" }),
      playback: initialPlayback(),
      mode: "simulation",
    }),
    [storedPrefs, setPrefs] = useState(load),
    [themePreferences, setThemePreferences] = useState(loadThemes),
    [page, setPage] = useState("playing"),
    [startupPreview, setStartupPreview] = useState(0),
    [lab, setLab] = useState(
      !displayMode(location.search) &&
        !["screen", "product"].some(
          (key) => new URLSearchParams(location.search).get(key) === "1",
        ),
    ),
    [offline, setOffline] = useState(false),
    [clock, setClock] = useState(Date.now()),
    [notice, setNotice] = useState(""),
    [videoAvailable, setVideoAvailable] = useState(true),
    [matched, setMatched] = useState(true),
    [scenario, setScenario] = useState("Cold boot");
  const prefs = profileSettings(storedPrefs, profile);
  useEffect(()=>{if(panelProfile(location.search)!=='wall-16-10')return;const value=snapshot.preferences;if(!value||value.revision===0)return;setPrefs(normalize(value.prefs));setThemePreferences(normalizeThemePreferences(value.themePreferences));setLanguage(value.language);},[snapshot.preferences?.revision]);
  useEffect(() => {
    try {
      localStorage.setItem("daw-settings", JSON.stringify(storedPrefs));
    } catch {
      setNotice("Settings storage unavailable");
    }
  }, [storedPrefs]);
  useEffect(() => {
    try {
      localStorage.setItem("daw-themes", JSON.stringify(themePreferences));
    } catch {
      setNotice("Theme storage unavailable; changes apply for this session");
    }
  }, [themePreferences]);
  useEffect(() => {
    let live = true;
    const poll = () => {
      if (!navigator.onLine) { if(live)setOffline(true); return; }
      return fetch("/api/state")
        .then((r) => {
          if (!r.ok) throw Error();
          return r.json();
        })
        .then((s) => {
          if (live && navigator.onLine) {
            setSnapshot(s);
            setOffline(false);
          }
        })
        .catch(() => {
          if (live) setOffline(true);
        });
    };
    const markOffline=()=>setOffline(true);
    window.addEventListener("offline",markOffline);
    window.addEventListener("online",poll);
    const stream = new EventSource("/api/events");
    stream.onmessage = (e) => {
      if (!live || !navigator.onLine) return;
      try {
        setSnapshot(JSON.parse(e.data));
        setOffline(false);
      } catch {}
    };
    stream.onerror = () => {
      // SSE may fail while HTTP remains healthy; verify through the fallback.
      if (live) poll();
    };
    poll();
    const id = setInterval(poll, 1500);
    return () => {
      live = false;
      clearInterval(id);
      stream.close();
      window.removeEventListener("offline",markOffline);
      window.removeEventListener("online",poll);
    };
  }, []);
  useEffect(() => {
    let lastSent = -Infinity;
    let trailing;
    const report = () => {
      lastSent = performance.now();
      fetch("/api/activity", { method: "POST" }).catch(() => {});
    };
    const activity = (event) => {
      if (event.type === "pointermove" && !event.buttons) return;
      if (!event.isTrusted) return;
      clearTimeout(trailing);
      if (performance.now() - lastSent >= 2000) report();
      else trailing = setTimeout(report, 2000);
    };
    const events = [
      "pointerdown",
      "pointermove",
      "keydown",
      "input",
      "wheel",
      "touchmove",
    ];
    events.forEach((type) =>
      document.addEventListener(type, activity, { passive: true }),
    );
    return () => {
      clearTimeout(trailing);
      events.forEach((type) => document.removeEventListener(type, activity));
    };
  }, []);
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), snapshot.device.displayAwake === false ? 30000 : profile.clockMs);
    return () => clearInterval(id);
  }, [snapshot.device.displayAwake]);
  async function send(e) {
    if (offline) {
      setNotice("Offline preview · command not sent");
      return false;
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
        return false;
      }
      setSnapshot(data);
      setNotice("");
      return true;
    } catch {
      setOffline(true);
      setNotice("Connection lost · settings remain available");
      return false;
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
  const theme = profileTheme(
    resolveTheme(
      themePreferences,
      { device, playback, offline },
      new Date(clock),
    ),
    profile,
  );
  const mode = displayMode(location.search);
  const embedded = mode !== null;
  const layout =
    theme.id === "draft" || theme.id.startsWith("custom-")
      ? "reference-dark"
      : theme.id;
  const videoActive = layout === "cinematic" || prefs.artwork === "video";
  const openLab = () => {
    setLab(true);
    history.replaceState(null, "", "?lab=1");
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
  const gui2 = new URLSearchParams(location.search).get("gui") === "2";
  const product = gui2 ? (
    <MusicShell
      snapshot={snapshot}
      offline={offline}
      send={send}
      prefs={prefs}
      update={update}
      theme={theme}
      themePreferences={themePreferences}
      setThemePreferences={setThemePreferences}
      setSnapshot={setSnapshot}
      position={position}
      notice={notice}
      startupPreview={startupPreview}
      onReplayStartup={()=>setStartupPreview(v=>v+1)}
    />
  ) : (
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
        staticOnly={profile.lowPower}
        boot={snapshot.boot}
      />
      <header>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("playing");
          }}
        >{tr("DAW ")}<b>{tr("ONE")}</b>
          <span>{tr("INTELLIGENT STREAMING AMPLIFIER")}</span>
        </a>
        <a
          href="?gui=2&product=1"
          style={{ color: "var(--accent)", fontSize: 11 }}
        >{tr("Probeer GUI 2.0 ↗")}</a>
        <div className="status">
          <i className={offline ? "amber" : ""} />
          {tr(offline
            ? "OFFLINE PREVIEW"
            : liveMusic
              ? "LIVE MUSIC · MOCK HARDWARE"
              : "SIMULATED SYSTEM")}
          <span className="divider" /> {tr(device.mode.toUpperCase())}
        </div>
        <button
          className="power"
          aria-label={tr("Standby")}
          disabled={liveMusic}
          onClick={() => send({ type: "standby" })}
        >
          ⏻
        </button>
      </header>
      <div className="shell">
        <nav aria-label={tr("Main navigation")}>
          {[
            ["playing", "◉", "Now playing"],
            ["queue", "≋", "Queue"],
            ["settings", "⚙", "Settings"],
            ...(!embedded && !lab ? [["lab", "⌘", "Test bench"]] : []),
          ].map(([id, icon, label]) => (
            <button
              key={id}
              aria-label={tr(label)}
              aria-current={page === id ? "page" : undefined}
              className={page === id ? "selected" : ""}
              onClick={() => (id === "lab" ? openLab() : setPage(id))}
            >
              <span>{tr(icon)}</span>
              <small>{tr(label)}</small>
            </button>
          ))}
        </nav>
        {page === "playing" ? (
          <section className="now" aria-label={tr("Now playing")}>
            <div
              className={`art ${videoActive && video.status === "active" ? "motion" : ""}`}
            >
              <div className="orb" />
              <span className="art-label">
                {tr(videoActive ? "VIDEO ARTWORK · MOCK" : "AMBIENT TRANSMISSIONS")}
              </span>
              {videoActive && (
                <div className="video-info">
                  {tr(video.status)} · {tr(time(video.position))}
                  <small>{tr("End-Sync ")}{tr(video.offset ?? "—")}{tr("s")}</small>
                </div>
              )}
            </div>
            <div className="track">
              <div className="eyebrow">
                {tr(playback.connected
                  ? liveMusic
                    ? "MUSIC ASSISTANT"
                    : "MUSIC LIBRARY"
                  : "SERVER UNAVAILABLE")}{tr(" ")}
                <span>•</span> {tr(liveMusic ? "PLAYER METADATA" : "MOCK LIBRARY")}
              </div>
              <h1>{track.title}</h1>
              <p>
                {track.artist}
                <span className="dot"> · </span>
                <span className="album">{track.album}</span>
              </p>
              <div className="progress">
                <input
                  aria-label={tr("Playback position")}
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
                  <span>{tr(time(position))}</span>
                  <span>{tr(time(track.duration))}</span>
                </div>
              </div>
              <div className="transport">
                <button
                  disabled={!writable}
                  aria-label={tr("Previous track")}
                  onClick={() => send({ type: "previous" })}
                >
                  Ⅰ◀
                </button>
                <button
                  className="play"
                  disabled={!writable}
                  aria-label={tr(playback.playing ? "Pause" : "Play")}
                  onClick={() =>
                    send({ type: playback.playing ? "pause" : "play" })
                  }
                >
                  {tr(playback.playing ? "Ⅱ" : "▶")}
                </button>
                <button
                  disabled={!writable}
                  aria-label={tr("Next track")}
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
                  {tr(prefs.artwork === "cover"
                    ? "◈ Video artwork"
                    : "◈ Cover artwork")}
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
              <div className="eyebrow volume-title">{tr("VOLUME")}</div>
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
              <small>{tr("Hardware unverified")}<br />{tr("Amplifier physically disabled")}</small>
            </aside>
          </section>
        ) : (
          <section className="panel paginated-panel">
            <div className="panel-title">
              <div className="eyebrow">{tr("DAW ONE CONTROL")}</div>
              <h1>{tr(page === "settings" ? "Make it yours" : "Up next")}</h1>
            </div>
            {page === "settings" ? (
              <SettingsPages
                offline={offline}
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
                      {tr(i === playback.index
                        ? "◉"
                        : String(i + 1).padStart(2, "0"))}
                    </span>
                    <div>
                      <b>{t.title}</b>
                      <small>{t.artist}</small>
                    </div>
                    <span>{tr(time(t.duration))}</span>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
      <footer>
        <span>
          <i />{tr(" ")}
          {tr(offline
            ? "BACKEND OFFLINE"
            : playback.connected
              ? liveMusic
                ? "MUSIC ASSISTANT CONNECTED"
                : "MOCK SOURCE CONNECTED"
              : "MUSIC SERVER DISCONNECTED")}
        </span>
        <span role="status">
          {tr(notice ||
            (device.faults.length
              ? "FAULT LATCHED · OUTPUT INHIBITED"
              : !device.displayAwake
                ? "DISPLAY SLEEP SIMULATED · AUDIO INDEPENDENT"
                : "DESIGNED FOR LISTENING"))}
        </span>
        <span>
          <BuildBadge snapshot={snapshot} offline={offline} />
        </span>
      </footer>
    </main>
  );
  if(snapshot.onboardingRequired&&new URLSearchParams(location.search).get('screen')==='1')return <FirstStartWizard snapshot={snapshot} offline={offline} onComplete={()=>fetch('/api/state').then(r=>r.json()).then(setSnapshot)}/>;
  return lab && !embedded ? (
    <TestWorkbench
      gui2={gui2}
      snapshot={snapshot}
      offline={offline}
      prefs={prefs}
      send={send}
      now={clock}
      simulatorProps={simulatorProps}
      product={product}
      onReplayStartup={() => setStartupPreview((v) => v + 1)}
    />
  ) : mode ? (
    <DisplayViewport mode={mode}>{tr(product)}</DisplayViewport>
  ) : (
    product
  );
}
class AppBoundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch(error) {
    console.error("DAW ONE display-r3", error);
  }
  render() {
    return this.state.error ? (
      <section role="alert" style={{ padding: 24 }}>
        <h1>{tr("DAW ONE kon het scherm niet tekenen")}</h1>
        <p>{tr("Versie display-r3. Herlaad de pagina; je instellingen blijven bewaard.")}</p>
        <button onClick={() => location.reload()}>{tr("Opnieuw laden")}</button>
      </section>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")).render(
  <AppBoundary>
    <DeviceUpdatesProvider>{new URLSearchParams(location.search).get('setup')==='phone'?<PhoneSetup/>:<App />}</DeviceUpdatesProvider>
  </AppBoundary>,
);
if (import.meta.env.PROD && "serviceWorker" in navigator)
  navigator.serviceWorker.register("/sw.js").catch(() => {});
