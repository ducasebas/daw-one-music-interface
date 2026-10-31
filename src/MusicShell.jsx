import { BuildBadge } from "./BuildBadge.jsx";
import { TouchVolume, useVolumeRequests } from "./TouchVolume.jsx";
import React, { useState, useRef, useEffect } from "react";
import { flushSync } from "react-dom";
import { SkinPanel } from "./SkinPanel.jsx";
import { presets, normalizeThemePreferences } from "../shared/themes.js";
import { themeVariables } from "../shared/themes.js";
import { tracks } from "../shared/playback.js";
import { endSync } from "../shared/video.js";
import { SettingsPages } from "./SettingsPages.jsx";
import { Icon } from "./Icon.jsx";
import { StartupScreen } from "./StartupScreen.jsx";

const duration = (n) =>
  Number.isFinite(n)
    ? `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`
    : "Live";
const sections = [
  ["discover", "Ontdek"],
  ["library", "Mijn muziek"],
  ["search", "Zoeken"],
  ["queue", "Wachtrij"],
  ["rooms", "Kamers"],
];
const categories = [
  "Albums",
  "Artiesten",
  "Nummers",
  "Playlists",
  "Radio",
  "Favorieten",
];
function Cover({ index = 0, small = false }) {
  return (
    <div
      aria-hidden="true"
      className={`m2-cover m2-cover-${index % 3} ${small ? "m2-small" : ""}`}
    >
      <i />
      <span>
        TUNEBOX
        <br />
        SESSIONS {String(index + 1).padStart(2, "0")}
      </span>
    </div>
  );
}
export function MusicShell({
  snapshot,
  offline,
  send,
  prefs,
  update,
  theme,
  themePreferences,
  setThemePreferences,
  setSnapshot,
  position,
  notice,
  startupPreview,
}) {
  const [page, setPage] = useState("discover"),
    [category, setCategory] = useState("Albums"),
    [detail, setDetail] = useState(null),
    [query, setQuery] = useState(""),
    [keyboard, setKeyboard] = useState(true),
    [offset, setOffset] = useState(0),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState(false),
    [video, setVideo] = useState(false),
    [rooms, setRooms] = useState({ rivo: false, volume: 35 });
  const [favorites, setFavorites] = useState(() => {
    try {
      const v = JSON.parse(
        localStorage.getItem("tunebox-example-favorites") || "[]",
      );
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(
        "tunebox-example-favorites",
        JSON.stringify(favorites),
      );
    } catch {
      setMessage("Favorieten kunnen niet worden opgeslagen.");
    }
  }, [favorites]);
  const lock = useRef(false),
    { playback, device } = snapshot,
    current = playback.queue[playback.index],
    simulated = snapshot.mode === "simulation",
    available = !offline && playback.connected,
    control =
      available && (simulated || snapshot.musicAssistant?.controlEnabled),
    volume = simulated ? (snapshot.audio?.volume ?? 32) : playback.volume,
    muted = simulated ? snapshot.audio?.muted : playback.muted;
  const volumeRequests = useVolumeRequests(send);
  const canVolume =
    control &&
    Number.isFinite(volume) &&
    (simulated || playback.capabilities?.includes("volume_set"));
  const animation = useRef(null);
  const returnTo = useRef({ page: "discover", detail: null });
  const [direction, setDirection] = useState("crossfade");
  function navigate(change, motion = "crossfade") {
    animation.current?.skipTransition();
    const commit = () => {
      setDirection(motion);
      change();
    };
    if (
      document.startViewTransition &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      // Direction belongs to the transition snapshots; keep it off global CSS state.
      document.documentElement.dataset.tuneboxMotion = motion;
      animation.current = document.startViewTransition(() => flushSync(commit));
      animation.current.finished.catch(() => {});
    } else commit();
  }
  const go = (id) => {
    if (id === "playing" && page !== "playing")
      returnTo.current = { page, detail };
    navigate(() => {
      setPage(id);
      setDetail(null);
      setMessage("");
    });
  };
  const back = () => {
    navigate(() => {
      if (page === "playing") {
        setPage(returnTo.current.page);
        setDetail(returnTo.current.detail);
      } else setDetail(null);
    }, "back");
  };
  async function command(event) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setMessage("");
    try {
      await send(event);
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  const sample = tracks.filter((t) =>
    `${t.title} ${t.artist} ${t.album}`
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
  );
  const choose = (t) => {
    navigate(() => {
      setDetail(t);
      setOffset(0);
    }, "forward");
  };
  const act = (t, next = false) => {
    const id = playback.queue.find((q) => q.title === t.title)?.id;
    if (!id) {
      setMessage("Dit voorbeeld is niet meer beschikbaar in de wachtrij.");
      return;
    }
    command({ type: "queue-add", id, next });
  };
  const sync = endSync({
    audioPosition: position,
    audioDuration: current.duration,
    videoDuration: 360,
    correction: prefs.correction,
    intro: 10,
    matched: true,
    available: true,
    playing: playback.playing,
  });
  const title = detail
    ? detail.album
    : page === "playing"
      ? "Nu spelen"
      : page === "settings"
        ? "Instellingen"
        : sections.find((s) => s[0] === page)?.[1];
  const cards = (list = tracks) => (
    <div className="m2-cards">
      {list.map((t, i) => (
        <button key={t.id} className="m2-card" onClick={() => choose(t)}>
          <Cover index={i} />
          <strong>{category === "Artiesten" ? t.artist : t.album}</strong>
          <small>{t.artist}</small>
        </button>
      ))}
    </div>
  );
  return (
    <main
      className="music2"
      data-theme={theme.id}
      data-skin={
        presets.some((p) => p.id === theme.id) ? theme.id : "reference-dark"
      }
      data-diagnostics={theme.diagnostics}
      style={{
        ...themeVariables(theme),
        "--brightness": prefs.brightness / 100,
      }}
      data-motion={direction}
    >
      <StartupScreen
        mode={device.mode}
        offline={offline}
        preview={startupPreview}
      />
      <header className="m2-header">
        <button className="m2-brand" onClick={() => go("discover")}>
          DAW <b>TuneBox</b>
          <span>v1 / MUSIC FIRST</span>
        </button>
        <nav aria-label="Muzieknavigatie">
          {sections.map(([id, label]) => (
            <button
              key={id}
              aria-label={label}
              aria-current={page === id ? "page" : undefined}
              onClick={() => go(id)}
            >
              <Icon name={id} />
              {label}
            </button>
          ))}
        </nav>
        <label className="m2-skin-picker">
          <span>SKIN</span>
          <select
            aria-label="Kies skin"
            value={theme.id}
            onChange={(e) =>
              setThemePreferences(
                normalizeThemePreferences({
                  ...themePreferences,
                  selected: e.target.value,
                  mode: "manual",
                }),
              )
            }
          >
            {theme.id === "draft" && (
              <option value="draft">Custom preview</option>
            )}
            {[...presets, ...themePreferences.custom].map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button aria-label="Instellingen" onClick={() => go("settings")}>
          <Icon name="settings" />
        </button>
      </header>
      <div className="m2-heading">
        <div>
          {(detail || page === "playing") && (
            <button
              className="m2-back"
              aria-label={
                page === "playing"
                  ? "Terug naar muziek"
                  : "Terug naar overzicht"
              }
              onClick={back}
            >
              <Icon name="back" />
            </button>
          )}
          <h1>{title}</h1>
          {page === "discover" && !detail && (
            <span>Jouw volgende ontdekking.</span>
          )}
        </div>
        <div className="m2-version-status">
          <BuildBadge snapshot={snapshot} offline={offline} />
          <small className={offline ? "m2-warning" : ""}>
            {offline
              ? "Offline · instellingen beschikbaar"
              : simulated
                ? "● SIMULATIE · VOORBEELDBIBLIOTHEEK"
                : "● MUSIC ASSISTANT · BIBLIOTHEEK NOG NIET GEKOPPELD"}
          </small>
        </div>
      </div>
      <section
        className="m2-content"
        aria-label={title}
        key={`${page}-${detail?.id || "list"}`}
      >
        {detail ? (
          <div className="m2-detail">
            <Cover index={tracks.findIndex((t) => t.id === detail.id)} />
            <div>
              <small>VOORBEELDALBUM · {detail.artist}</small>
              <h2>{detail.album}</h2>
              <p>
                {detail.title} · {duration(detail.duration)}
              </p>
              <div className="m2-actions">
                <button
                  aria-pressed={favorites.includes(detail.id)}
                  onClick={() =>
                    setFavorites((f) =>
                      f.includes(detail.id)
                        ? f.filter((id) => id !== detail.id)
                        : [...f, detail.id],
                    )
                  }
                >
                  <Icon name="heart" size={16} />{" "}
                  {favorites.includes(detail.id)
                    ? "Favoriet opgeslagen"
                    : "Bewaar favoriet"}
                </button>
                <button
                  className="m2-primary"
                  disabled={!control || !simulated || pending}
                  onClick={() => {
                    command({
                      type: "queue-select",
                      id: playback.queue.find((t) => t.title === detail.title)
                        ?.id,
                    });
                    go("playing");
                  }}
                >
                  <Icon name="play" size={16} /> Speel nu
                </button>
                <button
                  disabled={!control || !simulated || pending}
                  onClick={() => act(detail, true)}
                >
                  Als volgende
                </button>
                <button
                  disabled={!control || !simulated || pending}
                  onClick={() => act(detail)}
                >
                  Voeg toe aan einde
                </button>
              </div>
              <p className="m2-subtle">
                Voorbeeldselectie · echte albums en aanbevelingen volgen via de
                NUC.
              </p>
            </div>
          </div>
        ) : page === "discover" ? (
          <div className="m2-discover">
            <button
              className="m2-feature"
              onClick={() => {
                setCategory("Playlists");
                go("library");
              }}
            >
              <small>VOOR JOU / VOORBEELD</small>
              <h2>
                Laat de avond
                <br />
                maar beginnen.
              </h2>
              <span>Rustige ontdekkingen, grote klanken.</span>
              <div className="m2-feature-orb" />
            </button>
            <div className="m2-discover-right">
              <div className="m2-section-label">
                Verder luisteren <span>Spotify & Tidal · concept</span>
              </div>
              {cards()}
              <div className="m2-note">
                Persoonlijke aanbevelingen sluiten we later aan op Music
                Assistant op de NUC.
              </div>
            </div>
          </div>
        ) : page === "library" ? (
          <div className="m2-library">
            <div className="m2-filters">
              {categories.map((c) => (
                <button
                  key={c}
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            {category === "Radio" ? (
              <div className="m2-empty">
                <Icon name="radio" size={30} />
                <h2>Een wereld aan stations.</h2>
                <p>
                  Je favoriete stations verschijnen hier zodra de radiobron is
                  gekoppeld.
                </p>
                <small>Geen radiostream verbonden · voorbeeldscherm</small>
              </div>
            ) : category === "Nummers" ? (
              <div className="m2-list">
                {tracks.map((t, i) => (
                  <button key={t.id} onClick={() => choose(t)}>
                    <span>0{i + 1}</span>
                    <strong>{t.title}</strong>
                    <span>{t.artist}</span>
                    <small>{duration(t.duration)} ›</small>
                  </button>
                ))}
              </div>
            ) : category === "Favorieten" ? (
              favorites.length ? (
                cards(tracks.filter((t) => favorites.includes(t.id)))
              ) : (
                <div className="m2-empty">
                  <h2>Jouw muziek, dichtbij.</h2>
                  <p>Open een voorbeeldalbum en kies Bewaar favoriet.</p>
                </div>
              )
            ) : (
              cards()
            )}
          </div>
        ) : page === "search" ? (
          <div className="m2-search">
            <div className="m2-search-results">
              <label className="m2-searchbox">
                <Icon name="search" />
                <input
                  aria-label="Zoek muziek"
                  value={query}
                  placeholder="Artiest, album of nummer"
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setKeyboard(true)}
                />
                {query && (
                  <button
                    aria-label="Wis zoekopdracht"
                    onClick={() => setQuery("")}
                  >
                    <Icon name="close" size={16} />
                  </button>
                )}
              </label>
              <small>ZOEKEN IN VOORBEELDMUZIEK</small>
              <div className="m2-list">
                {sample.length ? (
                  sample.map((t) => (
                    <button key={t.id} onClick={() => choose(t)}>
                      <strong>{t.title}</strong>
                      <span>{t.artist}</span>
                      <small>›</small>
                    </button>
                  ))
                ) : (
                  <p>Geen resultaten voor “{query}”. Probeer Tycho.</p>
                )}
              </div>
            </div>
            <div className="m2-keyboard" aria-label="Schermtoetsenbord">
              {keyboard ? (
                <>
                  <div className="m2-keyboard-title">
                    Zoeken zonder telefoon
                    <button onClick={() => setKeyboard(false)}>Verberg</button>
                  </div>
                  {["qwertyuiop", "asdfghjkl", "zxcvbnm"].map((row) => (
                    <div key={row}>
                      {[...row].map((k) => (
                        <button
                          aria-label={`Toets ${k}`}
                          key={k}
                          onClick={() => setQuery((q) => q + k)}
                        >
                          {k}
                        </button>
                      ))}
                    </div>
                  ))}
                  <div>
                    <button
                      className="m2-space"
                      onClick={() => setQuery((q) => q + " ")}
                    >
                      Spatie
                    </button>
                    <button
                      aria-label="Backspace"
                      onClick={() => setQuery((q) => q.slice(0, -1))}
                    >
                      <Icon name="backspace" />
                    </button>
                    <button onClick={() => setKeyboard(false)}>Gereed</button>
                  </div>
                </>
              ) : (
                <button onClick={() => setKeyboard(true)}>
                  Toon toetsenbord
                </button>
              )}
            </div>
          </div>
        ) : page === "queue" ? (
          <div className="m2-queue">
            <div className="m2-section-label">
              {playback.queue.length} nummers{" "}
              <span>
                {simulated
                  ? "Gedeelde simulatorwachtrij"
                  : "Live wachtrij · bewerken nog niet gekoppeld"}
              </span>
            </div>
            <div className="m2-list">
              {playback.queue.slice(offset, offset + 3).map((t, i) => (
                <div className="m2-queue-row" key={t.id}>
                  <span>
                    {offset + i === playback.index
                      ? "▶"
                      : String(offset + i + 1).padStart(2, "0")}
                  </span>
                  <button
                    disabled={!control || !simulated || pending}
                    onClick={() => command({ type: "queue-select", id: t.id })}
                  >
                    <strong>{t.title}</strong>
                    <small>{t.artist}</small>
                  </button>
                  <span>{duration(t.duration)}</span>
                  <button
                    aria-label={`Verwijder ${t.title}`}
                    disabled={
                      !control ||
                      !simulated ||
                      offset + i === playback.index ||
                      pending
                    }
                    onClick={() => command({ type: "queue-remove", id: t.id })}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
              ))}
            </div>
            <div className="m2-pagination">
              <button
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - 3))}
              >
                ‹ Vorige
              </button>
              <span>
                {Math.floor(offset / 3) + 1} /{" "}
                {Math.ceil(playback.queue.length / 3)}
              </span>
              <button
                disabled={offset + 3 >= playback.queue.length}
                onClick={() => setOffset(offset + 3)}
              >
                Volgende ›
              </button>
            </div>
          </div>
        ) : page === "rooms" ? (
          <div className="m2-rooms">
            <article>
              <span className="m2-room-icon">
                <Icon name="speaker" size={30} />
              </span>
              <div>
                <small>DEZE RUIMTE</small>
                <h2>TuneBox</h2>
                <p>
                  {simulated
                    ? "Gesimuleerde lokale speler"
                    : playback.playerName || "Geen speler gekozen"}
                </p>
                <label>
                  Volume{" "}
                  <TouchVolume
                    label="TuneBox kamervolume"
                    value={volume}
                    target={volumeRequests.target}
                    onValue={volumeRequests.request}
                    disabled={!canVolume}
                    limit={
                      simulated
                        ? 100
                        : (snapshot.musicAssistant?.volumeLimit ?? 40)
                    }
                  />
                </label>
              </div>
              <b>{volume ?? "—"}%</b>
            </article>
            <article>
              <span className="m2-room-icon">
                <Icon name="rooms" size={30} />
              </span>
              <div>
                <small>RIVO · ALLEEN VISUEEL VOORBEELD</small>
                <h2>Volumio Rivo</h2>
                <p>
                  {rooms.rivo
                    ? "Voorbeeldgroep met TuneBox"
                    : "Protocol en synchronisatie nog te verifiëren"}
                </p>
                <label>
                  Voorbeeldvolume{" "}
                  <input
                    aria-label="Rivo voorbeeldvolume"
                    type="range"
                    value={rooms.volume}
                    onChange={(e) =>
                      setRooms((r) => ({ ...r, volume: +e.target.value }))
                    }
                  />
                </label>
              </div>
              <button
                aria-pressed={rooms.rivo}
                onClick={() => setRooms((r) => ({ ...r, rivo: !r.rivo }))}
              >
                {rooms.rivo
                  ? "Verwijder uit voorbeeldgroep"
                  : "Probeer voorbeeldgroep"}
              </button>
            </article>
            <small className="m2-note">
              Rivo-bediening is uitsluitend een lokale visualisatie. Er wordt
              geen netwerk- of audiocommando verstuurd.
            </small>
          </div>
        ) : page === "settings" ? (
          <div className="m2-settings">
            <SettingsPages
              snapshot={snapshot}
              onSnapshot={setSnapshot}
              prefs={prefs}
              update={update}
              themePreferences={themePreferences}
              theme={theme}
              setThemePreferences={setThemePreferences}
            />
          </div>
        ) : (
          <div className="m2-playing">
            <Cover index={playback.index} />
            <div>
              <small>
                {simulated ? "SIMULATIE" : "MUSIC ASSISTANT"} /{" "}
                {playback.playerName || "TuneBox"}
              </small>
              <h2>{current.title}</h2>
              <p>
                {current.artist} <span>— {current.album}</span>
              </p>
              <label>
                <input
                  aria-label="Afspeelpositie"
                  type="range"
                  min="0"
                  max={current.duration ?? 1}
                  value={current.duration ? position : 0}
                  disabled={
                    !control ||
                    !current.duration ||
                    (!simulated && !playback.capabilities?.includes("seek"))
                  }
                  onChange={(e) =>
                    command({ type: "seek", position: +e.target.value })
                  }
                />
              </label>
              <div className="m2-times">
                <span>{duration(position)}</span>
                <span>{duration(current.duration)}</span>
              </div>
            </div>
            <aside>
              <button aria-pressed={video} onClick={() => setVideo((v) => !v)}>
                <Icon name="film" size={16} /> Video Artwork
              </button>
              {video ? (
                <div className="m2-video">
                  <strong>END-SYNC · MOCK</strong>
                  <span>
                    {sync.status} · {duration(sync.position)}
                  </span>
                  <label>
                    Correctie (s)
                    <input
                      aria-label="Video correctie"
                      type="number"
                      value={prefs.correction}
                      onChange={(e) => update("correction", +e.target.value)}
                    />
                  </label>
                  <small>
                    Offset {sync.offset ?? "—"} s · geen echte video
                  </small>
                </div>
              ) : (
                <SkinPanel
                  skin={
                    presets.some((p) => p.id === theme.id)
                      ? theme.id
                      : "reference-dark"
                  }
                  theme={theme}
                  snapshot={snapshot}
                  offline={offline}
                />
              )}
            </aside>
          </div>
        )}
      </section>
      <footer className="m2-player">
        <button
          className="m2-current"
          onClick={() => go("playing")}
          aria-label="Open Nu spelen"
        >
          <span className="m2-current-cover" key={current.id}>
            <Cover index={playback.index} small />
          </span>
          <span>
            <strong>{current.title}</strong>
            <small>{current.artist}</small>
          </span>
        </button>
        <div className="m2-transport">
          <button
            aria-label="Vorig nummer"
            disabled={!control || pending}
            onClick={() => command({ type: "previous" })}
          >
            <Icon name="previous" />
          </button>
          <button
            className="m2-play"
            aria-label={playback.playing ? "Pauze" : "Afspelen"}
            disabled={!control || pending}
            onClick={() =>
              command({ type: playback.playing ? "pause" : "play" })
            }
          >
            <Icon name={playback.playing ? "pause" : "play"} />
          </button>
          <button
            aria-label="Volgend nummer"
            disabled={!control || pending}
            onClick={() => command({ type: "next" })}
          >
            <Icon name="next" />
          </button>
        </div>
        <div
          className="m2-player-status"
          role="status"
          data-feedback={
            offline || notice || device.faults.length
              ? "attention"
              : pending
                ? "pending"
                : "idle"
          }
        >
          {pending
            ? "Opdracht versturen…"
            : message ||
              notice ||
              (offline
                ? "Geen verbinding"
                : device.faults.length
                  ? "Apparaatfout · fysieke versterker uit"
                  : simulated
                    ? "SIMULATIE · GEEN AUDIO"
                    : "MUSIC ASSISTANT")}
        </div>
        <button
          aria-label={muted ? "Geluid aan" : "Dempen"}
          disabled={
            !control ||
            pending ||
            (!simulated && !playback.capabilities?.includes("volume_mute"))
          }
          onClick={() => command({ type: "mute", value: !muted })}
        >
          <Icon name={muted ? "mute" : "volume"} />
        </button>
        <TouchVolume
          value={volume}
          target={volumeRequests.target}
          onValue={volumeRequests.request}
          disabled={!canVolume}
          limit={simulated ? 100 : (snapshot.musicAssistant?.volumeLimit ?? 40)}
          mode={prefs.volumeControl}
        />
      </footer>
    </main>
  );
}
